import { useState, useCallback, Suspense } from 'react';
import { Button } from '@/components/ui/ds';
import {
  Loader2, Calendar, Trash2, Move, BotOff, Bot, AlertCircle,
  Trophy, XCircle, CalendarPlus, HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { conversationAPI } from '@/services/conversations/conversationService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { visitsService } from '@/services/visits/visitsService';
import { lazyWithRetry } from '@/utils/chunkReload';
// FollowupTimeline é conteúdo do painel, já visível de cara — segue import
// estático de propósito.
import FollowupTimeline from './FollowupTimeline';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import type { SalesAgentCardState, SalesAgentLeadReport } from '@/types/analytics/pipelines';
import { chatService } from '@/services/chat/chatService';
import SalesAgentBadge from '@/components/salesAgents/SalesAgentBadge';

// Modal de agendamento só aparece com clique explícito — vira lazy.
const ScheduleActionModal = lazyWithRetry(() =>
  import('@/components/scheduledActions/ScheduleActionModal').then(m => ({ default: m.ScheduleActionModal })),
);

const VISIT_SCHEDULED_LABEL = 'visita-agendada';

interface CardActionsPanelProps {
  item: PipelineItem;
  stages: PipelineStage[];
  onClose: () => void;
  onStageChanged?: (newStageId: string) => void;
  onRemoved?: () => void;
}

export default function CardActionsPanel({
  item,
  stages,
  onClose,
  onStageChanged,
  onRemoved,
}: CardActionsPanelProps) {
  const canScheduleAction = useFeature('card_schedule_action');

  const convId = item.conversation?.id
    ? String(item.conversation.id)
    : (item as any).conversation_id
      ? String((item as any).conversation_id)
      : (item as any).whatsapp_conversation_id
        ? String((item as any).whatsapp_conversation_id)
        : null;
  const contactId = item.contact?.id ?? (item.conversation as any)?.contact?.id;
  // Só pra prévia do texto do funil no card: as mensagens têm {{nome}} dentro, e
  // cru isso fazia a linha do tempo parecer quebrada. Nunca vai ao servidor.
  const leadName: string | null =
    item.contact?.name ?? (item.conversation as any)?.contact?.name ?? null;

  // Estado da IA Vendedora neste lead. Chega pronto do backend no card; guardamos
  // local só pra refletir o toggle na hora, sem recarregar o board inteiro.
  const [aiState, setAiState] = useState<SalesAgentCardState | null>(item.sales_agent ?? null);
  const [togglingAi, setTogglingAi] = useState(false);
  const aiOn = aiState?.status === 'active';

  // Por que a IA não respondeu ESTE lead. O selo diz o estado ("Transferido para
  // um corretor"), que não é a mesma pergunta: fora do horário, gatilho que não
  // bateu e canal sem conexão dão o mesmo silêncio e exigiam abrir o log pra
  // distinguir. Carrega sob demanda, num clique, pra não pesar o board.
  const [aiReport, setAiReport] = useState<SalesAgentLeadReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const loadAiReport = useCallback(async () => {
    if (!convId) return;
    setLoadingReport(true);
    try {
      const report = await chatService.getSalesAgentStatus(convId);
      setAiReport(report);
      setAiState(report.state);
    } catch {
      toast.error('Não consegui carregar a situação da IA neste lead.');
    } finally {
      setLoadingReport(false);
    }
  }, [convId]);

  const toggleSalesAgent = useCallback(async () => {
    if (!convId) return;
    setTogglingAi(true);
    try {
      const next = await chatService.toggleSalesAgent(convId, !aiOn);
      setAiState(next);
      setAiReport(null);
      toast.success(next.label);
    } catch {
      toast.error('Não consegui mudar a IA neste lead.');
    } finally {
      setTogglingAi(false);
    }
  }, [convId, aiOn]);
  const [movingStage, setMovingStage] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Agendar visita
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitWhen, setVisitWhen] = useState('');
  const [visitDuration, setVisitDuration] = useState('60');
  const [visitNotes, setVisitNotes] = useState('');
  const [savingVisit, setSavingVisit] = useState(false);

  // Current stage
  const currentStageId = item.stage_id ?? null;

  // Detecta colunas de Ganho/Perdido pelo nome (template padrao: "Venda" / "Desqualificado").
  const wonStage = stages.find(s => /vend|ganho|ganhou|fechad/i.test(s.name));
  const lostStage = stages.find(s => /desqualific|perdid|perda|perdeu|descart/i.test(s.name));

  const handleMoveStage = useCallback(async (toStageId: string) => {
    if (!currentStageId || toStageId === currentStageId) return;
    setMovingStage(true);
    try {
      await pipelinesService.moveItem({
        item_id: item.id,
        pipeline_id: item.pipeline_id,
        from_stage_id: currentStageId,
        to_stage_id: toStageId,
      });
      onStageChanged?.(toStageId);
      toast.success('Card movido');
    } catch {
      toast.error('Erro ao mover card');
    } finally {
      setMovingStage(false);
    }
  }, [item, currentStageId, onStageChanged]);

  const handleCreateVisit = useCallback(async () => {
    if (!contactId) { toast.error('Lead sem contato'); return; }
    if (!visitWhen) { toast.error('Escolha data e hora'); return; }
    setSavingVisit(true);
    try {
      await visitsService.create({
        contact_id: String(contactId),
        scheduled_at: new Date(visitWhen).toISOString(),
        duration_minutes: Number(visitDuration) || 60,
        notes: visitNotes || undefined,
      });
      // Marca o lead com a tag de visita agendada (aparece no card)
      if (convId) {
        try { await conversationAPI.addLabels(convId, [VISIT_SCHEDULED_LABEL]); } catch { /* tag best-effort */ }
      }
      toast.success('Visita agendada');
      setVisitOpen(false);
      setVisitWhen(''); setVisitNotes(''); setVisitDuration('60');
    } catch {
      toast.error('Erro ao agendar visita');
    } finally {
      setSavingVisit(false);
    }
  }, [contactId, convId, visitWhen, visitDuration, visitNotes]);

  const handleRemove = useCallback(async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setRemoving(true);
    try {
      await pipelinesService.removeItemFromPipeline(item.pipeline_id, item.id);
      toast.success('Lead removido do pipeline');
      onRemoved?.();
      onClose();
    } catch {
      toast.error('Erro ao remover lead');
    } finally {
      setRemoving(false);
      setConfirmDelete(false);
    }
  }, [item, confirmDelete, onClose, onRemoved]);

  return (
    <div className="space-y-4">
      {/* Follow-up.

          O bloco inteiro (estado, botões e linha do tempo) vem do componente
          abaixo, que lê tudo da FILA de disparos do lead. Antes o botão morava
          aqui e olhava a etiqueta `follow-up` da conversa, enquanto a linha do
          tempo olhava a fila: as duas metades discordavam na tela, e o card
          dizia "Ativar follow-up" com sete mensagens já agendadas embaixo.

          Não depende de `convId`: lead de formulário e de anúncio pode não ter
          conversa de WhatsApp, e o follow-up é do LEAD. O aviso antigo de
          "disponível apenas para leads com conversa" escondia o botão desses
          justamente nos que mais precisam de follow-up. */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Follow-up</h5>
        <FollowupTimeline
          contactId={contactId ? String(contactId) : null}
          conversationId={convId}
          leadName={leadName}
        />
      </div>

      {/* IA Vendedora.

          O bloco aparece SEMPRE que o lead tem conversa de WhatsApp, inclusive
          quando não há IA no canal dele. Esconder nesse caso era o pior dos
          mundos: é justamente quando a IA não atende o lead e não deixa rastro
          nenhum, e a tela vazia dava a entender que estava tudo normal. */}
      {convId && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">IA Vendedora</h5>
          <div className="flex items-center gap-2 flex-wrap">
            <SalesAgentBadge state={aiState} size="md" />
            {(!aiState || aiState.status === 'none') && (
              <span className="text-xs text-muted-foreground">Nenhuma IA ligada no canal deste lead</span>
            )}
            <Button
              size="sm"
              variant={aiOn ? 'outline' : 'default'}
              className="h-7 text-xs gap-1.5"
              onClick={toggleSalesAgent}
              disabled={togglingAi || !convId || !aiState || aiState.status === 'none'}
            >
              {togglingAi ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : aiOn ? (
                <BotOff className="h-3.5 w-3.5" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
              {aiOn ? 'Desligar neste lead' : 'Ligar neste lead'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              onClick={loadAiReport}
              disabled={loadingReport || !convId}
            >
              {loadingReport ? <Loader2 className="h-3 w-3 animate-spin" /> : <HelpCircle className="h-3.5 w-3.5" />}
              Por que não respondeu?
            </Button>
          </div>
          {aiReport && (
            <div className="rounded-md bg-muted/50 p-2 space-y-1">
              <p className="text-[11px] text-foreground">{aiReport.why}</p>
              {aiReport.next_step && (
                <p className="text-[10px] text-muted-foreground">{aiReport.next_step}</p>
              )}
              {aiReport.runs.length > 0 && (
                <ul className="pt-1 space-y-0.5">
                  {aiReport.runs.map((run, i) => (
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
            </div>
          )}
          {aiState?.status === 'idle' && (
            <p className="text-[10px] text-muted-foreground">
              A IA atende este canal, mas o gatilho ainda não bateu neste lead. Ligar aqui força o atendimento.
            </p>
          )}
          {aiState?.status === 'handoff' && (
            <p className="text-[10px] text-muted-foreground">
              A IA passou este lead pra um corretor. Ligar de volta desfaz a transferência.
            </p>
          )}
          {!convId && (
            <p className="text-[10px] text-muted-foreground">Disponível apenas para leads com conversa WhatsApp.</p>
          )}
        </div>
      )}

      {/* Resultado do lead */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resultado</h5>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => wonStage && handleMoveStage(wonStage.id.toString())}
            disabled={movingStage || !wonStage || wonStage.id.toString() === currentStageId?.toString()}
            title={wonStage ? `Mover para "${wonStage.name}"` : 'Nenhuma coluna de venda encontrada'}
          >
            <Trophy className="h-3.5 w-3.5" />
            Ganho
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => lostStage && handleMoveStage(lostStage.id.toString())}
            disabled={movingStage || !lostStage || lostStage.id.toString() === currentStageId?.toString()}
            title={lostStage ? `Mover para "${lostStage.name}"` : 'Nenhuma coluna de perda encontrada'}
          >
            <XCircle className="h-3.5 w-3.5" />
            Perdido
          </Button>
          {contactId && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => setVisitOpen(true)}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Agendar visita
            </Button>
          )}
        </div>
      </div>

      {/* Move de coluna */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Move className="h-3.5 w-3.5" />
          Mover para coluna
          {movingStage && <Loader2 className="h-3 w-3 animate-spin" />}
        </h5>
        <div className="flex flex-wrap gap-1.5">
          {stages.map(stage => (
            <button
              key={stage.id}
              onClick={() => handleMoveStage(stage.id.toString())}
              disabled={movingStage || stage.id.toString() === currentStageId?.toString()}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all
                ${stage.id.toString() === currentStageId?.toString()
                  ? 'border-primary bg-primary/10 text-primary font-medium cursor-default'
                  : 'border-border bg-background hover:bg-muted cursor-pointer disabled:opacity-40'
                }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
              {stage.name}
            </button>
          ))}
        </div>
      </div>

      {/* Agendar / Ações */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ações</h5>
        <div className="flex flex-wrap gap-2">
          {contactId && canScheduleAction && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => setScheduleOpen(true)}
            >
              <Calendar className="h-3.5 w-3.5" />
              Agendar mensagem
            </Button>
          )}
          <Button
            size="sm"
            variant={confirmDelete ? 'destructive' : 'outline'}
            className="h-7 text-xs gap-1.5"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : confirmDelete ? (
              <AlertCircle className="h-3.5 w-3.5" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {confirmDelete ? 'Confirmar remoção' : 'Remover do pipeline'}
          </Button>
          {confirmDelete && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Schedule modal */}
      {contactId && (
        <Suspense fallback={null}>
          <ScheduleActionModal
            open={scheduleOpen}
            onClose={() => setScheduleOpen(false)}
            contactId={String(contactId)}
          />
        </Suspense>
      )}

      {/* Agendar visita modal */}
      {visitOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !savingVisit && setVisitOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-background p-4 shadow-xl space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Agendar visita</h4>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data e hora</label>
              <input
                type="datetime-local"
                value={visitWhen}
                onChange={e => setVisitWhen(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Duração (min)</label>
              <input
                type="number"
                min={15}
                step={15}
                value={visitDuration}
                onChange={e => setVisitDuration(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Observações (opcional)</label>
              <textarea
                value={visitNotes}
                onChange={e => setVisitNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setVisitOpen(false)} disabled={savingVisit}>
                Cancelar
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleCreateVisit} disabled={savingVisit}>
                {savingVisit ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
                Agendar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
