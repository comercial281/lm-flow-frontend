// Os três botões da coluna fixa do card do lead: Agendar visita, Abrir conversa
// e IA. A lógica da IA veio do antigo CardActionsPanel sem mudar de fonte: o
// estado chega pronto no card (`item.sales_agent`) e o liga/desliga é o mesmo
// endpoint da conversa.
import { useCallback, useState, Suspense } from 'react';
import { Bot, BotOff, CalendarPlus, HelpCircle, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/ds';
import { chatService } from '@/services/chat/chatService';
import { conversationAPI } from '@/services/conversations/conversationService';
import { lazyWithRetry } from '@/utils/chunkReload';
import { conversaDoCard, leadParaVisita } from '@/features/cardDoLead/cardDoLead';
import type { PipelineItem } from '@/types/analytics';
import type { SalesAgentCardState, SalesAgentLeadReport } from '@/types/analytics/pipelines';

const ScheduleVisitDialog = lazyWithRetry(() =>
  import('@/components/visits/ScheduleVisitDialog').then(m => ({ default: m.ScheduleVisitDialog })),
);

const VISIT_SCHEDULED_LABEL = 'visita-agendada';

interface LeadQuickActionsProps {
  item: PipelineItem;
  nomeExibido: string;
  abrindoConversa: boolean;
  onAbrirConversa: () => void;
  /** Visita criada: o card recarrega o histórico. */
  onVisitaCriada?: () => void;
}

function rotuloDaIa(state: SalesAgentCardState | null): string {
  if (!state || state.status === 'none') return 'Sem IA';
  return state.status === 'active' ? 'IA ligada' : 'IA desligada';
}

function porQueDaIa(state: SalesAgentCardState | null, temConversa: boolean): string | null {
  if (!temConversa) return 'A IA só atende lead com conversa de WhatsApp.';
  if (!state || state.status === 'none') return 'Nenhuma IA ligada no número deste lead.';
  if (state.status === 'idle') return 'A IA atende este número, mas o gatilho ainda não bateu neste lead. Ligar força o atendimento.';
  if (state.status === 'handoff') return 'A IA passou este lead para um corretor. Ligar de volta desfaz a transferência.';
  return null;
}

export default function LeadQuickActions({
  item,
  nomeExibido,
  abrindoConversa,
  onAbrirConversa,
  onVisitaCriada,
}: LeadQuickActionsProps) {
  const convId = conversaDoCard(item);
  const lead = leadParaVisita(item, nomeExibido);

  const [visitaAberta, setVisitaAberta] = useState(false);

  const [aiState, setAiState] = useState<SalesAgentCardState | null>(item.sales_agent ?? null);
  const [trocandoIa, setTrocandoIa] = useState(false);
  const [relatorio, setRelatorio] = useState<SalesAgentLeadReport | null>(null);
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const iaLigada = aiState?.status === 'active';
  const iaIndisponivel = !convId || !aiState || aiState.status === 'none';

  const trocarIa = useCallback(async () => {
    if (!convId) return;
    setTrocandoIa(true);
    try {
      const next = await chatService.toggleSalesAgent(convId, !iaLigada);
      setAiState(next);
      setRelatorio(null);
      toast.success(next.label);
    } catch {
      toast.error('Não consegui mudar a IA neste lead.');
    } finally {
      setTrocandoIa(false);
    }
  }, [convId, iaLigada]);

  const carregarRelatorio = useCallback(async () => {
    if (!convId || relatorio) return;
    setCarregandoRelatorio(true);
    try {
      const r = await chatService.getSalesAgentStatus(convId);
      setRelatorio(r);
      setAiState(r.state);
    } catch {
      toast.error('Não consegui carregar a situação da IA neste lead.');
    } finally {
      setCarregandoRelatorio(false);
    }
  }, [convId, relatorio]);

  const motivo = porQueDaIa(aiState, Boolean(convId));

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1 px-1.5"
          disabled={!lead}
          onClick={() => setVisitaAberta(true)}
        >
          <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
          Agendar visita
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1 px-1.5 text-emerald-700 dark:text-emerald-400"
          disabled={abrindoConversa}
          onClick={onAbrirConversa}
        >
          {abrindoConversa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5 shrink-0" />}
          Conversa
        </Button>
        <Button
          type="button"
          size="sm"
          variant={iaLigada ? 'default' : 'outline'}
          className="h-8 text-xs gap-1 px-1.5"
          disabled={trocandoIa || iaIndisponivel}
          title={motivo ?? (iaLigada ? 'Desligar a IA neste lead' : 'Ligar a IA neste lead')}
          onClick={trocarIa}
        >
          {trocandoIa ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : iaLigada ? (
            <Bot className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <BotOff className="h-3.5 w-3.5 shrink-0" />
          )}
          {rotuloDaIa(aiState)}
        </Button>
      </div>

      {convId && (
        <Popover onOpenChange={aberto => { if (aberto) void carregarRelatorio(); }}>
          <PopoverTrigger asChild>
            <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              Por que a IA não respondeu?
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-1">
            {carregandoRelatorio && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {motivo && <p className="text-[11px] text-muted-foreground">{motivo}</p>}
            {relatorio && (
              <>
                <p className="text-[11px] text-foreground">{relatorio.why}</p>
                {relatorio.next_step && <p className="text-[10px] text-muted-foreground">{relatorio.next_step}</p>}
                {relatorio.runs.length > 0 && (
                  <ul className="pt-1 space-y-0.5">
                    {relatorio.runs.map((run, i) => (
                      <li key={i} className="text-[10px] text-muted-foreground">
                        {new Date(run.created_at).toLocaleString('pt-BR')} ·{' '}
                        {run.status === 'replied'
                          ? run.delivered
                            ? 'respondeu o lead'
                            : 'gerou resposta, mas não conseguiu enviar'
                          : run.status === 'failed'
                            ? `falhou: ${run.error_message ?? 'erro no servidor'}`
                            : (run.reason_label ?? 'não respondeu')}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </PopoverContent>
        </Popover>
      )}

      {visitaAberta && (
        <Suspense fallback={null}>
          <ScheduleVisitDialog
            open={visitaAberta}
            onOpenChange={setVisitaAberta}
            leadInicial={lead}
            onCreated={() => {
              setVisitaAberta(false);
              if (convId) conversationAPI.addLabels(convId, [VISIT_SCHEDULED_LABEL]).catch(() => {});
              onVisitaCriada?.();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
