import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import { Zap, Plus, Folder, FolderPlus, Pencil, Play, Pause, Copy, Archive, Trash2, LayoutTemplate, Users, UserMinus } from 'lucide-react';
import { BaseHeader, Pagina } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import Abas from '@/components/base/Abas';
import IconActionButton from '@/components/base/IconActionButton';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
import { flowAutomationsService, flowAutomationFoldersService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation, FlowAutomationFolder, FlowAutomationKind } from '@/types/flowAutomations';
import { flowTriggerSummary, normalizeTrigger, triggerEvents } from '@/features/flowAutomations/trigger';
import { FLOW_KIND_COPY } from '@/features/flowAutomations/kind';
import NoAccessState from '@/components/permissions/NoAccessState';
import { isForbiddenError } from '@/services/core/forbidden';
import { enableProblem } from '@/features/flowAutomations/readiness';
import { serverMessage } from '@/features/flowAutomations/guide';
import { FlowTemplateList, FlowTemplatesDialog } from '@/components/flowAutomations/FlowTemplates';
import ResolverPausasDialog from '@/components/flowAutomations/ResolverPausasDialog';
import { CartaoDeFluxo } from '@/components/flowAutomations/CartaoDeFluxo';
import { JanelaDeQuemE, type PedidoDeQuem } from '@/components/flowAutomations/JanelaDeQuemE';
import { textoDePausados } from '@/features/flowAutomations/pausas';
import ListaDeFollowups from './ListaDeFollowups';

import {
  isPersonalFlow, numeroFixoNaEquipe, presaNaEquipe, tirarDaEquipe, useEhCorretorDeAutomacao,
} from '@/features/flowAutomations/personal';
import { useAuthStore } from '@/store/authStore';
import { useCan } from '@/hooks/useCan';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { usePergunta } from '@/hooks/usePergunta';
// A página Automações (sprint 2, 03/10/2026): a lista de fluxos do construtor.
// Grade de cards com filete colorido, selo de estado e ações. Pasta é lugar
// (entra), não filtro. Fluxo novo nasce em "Novo fluxo" ou num dos Modelos.
//
// Sprint 3: a aba Follow-up era ESTA lista com `kind="followup"`; desde a
// Fase 3 (21/10/2026) o follow-up tem a lista dele (ListaDeFollowups).
type Aba = 'todas' | 'minhas' | 'equipe' | 'corretores';

// Fase 3 do follow-up (21/10/2026): o follow-up tem lista própria, em seções
// (Da equipe · Meus · Dos corretores), na aba Follow-up de Funis de mensagem.
export default function FlowAutomationsList({ kind = 'automation' }: { kind?: FlowAutomationKind }) {
  return kind === 'followup' ? <ListaDeFollowups /> : <ListaDeAutomacoes kind={kind} />;
}

