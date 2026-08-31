import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, PauseCircle, PlayCircle, StopCircle, Rocket, CheckCircle2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';
import {
  leadFollowupService,
  EMPTY_LEAD_FOLLOWUP_STATE,
  httpStatusOf,
  serverErrorOf,
  type LeadFollowupJob,
  type LeadFollowupState,
  type LeadRef,
} from '@/services/leadFollowup/leadFollowupService';

/**
 * O bloco de FOLLOW-UP do card: o estado real do lead e a linha do tempo dos
 * passos, num componente só.
 *
 * Por que num só: o selo ("Rodando", "Pausado") e a lista de passos são a MESMA
 * informação lida da MESMA fila. Enquanto o botão morava no painel do card e a
 * lista aqui, os dois liam fontes diferentes — o botão olhava a etiqueta
 * `follow-up` da conversa, a lista olhava a fila — e discordavam na cara do
 * corretor: sete mensagens agendadas embaixo de um botão escrito "Ativar
 * follow-up".
 *
 * A etiqueta nunca serviu pra responder isso. Ela é UM dos gatilhos de entrada:
 * quem entra pelo arrasto do card, ou pela etiqueta de tráfego pago, nunca a
 * recebe — e quem responde a perde, com a fila ainda cheia. Hoje quem responde
 * "está em follow-up?" é o servidor, olhando a fila.
 */

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  pending:   { label: 'Agendado',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  paused:    { label: 'Pausado',   cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', dot: 'bg-sky-500' },
  sent:      { label: 'Enviado',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', dot: 'bg-gray-400' },
  failed:    { label: 'Falhou',    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
};

const HEADLINE: Record<LeadFollowupState['status'], { label: string; cls: string }> = {
  running: { label: 'Rodando',        cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  paused:  { label: 'Pausado',        cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  done:    { label: 'Funil concluído', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  idle:    { label: 'Sem follow-up',  cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

const fmt = (s: number | null | undefined) =>
  s ? new Date(s * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * A prévia mostra o texto do funil, que tem VARIÁVEIS dentro ({{nome}}). Cru,
 * o card mostrava `Oi {{nome}}, tudo bem?` — que não é o que o lead recebe e
 * fazia parecer que a mensagem ia sair quebrada. Aqui elas viram o nome do lead
 * quando ele é conhecido, e um marcador legível quando não é.
 *
 * Isto é SÓ a prévia. Quem troca as variáveis de verdade, na hora de enviar, é o
 * servidor — inventar a substituição aqui é o mesmo erro do exemplo de etiqueta
 * do editor de funil, que passou a vir pronto do backend justamente por isso.
 */
const preview = (content: string | undefined, leadName?: string | null) => {
  if (!content) return '';
  const first = (leadName || '').trim().split(/\s+/)[0] || '';
  return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const k = key.toLowerCase();
    if ((k === 'nome' || k === 'name' || k === 'primeiro_nome') && first) return first;
    return '…';
  });
};

interface Props extends LeadRef {
  /** Só pra prévia do texto — nunca é enviado ao servidor. */
  leadName?: string | null;
  /** Somente leitura: cargo sem permissão de mexer no card. */
  readOnly?: boolean;
}

export default function FollowupTimeline({ contactId, conversationId, leadName, readOnly }: Props) {
  const [jobs, setJobs] = useState<LeadFollowupJob[]>([]);
  const [state, setState] = useState<LeadFollowupState>(EMPTY_LEAD_FOLLOWUP_STATE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [chosenSlug, setChosenSlug] = useState('');

  const ref = useMemo<LeadRef>(() => ({ contactId, conversationId }), [contactId, conversationId]);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    if (!contactId && !conversationId) { setLoading(false); return; }
    try {
      const payload = await leadFollowupService.get(ref);
      if (!alive.current) return;
      setJobs(payload.jobs);
      setState(payload.state);
      setDenied(false);
    } catch (e: unknown) {
      if (!alive.current) return;
      // 403 é o cargo sem a permissão, e precisa aparecer: engolir o erro e
      // mostrar "sem passos agendados" foi o que fez a linha do tempo parecer
      // vazia pra corretor e gestor em cliente antigo, com a fila cheia.
      setDenied(httpStatusOf(e) === 403);
      setJobs([]);
      setState(EMPTY_LEAD_FOLLOWUP_STATE);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [ref, contactId, conversationId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Semeia a escolha do funil com o que já estava rodando neste lead, uma vez:
  // `prev || ...` preserva a troca feita à mão enquanto o bloco recarrega.
  const runningSlug = state.sequence?.slug;
  useEffect(() => {
    if (!runningSlug) return;
    setChosenSlug(prev => prev || runningSlug);
  }, [runningSlug]);

  const run = useCallback(async (
    action: 'start' | 'pause' | 'resume' | 'stop',
    fallbackMsg: string,
  ) => {
    setBusy(true);
    try {
      const result = action === 'start'
        ? await leadFollowupService.start(ref, chosenSlug || undefined)
        : await leadFollowupService[action](ref);
      if (!alive.current) return;
      setState(result.state);
      toast.success(result.message || fallbackMsg);
      // Recarrega a lista da MESMA fonte do estado: a ação devolve só o resumo,
      // e deixar a lista velha embaixo de um selo novo recria a discordância
      // que este bloco veio matar.
      await load();
    } catch (e: unknown) {
      const msg = serverErrorOf(e)
        || (httpStatusOf(e) === 403 ? 'Seu cargo não permite mexer no follow-up deste lead.' : null)
        || 'Não consegui falar com o servidor. Tente de novo.';
      toast.error(msg);
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [ref, chosenSlug, load]);

  const visibleJobs = useMemo(
    () => jobs.filter(j => showCancelled || j.status !== 'cancelled'),
    [jobs, showCancelled],
  );
  const cancelledCount = useMemo(() => jobs.filter(j => j.status === 'cancelled').length, [jobs]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando follow-up…
      </div>
    );
  }

  if (denied) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Seu cargo não dá acesso ao follow-up deste lead. Peça a um administrador para liberar o
        acesso ao funil de vendas.
      </p>
    );
  }

  const headline = HEADLINE[state.status] ?? HEADLINE.idle;
  const canAct = !readOnly;
  const stepLabel = state.total_steps
    ? `${Math.min(state.sent_count, state.total_steps)} de ${state.total_steps} mensagens`
    : `${state.sent_count} mensagem(ns) enviada(s)`;

  return (
    <div className="space-y-2">
      {/* Estado — o que está acontecendo AGORA com este lead. */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${headline.cls}`}>
          {headline.label}
        </span>
        {state.sequence?.name && (
          <span className="text-xs font-medium text-foreground">{state.sequence.name}</span>
        )}
        {(state.status === 'running' || state.status === 'paused' || state.status === 'done') && (
          <span className="text-[10px] text-muted-foreground">{stepLabel}</span>
        )}
      </div>

      {state.status === 'running' && state.next_run_at && (
        <p className="text-[10px] text-muted-foreground">
          Próxima mensagem em <span className="font-medium text-foreground">{fmt(state.next_run_at)}</span>
        </p>
      )}
      {state.status === 'paused' && (
        <p className="text-[10px] text-muted-foreground">
          {state.queued_count} mensagem(ns) seguram na fila. Ao retomar, os horários são empurrados
          pelo tempo que ficou parado — nada sai de uma vez só.
        </p>
      )}
      {state.status === 'done' && (
        <p className="text-[10px] text-muted-foreground">
          O lead recebeu todas as mensagens deste funil. Iniciar de novo só manda algo se você
          escolher outro funil.
        </p>
      )}

      {/* Comandos. Só aparecem quando o servidor diz que valem. */}
      {canAct && (
        <div className="flex items-center gap-2 flex-wrap">
          {state.can_pause && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={busy}
              onClick={() => run('pause', 'Follow-up pausado')}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
              Pausar
            </Button>
          )}
          {state.can_resume && (
            <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" disabled={busy}
              onClick={() => run('resume', 'Follow-up retomado')}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
              Retomar
            </Button>
          )}
          {state.can_stop && (
            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5" disabled={busy}
              onClick={() => run('stop', 'Follow-up parado')}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />}
              Parar
            </Button>
          )}

          {/* Iniciar só quando não há nada rolando: começar por cima de um funil
              vivo cancela a fila dele e reagenda tudo — surpresa que o corretor
              não pediu. Com follow-up rodando, o caminho é Parar e começar. */}
          {!state.can_stop && (
            state.sequences.length > 0 ? (
              <>
                {state.sequences.length > 1 && (
                  <select
                    className="h-7 text-xs rounded-md border border-border bg-background px-2 max-w-[180px]"
                    value={chosenSlug}
                    disabled={busy}
                    onChange={e => setChosenSlug(e.target.value)}
                  >
                    <option value="">Escolha o funil…</option>
                    {state.sequences.map(s => (
                      <option key={s.slug} value={s.slug}>
                        {s.name} ({s.steps_count} msg)
                      </option>
                    ))}
                  </select>
                )}
                <Button size="sm" variant="default" className="h-7 text-xs gap-1.5"
                  disabled={busy || (state.sequences.length > 1 && !chosenSlug)}
                  onClick={() => run('start', 'Follow-up iniciado')}>
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                  Iniciar follow-up
                </Button>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Nenhum funil de follow-up ativo. Crie e ative um em <em>Automações → Follow-up</em>.
              </p>
            )
          )}
        </div>
      )}

      {/* Linha do tempo dos passos. */}
      <div className="pt-1.5 border-t border-border/60">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Linha do tempo
          </p>
          {cancelledCount > 0 && (
            <button type="button" onClick={() => setShowCancelled(v => !v)}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              {showCancelled ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {cancelledCount} cancelado(s)
            </button>
          )}
        </div>

        {visibleJobs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Nenhuma mensagem de follow-up para este lead ainda.
          </p>
        ) : (
          <ol className="space-y-2">
            {visibleJobs.map((j, i) => {
              const st = STATUS[j.status] || STATUS.pending;
              const when = j.status === 'sent' ? j.executed_at : j.run_at;
              return (
                <li key={j.id} className="flex gap-2">
                  <div className="flex flex-col items-center">
                    <span className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
                    {i < visibleJobs.length - 1 && <span className="w-px flex-1 bg-border my-0.5" />}
                  </div>
                  <div className="flex-1 -mt-0.5 pb-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground">
                        Passo {j.step?.position ?? i + 1}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{fmt(when)}</span>
                    </div>
                    {j.step?.content && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 break-words">
                        {preview(j.step.content, leadName)}
                      </p>
                    )}
                    {j.last_error && j.status === 'failed' && (
                      <p className="text-[10px] text-red-500 mt-0.5 break-words">{j.last_error}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {state.status === 'done' && (
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Funil concluído.
          </p>
        )}
      </div>
    </div>
  );
}
