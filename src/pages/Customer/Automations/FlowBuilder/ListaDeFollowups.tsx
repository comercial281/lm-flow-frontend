import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Archive, Copy, Pause, Pencil, Play, Plus, Repeat, Star, Trash2 } from 'lucide-react';
import {
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/ds';
import { BaseHeader, Pagina } from '@/components/base';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import EmptyState from '@/components/base/EmptyState';
import { LegacyFollowupStrip } from '@/components/flowAutomations/LegacyFollowupStrip';
import NoAccessState from '@/components/permissions/NoAccessState';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import { isForbiddenError } from '@/services/core/forbidden';
import type { FlowAutomation } from '@/types/flowAutomations';
import { FLOW_KIND_COPY } from '@/features/flowAutomations/kind';
import { flowTriggerSummary, normalizeTrigger, triggerEvents } from '@/features/flowAutomations/trigger';
import { enableProblem } from '@/features/flowAutomations/readiness';
import { serverMessage } from '@/features/flowAutomations/guide';
import { avisoLeadsSaindo, leadsDentro, pedidoDesligarFollowup } from '@/features/flowAutomations/desligarFollowup';
import { useAuthStore } from '@/store/authStore';
import { useCan } from '@/hooks/useCan';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { cn } from '@/lib/utils';

// FOLLOW-UP POR USUÁRIO (Fase 3, 21/10/2026): a aba Follow-up de Funis de
// mensagem. Uma lista só (sem abas internas), em seções:
//
// - "Da equipe": os da imobiliária toda. Follow-up sem dono (todos os de antes
//   da Fase 3) também é da equipe. Só o gestor edita.
// - "Meus": os meus, que não são da equipe. O corretor edita no modo guiado.
// - "Dos corretores" (só o gestor): os pessoais de outra pessoa, com o nome.
//
// Por item: Editar/Ver, Duplicar, a estrela "Meu padrão" (o follow-up que
// começa quando EU mando o lead pra coluna Follow-up), o selo "Padrão da conta"
// e, só pro gestor e só nos da equipe, "Tornar padrão da conta". Quem pode o
// quê vem do servidor (`permissions`); a tela só esconde o que ele recusaria.
//
// "Novo follow-up" nasce do modelo "Follow-up padrão" (o servidor monta). O
// gestor escolhe antes se é "Da equipe" ou "Só meu"; o corretor cria o dele direto.

const COPY = FLOW_KIND_COPY.followup;

type DeQuem = 'equipe' | 'meu';

/** Sem dono também é da equipe (mesma regra do servidor, `FollowupAccess.team_flow?`). */
function followupDaEquipe(f: Pick<FlowAutomation, 'team' | 'owner_user_id'>): boolean {
  return f.team === true || f.owner_user_id == null || f.owner_user_id === '';
}

interface PedidoDeQuem {
  titulo: string;
  descricao: string;
  acao: string;
  inicial: DeQuem;
  aoConfirmar: (team: boolean) => Promise<void>;
}

export default function ListaDeFollowups() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const navigate = useNavigate();
  const pode = useCan();
  const meId = String(useAuthStore(s => s.currentUser?.id) ?? '');
  const [followups, setFollowups] = useState<FlowAutomation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [recusado, setRecusado] = useState(false);
  const [pedido, setPedido] = useState<PedidoDeQuem | null>(null);

  // Gestor = quem marca "Da equipe" (o servidor diz em cada follow-up). Sem
  // follow-up na lista, a mesma régua do servidor: a chave das Automações ou a do follow-up.
  const ehGestor = followups.length > 0
    ? followups.some(f => f.permissions?.can_mark_team === true)
    : pode('flow_automations', 'update') || pode('followup_sequences', 'update');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFollowups(await flowAutomationsService.list({ search: search || undefined, kind: 'followup' }));
      setRecusado(false);
    } catch (e) {
      if (isForbiddenError(e)) setRecusado(true);
      else toast.error('Erro ao carregar os follow-ups');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openFlow = (f: Pick<FlowAutomation, 'id'>) => navigate(`${COPY.listPath}/${f.id}`);

  const criar = async (team?: boolean) => {
    try {
      const created = await flowAutomationsService.create({
        name: COPY.newName, kind: 'followup', ...(team !== undefined ? { team } : {}),
      });
      openFlow(created);
    } catch (e) {
      toast.error(serverMessage(e, 'Erro ao criar o follow-up'));
    }
  };

  // Gestor escolhe de quem é (padrão Da equipe); corretor cria o dele, sem mandar `team`.
  const novo = () => {
    if (!ehGestor) {
      void criar();
      return;
    }
    setPedido({
      titulo: 'Novo follow-up',
      descricao: 'Nasce desligado, com as mensagens do modelo "Follow-up padrão". Você ajusta e liga.',
      acao: 'Criar',
      inicial: 'equipe',
      aoConfirmar: team => criar(team),
    });
  };

  const duplicar = async (f: FlowAutomation, team?: boolean) => {
    try {
      const copia = team === undefined
        ? await flowAutomationsService.duplicate(f.id)
        : await flowAutomationsService.duplicate(f.id, { team });
      toast.success(team ? 'Follow-up duplicado.' : 'Follow-up duplicado: a cópia é sua.');
      openFlow(copia);
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra duplicar agora. Tente de novo.'));
    }
  };

  // Gestor escolhe de quem é a cópia, começando como o original; corretor duplica direto (a cópia é dele).
  const pedirDuplicar = (f: FlowAutomation) => {
    if (!ehGestor) {
      void duplicar(f);
      return;
    }
    setPedido({
      titulo: `Duplicar "${f.name}"`,
      descricao: 'A cópia nasce desligada, com as mesmas mensagens. Os leads que estão no original continuam nele.',
      acao: 'Duplicar',
      inicial: followupDaEquipe(f) ? 'equipe' : 'meu',
      aoConfirmar: team => duplicar(f, team),
    });
  };

  const toggle = async (f: FlowAutomation) => {
    try {
      // Ligar confere o fluxo salvo: bloco de modelo com campo em branco não liga.
      if (!f.is_enabled) {
        const full = await flowAutomationsService.get(f.id);
        const problem = enableProblem(normalizeTrigger(full.trigger), full.nodes ?? []);
        if (problem) {
          toast.error(problem);
          return;
        }
      }
      // Desligar com lead dentro pergunta antes, com a contagem (Fase 2).
      if (f.is_enabled && leadsDentro(f) > 0 && !(await confirmar(pedidoDesligarFollowup(f.name, leadsDentro(f))))) return;
      const atualizado = await flowAutomationsService.toggle(f.id);
      const aviso = f.is_enabled ? avisoLeadsSaindo(atualizado.remaining) : null;
      if (aviso) toast.success(aviso);
      void load();
    } catch (e) {
      // Com passo do guia pendente o servidor recusa e diz qual falta.
      toast.error(serverMessage(e, 'Erro ao ligar/desligar'));
    }
  };

  const archive = async (f: FlowAutomation) => {
    try {
      // Arquivar um follow-up ligado também tira os leads de dentro.
      const dentro = f.is_enabled ? leadsDentro(f) : 0;
      if (dentro > 0 && !(await confirmar(pedidoDesligarFollowup(f.name, dentro, 'Arquivar')))) return;
      const arquivado = await flowAutomationsService.archive(f.id);
      const aviso = dentro > 0 ? avisoLeadsSaindo(arquivado.remaining) : null;
      if (aviso) toast.success(aviso.replace('Desligado.', 'Arquivado.'));
      void load();
    } catch (e) {
      toast.error(serverMessage(e, 'Erro ao arquivar'));
    }
  };

  const destroy = async (f: FlowAutomation) => {
    if (!(await confirmar({
      titulo: 'Excluir follow-up',
      descricao: <>Excluir <strong>{f.name}</strong>? Essa ação não pode ser desfeita.</>,
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    try {
      await flowAutomationsService.destroy(f.id);
      toast.success('Follow-up excluído');
      void load();
    } catch (e) {
      // Com lead dentro o servidor recusa e diz quantos ("Desligue antes de apagar").
      toast.error(serverMessage(e, 'Erro ao excluir'));
    }
  };

  // "Meu padrão": só um por pessoa. Marcar apaga a estrela do anterior.
  const marcarMeuPadrao = async (f: FlowAutomation) => {
    const on = f.my_default !== true;
    try {
      const atualizado = await flowAutomationsService.myDefault(f.id, on);
      const marcado = atualizado.my_default ?? on;
      setFollowups(lista => lista.map(x => (
        x.id === f.id ? { ...x, my_default: marcado } : marcado ? { ...x, my_default: false } : x
      )));
      toast.success(marcado ? `"${f.name}" é o seu padrão.` : `"${f.name}" deixou de ser o seu padrão.`);
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra marcar agora. Tente de novo.'));
    }
  };

  // Padrão da conta: só um na conta. O selo muda de lugar.
  const tornarPadraoDaConta = async (f: FlowAutomation) => {
    try {
      await flowAutomationsService.accountDefault(f.id);
      setFollowups(lista => lista.map(x => ({ ...x, account_default: x.id === f.id })));
      toast.success(`"${f.name}" agora é o padrão da conta.`);
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra trocar agora. Tente de novo.'));
    }
  };

  const secoes = useMemo(() => {
    const daEquipe = followups.filter(followupDaEquipe);
    const pessoais = followups.filter(f => !followupDaEquipe(f));
    return {
      equipe: daEquipe,
      meus: pessoais.filter(f => String(f.owner_user_id) === meId),
      corretores: pessoais.filter(f => String(f.owner_user_id) !== meId),
    };
  }, [followups, meId]);

  if (recusado) return <NoAccessState />;

  const item = (f: FlowAutomation, secao: 'equipe' | 'meus' | 'corretores') => {
    const canEdit = f.permissions ? f.permissions.can_edit === true : ehGestor;
    const comEstrela = secao !== 'corretores';
    // Só ligado (e não arquivado): o servidor recusa o resto.
    const podeTornarPadrao = ehGestor && secao === 'equipe' && f.is_enabled && !f.account_default && !f.archived_at;
    const estado = f.archived_at ? 'Arquivado' : f.is_enabled ? 'Ligado' : 'Desligado';
    return (
      <li key={f.id} className="rounded-lg border border-border overflow-hidden flex">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: f.archived_at ? '#94a3b8' : f.is_enabled ? '#059669' : '#dc2626' }} />
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <button type="button" className="text-sm font-semibold truncate hover:underline text-left" onClick={() => openFlow(f)}>
              {f.name}
            </button>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {f.account_default && <Badge variant="secondary" className="shrink-0 text-[10px]">Padrão da conta</Badge>}
              {secao === 'corretores' && f.owner_name && <Badge variant="outline" className="shrink-0 text-[10px]">{`De ${f.owner_name}`}</Badge>}
              <Badge variant={f.archived_at ? 'secondary' : f.is_enabled ? 'default' : 'outline'} className="shrink-0 text-[10px]">
                {estado}
              </Badge>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mb-3 truncate" title={flowTriggerSummary(normalizeTrigger(f.trigger))}>
            {triggerEvents(normalizeTrigger(f.trigger)).length ? flowTriggerSummary(normalizeTrigger(f.trigger)) : 'Sem gatilho definido'}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {comEstrela && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label="Meu padrão"
                aria-pressed={f.my_default === true}
                title={f.my_default ? 'Seu padrão: clique pra desmarcar' : 'Marcar como meu padrão'}
                onClick={() => void marcarMeuPadrao(f)}
              >
                <Star className={cn('h-4 w-4', f.my_default && 'fill-amber-400 text-amber-500')} aria-hidden="true" />
              </Button>
            )}
            {canEdit ? (
              <>
                <Button size="sm" variant="outline" onClick={() => openFlow(f)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void toggle(f)} title={f.is_enabled ? 'Desligar' : 'Ligar'}>
                  {f.is_enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => pedirDuplicar(f)} title="Duplicar" aria-label="Duplicar">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void archive(f)} title="Arquivar">
                  <Archive className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void destroy(f)} title="Excluir">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => openFlow(f)}>Ver</Button>
                <Button size="sm" variant="ghost" onClick={() => pedirDuplicar(f)} title="Duplicar pra ter a sua cópia" aria-label="Duplicar pra ter a sua cópia">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {podeTornarPadrao && (
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void tornarPadraoDaConta(f)}>
                Tornar padrão da conta
              </Button>
            )}
          </div>
        </div>
      </li>
    );
  };

  const secao = (chave: 'equipe' | 'meus' | 'corretores', titulo: string, vazio: string) => (
    <section aria-label={titulo} className="mb-6">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <span className="text-xs text-muted-foreground">{secoes[chave].length}</span>
      </div>
      {secoes[chave].length === 0 ? (
        <EmptyState tamanho="compacto" title={vazio} />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-label={titulo}>
          {secoes[chave].map(f => item(f, chave))}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <Pagina
        rolagem="conteudo"
        cabecalho={
          <BaseHeader
            title={COPY.title}
            subtitle={COPY.description}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={COPY.searchPlaceholder}
            primaryAction={{ label: COPY.newButton, icon: <Plus className="h-4 w-4" />, onClick: novo }}
          />
        }
      >
        <LegacyFollowupStrip />

        {!loading && followups.length === 0 && !search && (
          <EmptyState
            icon={Repeat}
            title={COPY.emptyTitle}
            description={COPY.emptyDescription}
            action={{ label: COPY.newButton, onClick: novo }}
          />
        )}
        {!loading && followups.length === 0 && search && (
          <EmptyState tipo="semResultado" aoLimparFiltros={() => setSearch('')} />
        )}

        {followups.length > 0 && (
          <div className="overflow-auto">
            {secao('equipe', 'Da equipe', 'Nenhum follow-up da equipe.')}
            {secao('meus', 'Meus', 'Você ainda não tem follow-up seu. Crie em "Novo follow-up" ou duplique um da equipe.')}
            {ehGestor && secao('corretores', 'Dos corretores', 'Nenhum corretor tem follow-up próprio.')}
          </div>
        )}
      </Pagina>
      {pedido && <JanelaDeQuemE pedido={pedido} aoFechar={() => setPedido(null)} />}
      {dialogoDeConfirmacao}
    </>
  );
}

/** A escolha do gestor ao criar ou duplicar: "Da equipe" ou "Só meu". */
function JanelaDeQuemE({ pedido, aoFechar }: { pedido: PedidoDeQuem; aoFechar: () => void }) {
  const [deQuem, setDeQuem] = useState<DeQuem>(pedido.inicial);
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    setSalvando(true);
    try {
      await pedido.aoConfirmar(deQuem === 'equipe');
    } finally {
      setSalvando(false);
      aoFechar();
    }
  };

  return (
    <Dialog open onOpenChange={aberta => { if (!aberta && !salvando) aoFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pedido.titulo}</DialogTitle>
          <DialogDescription>{pedido.descricao}</DialogDescription>
        </DialogHeader>
        <CartoesDeEscolha<DeQuem>
          rotulo="De quem é"
          valor={deQuem}
          aoEscolher={setDeQuem}
          opcoes={[
            { valor: 'equipe', rotulo: 'Da equipe', descricao: 'Todo mundo usa nos leads. Só o gestor edita.' },
            { valor: 'meu', rotulo: 'Só meu', descricao: 'Só você usa, nos seus leads.' },
          ]}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={() => void confirmar()} disabled={salvando}>{pedido.acao}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
