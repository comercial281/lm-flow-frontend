import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import { Zap, Plus, Folder, FolderPlus, Pencil, Play, Pause, Copy, Archive, Trash2, LayoutTemplate, Repeat, Users } from 'lucide-react';
import { BaseHeader, Pagina } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import Abas from '@/components/base/Abas';
import Chave from '@/components/base/Chave';
import IconActionButton from '@/components/base/IconActionButton';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
import { flowAutomationsService, flowAutomationFoldersService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation, FlowAutomationFolder, FlowAutomationKind } from '@/types/flowAutomations';
import { flowTriggerSummary, normalizeTrigger, triggerEvents } from '@/features/flowAutomations/trigger';
import { FLOW_KIND_COPY } from '@/features/flowAutomations/kind';
import { LegacyFollowupStrip } from '@/components/flowAutomations/LegacyFollowupStrip';
import NoAccessState from '@/components/permissions/NoAccessState';
import { isForbiddenError } from '@/services/core/forbidden';
import { enableProblem } from '@/features/flowAutomations/readiness';
import { serverMessage } from '@/features/flowAutomations/guide';
import { FlowTemplateList, FlowTemplatesDialog } from '@/components/flowAutomations/FlowTemplates';

import { isPersonalFlow, useEhCorretorDeAutomacao } from '@/features/flowAutomations/personal';
import { useAuthStore } from '@/store/authStore';
import { useCan } from '@/hooks/useCan';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { usePergunta } from '@/hooks/usePergunta';
// A página Automações (sprint 2, 03/10/2026): a lista de fluxos do construtor.
// Grade de cards com filete colorido, selo de estado e ações. Pasta é lugar
// (entra), não filtro. Fluxo novo nasce em "Novo fluxo" ou num dos Modelos.
//
// Sprint 3: a aba Follow-up é ESTA lista com `kind="followup"`. O follow-up
// novo nasce montado com o modelo "Follow-up padrão" (o servidor monta), então
// lá não há "Modelos" nem pastas; no topo fica a faixa dos funis antigos que
// ainda têm fila.
type Aba = 'todas' | 'minhas' | 'equipe' | 'corretores';