function ListaDeAutomacoes({ kind }: { kind: FlowAutomationKind }) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const { perguntar, dialogoDePergunta } = usePergunta();
  const navigate = useNavigate();
  const copy = FLOW_KIND_COPY[kind];
  // Dono e equipe (automações por cargo).
  const pode = useCan();
  const ehCorretor = useEhCorretorDeAutomacao();
  const ehGestor = pode('flow_automations', 'update');
  const meId = String(useAuthStore(s => s.currentUser?.id) ?? '');
  const [aba, setAba] = useState<Aba | null>(null);
  const abaAtiva: Aba = aba ?? (ehCorretor ? 'minhas' : 'todas');
  const [automations, setAutomations] = useState<FlowAutomation[]>([]);
  const [folders, setFolders] = useState<FlowAutomationFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null | undefined>(undefined); // undefined = "todas"
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [recusado, setRecusado] = useState(false);
  const [resolvendo, setResolvendo] = useState<FlowAutomation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, fldrs] = await Promise.all([
        flowAutomationsService.list({ search: search || undefined, folderId }),
        ehCorretor ? Promise.resolve([]) : flowAutomationFoldersService.list(),
      ]);
      setAutomations(list);
      setFolders(fldrs);
      setRecusado(false);
    } catch (e) {
      if (isForbiddenError(e)) setRecusado(true);
      else toast.error('Erro ao carregar fluxos');
    } finally {
      setLoading(false);
    }
  }, [search, folderId, ehCorretor]);

  useEffect(() => {
    load();
  }, [load]);

  const openFlow = (flow: Pick<FlowAutomation, 'id'>) => navigate(`${copy.listPath}/${flow.id}`);

  // `team` só vai quando o gestor escolhe (Pessoal = false, Da equipe = true);
  // o corretor cria sempre pessoal e o servidor ignora o parâmetro.
  const handleCreate = async (team?: boolean) => {
    try {
      const created = await flowAutomationsService.create(
        { name: copy.newName, folder_id: folderId ?? null, ...(ehGestor && team !== undefined ? { team } : {}) },
      );
      openFlow(created);
    } catch {
      toast.error('Erro ao criar fluxo');
    }
  };

  // Um botão só (23/10/2026): o gestor escolhe de quem é (padrão Da equipe),
  // o corretor cria a dele direto.
  const [pedido, setPedido] = useState<PedidoDeQuem | null>(null);
  const nova = () => {
    if (!ehGestor) {
      void handleCreate();
      return;
    }
    setPedido({
      titulo: copy.newButton,
      descricao: 'De quem é essa automação?',
      acao: 'Criar',
      inicial: 'equipe',
      equipe: { rotulo: 'Da equipe', descricao: 'Vale pra imobiliária toda. Todo mundo vê, só o gestor edita.' },
      meu: { rotulo: 'Só minha', descricao: 'Roda nos seus leads e sai pelo seu número.' },
      aoConfirmar: team => handleCreate(team),
    });
  };

  // Gestor aplicando modelo: "Da equipe" cria da equipe, "Minhas" cria pessoal;
  // em "Todas"/"Dos corretores" o servidor decide (gestor = equipe). Corretor não passa nada.
  const teamDoModelo = ehGestor ? (abaAtiva === 'equipe' ? true : abaAtiva === 'minhas' ? false : undefined) : undefined;

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

  // Tirar "Da equipe" muda de quem são os leads e por qual WhatsApp sai: pergunta
  // antes. A lista fica com o que o servidor devolveu (sem dono, a automação
  // passa a ser de quem tirou).
  const markTeam = async (a: FlowAutomation, next: boolean): Promise<boolean> => {
    if (!next && !(await confirmar(tirarDaEquipe(a, meId)))) return false;
    try {
      const atualizada = await flowAutomationsService.update(a.id, { team: next });
      setAutomations(list => list.map(x => (x.id === a.id ? { ...x, ...atualizada } : x)));
      toast.success(next ? `"${a.name}" agora é da equipe: todo mundo vê.` : `"${a.name}" saiu da equipe.`);
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
    } catch (e) {
      toast.error(serverMessage(e, 'Erro ao arquivar'));
    }
  };

  const destroy = async (a: FlowAutomation) => {
    if (!(await confirmar({
      titulo: 'Excluir automação',
      descricao: <>Excluir <strong>{a.name}</strong>? Essa ação não pode ser desfeita.</>,
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    try {
      await flowAutomationsService.destroy(a.id);
      toast.success('Fluxo removido');
      load();
    } catch (e) {
      toast.error(serverMessage(e, 'Erro ao remover'));
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
          aDireita={(
            <Button variant="outline" onClick={() => setTemplatesOpen(true)}><LayoutTemplate className="h-4 w-4 mr-1" /> Modelos</Button>
          )}
          primaryAction={{
            label: copy.newButton,
            icon: <Plus className="h-4 w-4" />,
            onClick: nova,
          }}
        />
      }
    >
      {comAbas && (
        <Abas
          rotulo="Automações"
          ativa={abaAtiva}
          aoTrocar={chave => setAba(chave as Aba)}
          abas={abas}
        />
      )}

      {!ehCorretor && folderId === undefined && (
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

      {!loading && automations.length === 0 && !search && (
        <div className="flex flex-col items-center">
          <EmptyState
            icon={Zap}
            title={copy.emptyTitle}
            description={copy.emptyDescription}
            className="pb-6"
          />
          <FlowTemplateList onApplied={openFlow} team={teamDoModelo} className="w-full max-w-xl" />
        </div>
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
          const canMarkTeam = a.permissions?.can_mark_team === true;
          const daEquipe = !isPersonalFlow(a);
          const presa = presaNaEquipe(a);
          const gatilho = triggerEvents(normalizeTrigger(a.trigger)).length ? flowTriggerSummary(normalizeTrigger(a.trigger)) : 'Sem gatilho definido';
          // Cartão único (23/10/2026): "Da equipe" aparece uma vez, como selo; o
          // estado é o filete e o ligar/desligar (sem selo ATIVO/DESLIGADO). À
          // vista só ligar/desligar e Editar; o resto mora no ⋮.
          return (
          <CartaoDeFluxo
            key={a.id}
            titulo={a.name}
            aoAbrir={() => openFlow(a)}
            estado={a.archived_at ? 'arquivado' : a.is_enabled ? 'ligado' : 'desligado'}
            selos={
              <>
                {daEquipe && (
                  <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                    <Users className="h-3 w-3" aria-hidden="true" /> Da equipe
                  </Badge>
                )}
                {dosCorretores(a) && a.owner_name && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">{`De ${a.owner_name}`}</Badge>
                )}
                {a.archived_at && <Badge variant="secondary" className="shrink-0 text-[10px]">Arquivada</Badge>}
              </>
            }
            linha={<span className="block truncate" title={gatilho}>{gatilho}</span>}
            acoes={
              <div className="flex w-full items-center gap-1">
                {canEdit ? (
                  <>
                    <IconActionButton
                      label={a.is_enabled ? 'Desligar' : 'Ligar'}
                      icon={a.is_enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => void toggle(a)}
                    />
                    <IconActionButton
                      label="Editar"
                      icon={<Pencil className="h-4 w-4" />}
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openFlow(a)}
                    />
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => openFlow(a)}>Ver</Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <BotaoMaisAcoes compacto className="ml-auto" aria-label={`Mais ações de ${a.name}`} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-w-72">
                    <DropdownMenuItem onClick={() => void duplicate(a)}>
                      <Copy className="h-4 w-4" /> {canEdit ? 'Duplicar' : 'Duplicar pra ter a sua cópia'}
                    </DropdownMenuItem>
                    {canEdit && (
                      <DropdownMenuItem onClick={() => void archive(a)}>
                        <Archive className="h-4 w-4" /> Arquivar
                      </DropdownMenuItem>
                    )}
                    {canMarkTeam && (
                      <DropdownMenuItem disabled={presa} onClick={() => { if (!presa) void markTeam(a, !daEquipe); }} className="items-start">
                        {daEquipe ? <UserMinus className="h-4 w-4 mt-0.5" /> : <Users className="h-4 w-4 mt-0.5" />}
                        <span>
                          {daEquipe ? 'Tirar da equipe' : 'Passar pra equipe'}
                          {presa && <span className="mt-0.5 block text-xs text-muted-foreground">{numeroFixoNaEquipe(a)}</span>}
                        </span>
                      </DropdownMenuItem>
                    )}
                    {canEdit && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => void destroy(a)}>
                          <Trash2 className="h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          >
            {(a.paused_other_number_count ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-400" data-pausados>
                <span>{textoDePausados(a.paused_other_number_count ?? 0)}</span>
                {canEdit && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setResolvendo(a)}>Resolver</Button>
                )}
              </div>
            )}
          </CartaoDeFluxo>
          );
        })}
      </ul>
    </Pagina>
      {resolvendo && (
        <ResolverPausasDialog
          open
          flowId={resolvendo.id}
          flowName={resolvendo.name}
          count={resolvendo.paused_other_number_count ?? 0}
          canAlways
          onClose={() => setResolvendo(null)}
          onResolved={() => void load()}
        />
      )}
      {pedido && <JanelaDeQuemE pedido={pedido} aoFechar={() => setPedido(null)} />}
      <FlowTemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} onApplied={openFlow} team={teamDoModelo} />
      {dialogoDeConfirmacao}
      {dialogoDePergunta}
    </>
  );
}
