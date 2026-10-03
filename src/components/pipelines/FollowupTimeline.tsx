import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, StopCircle, Rocket, ChevronDown, ChevronRight } from 'lucide-react';
import { plural } from '@/lib/formato';
import { toast } from 'sonner';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import {
  leadFollowupService,
  EMPTY_LEAD_FOLLOWUP_STATE,
  httpStatusOf,
  serverErrorOf,
  type LeadFollowupJob,
  type LeadFollowupState,
  type LeadRef,
} from '@/services/leadFollowup/leadFollowupService';
import { flowAutomationInstancesService, type RunningFlow } from '@/services/flowAutomations/flowAutomationInstancesService';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation } from '@/types/flowAutomations';
import { linhaDoFluxo, linhaDoFollowup } from '@/features/conversas/automacaoRodando';

/**
 * O bloco de FOLLOW-UP do card (Automações · sprint 3, 03/10/2026).
 *
 * O follow-up virou um fluxo do construtor (aba Follow-up). Aqui o card mostra:
 *
 * - cada fluxo de follow-up rodando pra este lead, com a MESMA linha da faixa da
 *   conversa ("Follow-up "X" · aguardando resposta até…") e **Parar**;
 * - a fila de um funil antigo, se o lead ainda está terminando nele (formato
 *   antigo), também só com **Parar**;
 * - sem nada rodando, **Iniciar**: escolhe um dos follow-ups ligados.
 *
 * Pausar e Retomar saíram (decisão do Tony, 02–03/10). O estado continua vindo
 * do servidor, nunca de etiqueta: a lição de 31/08 (o botão lia a etiqueta e a
 * lista lia a fila, e as duas discordavam na tela).
 */

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  pending:   { label: 'Agendado',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  paused:    { label: 'Pausado',   cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', dot: 'bg-sky-500' },
  sent:      { label: 'Enviado',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', dot: 'bg-gray-400' },
  failed:    { label: 'Falhou',    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
};

const RUNNING = { label: 'Rodando', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
const IDLE = { label: 'Sem follow-up', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };

const fmt = (s: number | null | undefined) =>
  s ? new Date(s * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * A prévia do funil antigo mostra o texto com VARIÁVEIS dentro ({{nome}}). Aqui
 * elas viram o nome do lead quando ele é conhecido, e um marcador legível
 * quando não é. Só a prévia: quem troca de verdade é o servidor.
 */
const preview = (content: string | undefined, leadName?: string | null) => {
  if (!content) return '';
  const first = (leadName || '').trim().split(/\s+/)[0] || '';
  return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const k = key.toLowerCase();
    if ((k === 'nome' || k === 'name' || k === 'primeiro_nome' || k === 'first_name') && first) return first;
    return '…';
  });
};

interface Props extends LeadRef {
  /** Só pra prévia do texto — nunca é enviado ao servidor. */
  leadName?: string | null;
  /** Somente leitura: cargo sem permissão de mexer no card. */
  readOnly?: boolean;
  /** A coluna fixa do card do lead. O bloco já é de uma linha por follow-up; fica pela compatibilidade. */
  compacto?: boolean;
}

const failMessage = (e: unknown) =>
  serverErrorOf(e)
  || (httpStatusOf(e) === 403 ? 'Seu cargo não permite mexer no follow-up deste lead.' : null)
  || 'Não consegui falar com o servidor. Tente de novo.';

export default function FollowupTimeline({ contactId, conversationId, leadName, readOnly }: Props) {
  const [flows, setFlows] = useState<RunningFlow[]>([]);
  const [legacyJobs, setLegacyJobs] = useState<LeadFollowupJob[]>([]);
  const [legacy, setLegacy] = useState<LeadFollowupState>(EMPTY_LEAD_FOLLOWUP_STATE);
  const [options, setOptions] = useState<FlowAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [chosenId, setChosenId] = useState('');

  const ref = useMemo<LeadRef>(() => ({ contactId, conversationId }), [contactId, conversationId]);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    if (!contactId && !conversationId) { setLoading(false); return; }
    const [running, old] = await Promise.allSettled([
      flowAutomationInstancesService.running(ref),
      leadFollowupService.get(ref),
    ]);
    if (!alive.current) return;
    setFlows(running.status === 'fulfilled' ? running.value.filter(f => f.kind === 'followup' && f.active) : []);
    setLegacyJobs(old.status === 'fulfilled' ? old.value.jobs : []);
    setLegacy(old.status === 'fulfilled' ? old.value.state : EMPTY_LEAD_FOLLOWUP_STATE);
    // 403 é o cargo sem a permissão, e precisa aparecer: engolir o erro e
    // mostrar "sem follow-up" foi o que fez a linha do tempo parecer vazia pra
    // corretor e gestor com a fila cheia.
    const recusado = (r: PromiseSettledResult<unknown>) => r.status === 'rejected' && httpStatusOf(r.reason) === 403;
    setDenied(recusado(running) && recusado(old));
    setLoading(false);
  }, [ref, contactId, conversationId]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  // Os follow-ups que dá pra iniciar: os ligados. Falha = lista vazia.
  useEffect(() => {
    if (readOnly) return undefined;
    let vivo = true;
    flowAutomationsService.list({ kind: 'followup' })
      .then(list => { if (vivo) setOptions(list.filter(f => f.is_enabled && !f.archived_at)); })
      .catch(() => { if (vivo) setOptions([]); });
    return () => { vivo = false; };
  }, [readOnly]);

  const act = useCallback(async (fn: () => Promise<{ message?: string }>, fallbackMsg: string) => {
    setBusy(true);
    try {
      const result = await fn();
      if (!alive.current) return;
      toast.success(result.message || fallbackMsg);
      // Recarrega da MESMA fonte: a ação não devolve a lista.
      await load();
    } catch (e: unknown) {
      toast.error(failMessage(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [load]);

  const legacyLine = linhaDoFollowup(legacy);
  const running = flows.length > 0 || !!legacyLine;
  const chosen = options.length === 1 ? options[0].id : chosenId;

  const visibleJobs = useMemo(
    () => legacyJobs.filter(j => showCancelled || j.status !== 'cancelled'),
    [legacyJobs, showCancelled],
  );
  const cancelledCount = useMemo(() => legacyJobs.filter(j => j.status === 'cancelled').length, [legacyJobs]);

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

  const canAct = !readOnly;
  const headline = running ? RUNNING : IDLE;

  const stopButton = (onClick: () => void, label: string) => (
    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 shrink-0" disabled={busy} onClick={onClick} aria-label={label}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />}
      Parar
    </Button>
  );

  const legacyTimeline = (
    <div className="pt-1.5 border-t border-border/60">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Linha do tempo</p>
        {cancelledCount > 0 && (
          <button type="button" onClick={() => setShowCancelled(v => !v)}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
            {showCancelled ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {plural(cancelledCount, 'cancelado', 'cancelados')}
          </button>
        )}
      </div>
      {visibleJobs.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Nenhuma mensagem do formato antigo pra este lead.</p>
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
                    <span className="text-xs font-medium text-foreground">Passo {j.step?.position ?? i + 1}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
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
    </div>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${headline.cls}`}>{headline.label}</span>
        {legacyJobs.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="ml-auto text-xs text-primary hover:underline">Ver mensagens</button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 max-h-96 overflow-y-auto space-y-2">
              {legacy.sequence?.name && (
                <p className="text-xs font-medium text-foreground">{legacy.sequence.name} (formato antigo)</p>
              )}
              {legacyTimeline}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Uma linha por follow-up rodando: a mesma da faixa da conversa. */}
      {flows.map(flow => (
        <div key={flow.id} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-xs text-muted-foreground line-clamp-2">
            {linhaDoFluxo(flow).texto}
            {flow.progress_step ? <span className="text-[10px]"> · mensagem {flow.progress_step} enviada</span> : null}
          </span>
          {canAct && stopButton(
            () => void act(() => flowAutomationInstancesService.stop(flow.id), 'Follow-up parado'),
            `Parar o follow-up ${flow.flow_name ?? ''}`.trim(),
          )}
        </div>
      ))}

      {legacyLine && (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-xs text-muted-foreground line-clamp-2">
            {legacyLine.texto} <span className="text-[10px] uppercase tracking-wide">· formato antigo</span>
          </span>
          {canAct && legacy.can_stop && stopButton(
            () => void act(async () => ({ message: (await leadFollowupService.stop(ref)).message }), 'Follow-up parado'),
            'Parar o follow-up do formato antigo',
          )}
        </div>
      )}

      {/* Iniciar só com nada rodando: começar por cima mandaria mensagem em dobro. */}
      {canAct && !running && (
        options.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            {options.length > 1 && (
              <Seletor
                className="h-7 text-xs rounded-md border border-border bg-background px-2 max-w-[200px]"
                value={chosenId}
                disabled={busy}
                onChange={e => setChosenId(e.target.value)}
                aria-label="Qual follow-up"
              >
                <option value="">Escolha o follow-up…</option>
                {options.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Seletor>
            )}
            <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" disabled={busy || !chosen}
              onClick={() => void act(() => flowAutomationInstancesService.start(ref, chosen), 'Follow-up iniciado')}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              Iniciar follow-up
            </Button>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Nenhum follow-up ligado. Crie e ligue um em <em>Automações → Follow-up</em>.
          </p>
        )
      )}
    </div>
  );
}