export default function FlowAutomationsList({ kind = 'automation' }: { kind?: FlowAutomationKind }) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const { perguntar, dialogoDePergunta } = usePergunta();
  const navigate = useNavigate();
  const copy = FLOW_KIND_COPY[kind];
  const isFollowup = kind === 'followup';
  // Dono e equipe (automações por cargo): só na lista de automações, não no follow-up.
  const pode = useCan();
  const ehCorretor = useEhCorretorDeAutomacao() && !isFollowup;
  const ehGestor = !isFollowup && pode('flow_automations', 'update');
  const meId = String(useAuthStore(s => s.currentUser?.id) ?? '');
  const [aba, setAba] = useState<Aba | null>(null);
  const abaAtiva: Aba = aba ?? (ehCorretor ? 'minhas' : 'todas');
  const [automations, setAutomations] = useState<FlowAutomation[]>([]);
  const [folders, setFolders] = useState<FlowAutomationFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null | undefined>(undefined); // undefined = "todas"
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [recusado, setRecusado] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, fldrs] = await Promise.all([
        flowAutomationsService.list({ search: search || undefined, folderId, ...(isFollowup ? { kind } : {}) }),
        isFollowup || ehCorretor ? Promise.resolve([]) : flowAutomationFoldersService.list(),
      ]);
      setAutomations(list);
      setFolders(fldrs);
      setRecusado(false);
    } catch (e) {
      if (isForbiddenError(e)) setRecusado(true);
      else toast.error(isFollowup ? 'Erro ao carregar os follow-ups' : 'Erro ao carregar fluxos');
    } finally {
      setLoading(false);
    }
  }, [search, folderId, isFollowup, ehCorretor, kind]);

  useEffect(() => {
    load();
  }, [load]);

  const openFlow = (flow: Pick<FlowAutomation, 'id'>) => navigate(`${copy.listPath}/${flow.id}`);

  // `team` só vai quando o gestor escolhe (Pessoal = false, Da equipe = true);
  // o corretor cria sempre pessoal e o servidor ignora o parâmetro.
  const handleCreate = async (team?: boolean) => {
    try {
      const created = await flowAutomationsService.create(
        isFollowup
          ? { name: copy.newName, kind }
          : { name: copy.newName, folder_id: folderId ?? null, ...(ehGestor && team !== undefined ? { team } : {}) },
      );
      openFlow(created);
    } catch {
      toast.error(isFollowup ? 'Erro ao criar o follow-up' : 'Erro ao criar fluxo');
    }
  };

  // Modelos: o servidor cria o fluxo desligado e a tela abre ele no canvas.
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const toggle = async (a: FlowAutomation) => {
    try {
      // Ligar confere o fluxo salvo: bloco de modelo com campo em branco não liga.
      if (!a.is_enabled) {
        const full = await flowAutomationsService.get(a.id);
        const problem = enableProblem(normalizeTrigger(full.trigger), full.nodes ?? []);
        if (problem) {
          toast.error(problem);
          return;
        }
      }
      await flowAutomationsService.toggle(a.id);
      load();
    } catch (e) {
      // Sprint 4: com passo do guia pendente o servidor recusa e diz qual falta.
      toast.error(serverMessage(e, 'Erro ao ligar/desligar'));
    }
  };

  const duplicate = async (a: FlowAutomation) => {
    try {
      await flowAutomationsService.duplicate(a.id);
      toast.success(ehCorretor && !isPersonalFlow(a) ? 'Fluxo duplicado: a cópia é sua.' : 'Fluxo duplicado');
      if (ehCorretor && !isPersonalFlow(a)) setAba('minhas');
      load();
    } catch {
      toast.error('Erro ao duplicar');
    }
  };

  const markTeam = async (a: FlowAutomation, next: boolean): Promise<boolean> => {
    try {
      await flowAutomationsService.update(a.id, { team: next });
      setAutomations(list => list.map(x => (x.id === a.id
        ? { ...x, team: next, permissions: x.permissions ? { ...x.permissions, personal: !next } : x.permissions }
        : x)));
      toast.success(next ? `"${a.name}" agora é da equipe: todo mundo vê.` : `"${a.name}" voltou a ser só do dono.`);
      return true;
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra mudar agora. Tente de novo.'));
      return false;
    }
  };

  const archive = async (a: FlowAutomation) => {
    try {
      await flowAutomationsService.archive(a.id);
      load();
    } catch {
      toast.error('Erro ao arquivar');
    }
  };

  const destroy = async (a: FlowAutomation) => {
    if (!(await confirmar({
      titulo: isFollowup ? 'Excluir follow-up' : 'Excluir automação',
      descricao: <>Excluir <strong>{a.name}</strong>? Essa ação não pode ser desfeita.</>,
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    try {
      await flowAutomationsService.destroy(a.id);
      toast.success('Fluxo removido');
      load();
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const createFolder = async () => {
    const name = await perguntar({
      titulo: 'Nova pasta',
      rotuloDoCampo: 'Nome da pasta',
      placeholder: 'Ex.: Campanhas de retomada',
      rotuloDaAcao: 'Criar',
    });
    if (!name) return;
    try {
      await flowAutomationFoldersService.create({ name });
      load();
    } catch {
      toast.error('Erro ao criar pasta');
    }
  };

  const renameFolder = async (f: FlowAutomationFolder, ev: MouseEvent) => {
    ev.stopPropagation();
    const name = await perguntar({
      titulo: 'Renomear pasta',
      rotuloDoCampo: 'Novo nome',
      valorInicial: f.name,
      rotuloDaAcao: 'Renomear',
    });
    if (!name || name === f.name) return;
    try {
      await flowAutomationFoldersService.update(f.id, { name });
      load();
    } catch {
      toast.error('Erro ao renomear pasta');
    }
  };

  const deleteFolder = async (f: FlowAutomationFolder, ev: MouseEvent) => {
    ev.stopPropagation();
    if (!(await confirmar({
      titulo: 'Excluir pasta',
      descricao: <>Excluir a pasta <strong>{f.name}</strong>? Os fluxos de dentro voltam pra &ldquo;Sem pasta&rdquo; — nenhum fluxo é excluído.</>,
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    try {
      await flowAutomationFoldersService.destroy(f.id);
      load();
    } catch {
      toast.error('Erro ao excluir pasta');
    }
  };

  const doMeu = useCallback((a: FlowAutomation) => isPersonalFlow(a) && String(a.owner_user_id ?? '') === meId, [meId]);
  const dosCorretores = useCallback((a: FlowAutomation) => isPersonalFlow(a) && String(a.owner_user_id ?? '') !== meId, [meId]);
  const grupos = useMemo(() => ({
    minhas: automations.filter(doMeu),
    equipe: automations.filter(a => !isPersonalFlow(a)),
    corretores: automations.filter(dosCorretores),
  }), [automations, doMeu, dosCorretores]);
  const comAbas = ehCorretor || ehGestor;
  const mostradas = !comAbas || abaAtiva === 'todas' ? automations : grupos[abaAtiva];
  const abas = ehCorretor
    ? [
        { chave: 'minhas', rotulo: `Minhas (${grupos.minhas.length})` },
        { chave: 'equipe', rotulo: `Da equipe (${grupos.equipe.length})`, icone: Users },
      ]
    : [
        { chave: 'todas', rotulo: `Todas (${automations.length})` },
        { chave: 'minhas', rotulo: `Minhas (${grupos.minhas.length})` },
        { chave: 'equipe', rotulo: `Da equipe (${grupos.equipe.length})`, icone: Users },
        { chave: 'corretores', rotulo: `Dos corretores (${grupos.corretores.length})` },
      ];

  if (recusado) return <NoAccessState />;

  return (
    <>
    <Pagina
      rolagem="conteudo"
      cabecalho={
        <BaseHeader
          title={copy.title}
          subtitle={copy.description}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={copy.searchPlaceholder}
          aDireita={!isFollowup && (
            <>
              {ehGestor && (
                <Button variant="outline" onClick={() => handleCreate(false)}><Plus className="h-4 w-4 mr-1" /> Nova pessoal</Button>
              )}
              <Button variant="outline" onClick={() => setTemplatesOpen(true)}><LayoutTemplate className="h-4 w-4 mr-1" /> Modelos</Button>
            </>
          )}
          primaryAction={{
            label: ehGestor ? 'Nova da equipe' : copy.newButton,
            icon: <Plus className="h-4 w-4" />,
            onClick: () => handleCreate(ehGestor ? true : undefined),
          }}
        />
      }
    >
      {isFollowup && <LegacyFollowupStrip />}

      {comAbas && (
        <Abas
          rotulo="Automações"
          ativa={abaAtiva}
          aoTrocar={chave => setAba(chave as Aba)}
          abas={abas}
        />
      )}

      {!isFollowup && !ehCorretor && folderId === undefined && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
          {folders.map(f => (
            <div key={f.id} className="group relative flex items-center gap-2 rounded-lg border border-border p-3 hover:border-primary transition-colors">
              <button onClick={() => setFolderId(f.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <Folder className="h-4 w-4 shrink-0" style={{ color: f.color }} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{f.automations_count} itens · {f.enabled_count} ligados</div>
                </div>
              </button>
              {/* Sempre à vista (GLOSSARIO, peças 15 e 16): ⋮ apagado, acende ao passar o mouse. */}
              <div className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <BotaoMaisAcoes compacto aria-label={`Mais ações da pasta ${f.name}`} className="-my-1 -mr-1 text-muted-foreground group-hover:text-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={ev => renameFolder(f, ev)}>
                      <Pencil className="h-4 w-4" /> Renomear
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={ev => deleteFolder(f, ev)}>
                      <Trash2 className="h-4 w-4" /> Excluir pasta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
          <button
            onClick={createFolder}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <FolderPlus className="h-4 w-4" /> Nova pasta
          </button>
        </div>
      )}

      {folderId !== undefined && (
        <button onClick={() => setFolderId(undefined)} className="text-xs text-muted-foreground hover:text-foreground mb-3 self-start">
          ← Voltar pras pastas
        </button>
      )}

      {!loading && automations.length === 0 && !search && !isFollowup && (
        <div className="flex flex-col items-center">
          <EmptyState
            icon={Zap}
            title={copy.emptyTitle}
            description={copy.emptyDescription}
            className="pb-6"
          />
          <FlowTemplateList onApplied={openFlow} className="w-full max-w-xl" />
        </div>
      )}
      {!loading && automations.length === 0 && !search && isFollowup && (
        <EmptyState
          icon={Repeat}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          action={{ label: copy.newButton, onClick: () => handleCreate() }}
        />
      )}
      {comAbas && !loading && automations.length > 0 && mostradas.length === 0 && !search && (
        <EmptyState
          icon={abaAtiva === 'equipe' ? Users : Zap}
          title={abaAtiva === 'equipe' ? 'Nenhuma automação da equipe' : abaAtiva === 'corretores' ? 'Nenhuma automação dos corretores' : 'Nenhuma automação aqui'}
          description={abaAtiva === 'equipe'
            ? 'Automação marcada como "Da equipe" aparece pra todo mundo, só leitura pros corretores.'
            : 'Quando houver, aparece nesta aba.'}
        />
      )}
      {!loading && automations.length === 0 && search && (
        <EmptyState tipo="semResultado" aoLimparFiltros={() => setSearch('')} />
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-auto" aria-label="Automações">
        {mostradas.map(a => {
          const canEdit = ehCorretor ? a.permissions?.can_edit === true : a.permissions?.can_edit !== false;
          const canMarkTeam = !isFollowup && a.permissions?.can_mark_team === true;
          const selo = isFollowup ? null : !isPersonalFlow(a) ? 'equipe' : dosCorretores(a) && a.owner_name ? `De ${a.owner_name}` : null;
          return (
          <li key={a.id} className="rounded-lg border border-border overflow-hidden flex">
            <div className="w-1.5 shrink-0" style={{ backgroundColor: a.archived_at ? '#94a3b8' : a.is_enabled ? '#059669' : '#dc2626' }} />
            <div className="flex-1 p-3 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <button className="text-sm font-semibold truncate hover:underline text-left" onClick={() => openFlow(a)}>
                  {a.name}
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {selo === 'equipe' && (
                    <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                      <Users className="h-3 w-3" aria-hidden="true" /> Da equipe
                    </Badge>
                  )}
                  {selo && selo !== 'equipe' && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">{selo}</Badge>
                  )}
                  <Badge variant={a.archived_at ? 'secondary' : a.is_enabled ? 'default' : 'outline'} className="shrink-0 text-[10px]">
                    {a.archived_at ? 'ARQUIVADO' : a.is_enabled ? 'ATIVO' : 'DESLIGADO'}
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mb-3 truncate" title={flowTriggerSummary(normalizeTrigger(a.trigger))}>
                {triggerEvents(normalizeTrigger(a.trigger)).length ? flowTriggerSummary(normalizeTrigger(a.trigger)) : 'Sem gatilho definido'}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {canEdit ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => toggle(a)} title={a.is_enabled ? 'Desligar' : 'Ligar'}>
                      {a.is_enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicate(a)} title="Duplicar">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => archive(a)} title="Arquivar">
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => destroy(a)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => openFlow(a)}>Ver</Button>
                    <IconActionButton
                      label="Duplicar pra ter a sua cópia"
                      icon={<Copy className="h-3.5 w-3.5" />}
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => void duplicate(a)}
                    />
                  </>
                )}
                {canMarkTeam && (
                  <div className="ml-auto">
                    <Chave rotulo="Da equipe" ligada={!isPersonalFlow(a)} aoMudar={next => markTeam(a, next)} />
                  </div>
                )}
              </div>
            </div>
          </li>
          );
        })}
      </ul>
    </Pagina>
      {!isFollowup && <FlowTemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} onApplied={openFlow} />}
      {dialogoDeConfirmacao}
      {dialogoDePergunta}
    </>
  );
}
