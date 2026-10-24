import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Archive, Copy, Pause, Pencil, Pin, Play, Plus, Repeat, Star, Trash2 } from 'lucide-react';
import {
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import { BaseHeader, Pagina } from '@/components/base';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
import Chave from '@/components/base/Chave';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import EmptyState from '@/components/base/EmptyState';
import IconActionButton from '@/components/base/IconActionButton';
import { CartaoDeFluxo } from '@/components/flowAutomations/CartaoDeFluxo';
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
// mensagem. Mesmo título e mesmo cartão (CartaoDeFluxo) da aba Manual (22/10). Uma lista só (sem abas internas), em seções:
//
// - "Da equipe": os da imobiliária toda. Follow-up sem dono (todos os de antes
//   da Fase 3) também é da equipe. Só o gestor edita.
// - "Meus": os meus, que não são da equipe. O corretor edita no modo guiado.
// - "Dos corretores" (só o gestor): os pessoais de outra pessoa, com o nome.
//
// Por item (23/10/2026, pedido do dono): a ESTRELA ao lado do estado é o
// padrão da conta (cheia = é o padrão; vazia, só pro gestor e só nos da equipe
// ligados = "Tornar padrão da conta"). O ALFINETE é o "Meu padrão" (o follow-up
// que começa quando EU mando o lead pra coluna Follow-up): dois símbolos pra
// duas marcas, nada de duas estrelas. À vista só alfinete, ligar/desligar e
// lápis (Ver, pra quem não edita); Duplicar, Arquivar e Excluir moram no ⋮.
// Quem pode o quê vem do servidor (`permissions`); a tela só esconde o que ele recusaria.
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

  // "Da equipe" (gestor). Tirar muda de quem são os leads e por qual WhatsApp
  // saem: pergunta antes. Sem dono, quem tira passa a ser o dono (o servidor faz;
  // aqui só espelhamos até o servidor responder). Padrão da conta o servidor recusa
  // (422) e a frase dele aparece como veio. Devolve boolean: a chave volta se não mudou.
  const marcarEquipe = async (f: FlowAutomation, next: boolean): Promise<boolean> => {
    if (!next) {
      const semDono = f.owner_user_id == null || String(f.owner_user_id) === '';
      const deOutro = !semDono && String(f.owner_user_id) !== meId;
      const nomeDoDono = f.owner_name?.trim();
      const deQuem = deOutro ? nomeDoDono || 'quem criou' : 'você';
      const ok = await confirmar({
        titulo: `Tirar "${f.name}" da equipe?`,
        descricao: `Ele passa a ser só de ${deQuem}: a IA e as automações da equipe deixam de usar, e os leads que entrarem saem pelo WhatsApp do dono.`,
        rotuloDaAcao: 'Tirar da equipe',
      });
      if (!ok) return false;
    }
    try {
      const atualizado = await flowAutomationsService.update(f.id, { team: next });
      const semDono = f.owner_user_id == null || String(f.owner_user_id) === '';
      setFollowups(lista => lista.map(x => (
        x.id === f.id
          ? { ...x, team: next, ...(!next && semDono ? { owner_user_id: meId } : {}), ...(atualizado ?? {}) }
          : x
      )));
      toast.success(next ? `"${f.name}" agora é da equipe.` : `"${f.name}" saiu da equipe.`);
      return true;
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra mudar agora. Tente de novo.'));
      return false;
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
    const comAlfinete = secao !== 'corretores';
    // Só ligado (e não arquivado): o servidor recusa o resto.
    const podeTornarPadrao = ehGestor && secao === 'equipe' && f.is_enabled && !f.account_default && !f.archived_at;
    const estado = f.archived_at ? 'Arquivado' : f.is_enabled ? 'Ligado' : 'Desligado';
    const estadoDoCartao = f.archived_at ? 'arquivado' : f.is_enabled ? 'ligado' : 'desligado';
    const gatilho = triggerEvents(normalizeTrigger(f.trigger)).length ? flowTriggerSummary(normalizeTrigger(f.trigger)) : 'Sem gatilho definido';
    return (
      <CartaoDeFluxo
        key={f.id}
        titulo={f.name}
        aoAbrir={() => openFlow(f)}
        estado={estadoDoCartao}
        selos={
          <>
            {secao === 'corretores' && f.owner_name && <Badge variant="outline" className="shrink-0 text-[10px]">{`De ${f.owner_name}`}</Badge>}
            <Badge variant={f.archived_at ? 'secondary' : f.is_enabled ? 'default' : 'outline'} className="shrink-0 text-[10px]">
              {estado}
            </Badge>
            {f.account_default ? (
              <span
                role="img"
                aria-label="Padrão da conta"
                title="Padrão da conta"
                className="inline-flex h-6 w-6 items-center justify-center"
              >
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden="true" />
              </span>
            ) : podeTornarPadrao && (
              <IconActionButton
                label="Tornar padrão da conta"
                icon={<Star className="h-4 w-4" />}
                variant="ghost"
                className="h-6 w-6 text-muted-foreground"
                onClick={() => void tornarPadraoDaConta(f)}
              />
            )}
          </>
        }
        linha={<span className="block truncate" title={gatilho}>{gatilho}</span>}
        acoes={
          <div className="flex w-full flex-wrap items-center gap-1">
            {comAlfinete && (
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
                <Pin className={cn('h-4 w-4', f.my_default && 'fill-primary text-primary')} aria-hidden="true" />
              </Button>
            )}
            {canEdit ? (
              <>
                <IconActionButton
                  label={f.is_enabled ? 'Desligar' : 'Ligar'}
                  icon={f.is_enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => void toggle(f)}
                />
                <IconActionButton
                  label="Editar"
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => openFlow(f)}
                />
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => openFlow(f)}>Ver</Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <BotaoMaisAcoes compacto className="ml-auto" aria-label={`Mais ações de ${f.name}`} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => pedirDuplicar(f)}>
                  <Copy className="h-4 w-4" /> {canEdit ? 'Duplicar' : 'Duplicar pra ter a sua cópia'}
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => void archive(f)}>
                      <Archive className="h-4 w-4" /> Arquivar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => void destroy(f)}>
                      <Trash2 className="h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {ehGestor && (
              <div className="w-full">
                <Chave rotulo="Da equipe" ligada={followupDaEquipe(f)} aoMudar={next => marcarEquipe(f, next)} semAviso />
              </div>
            )}
          </div>
        }
      />
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
