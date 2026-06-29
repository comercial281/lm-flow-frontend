import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/ds';
import {
  Loader2, Calendar, Trash2, Move, CheckSquare, Square,
  PauseCircle, PlayCircle, BotOff, Bot, AlertCircle,
  Trophy, XCircle, CalendarPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { conversationAPI } from '@/services/conversations/conversationService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { visitsService } from '@/services/visits/visitsService';
import { ScheduleActionModal } from '@/components/scheduledActions/ScheduleActionModal';
import FollowupTimeline from './FollowupTimeline';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import type { PipelineItem, PipelineStage } from '@/types/analytics';

const VISIT_SCHEDULED_LABEL = 'visita-agendada';

interface CardActionsPanelProps {
  item: PipelineItem;
  stages: PipelineStage[];
  onClose: () => void;
  onStageChanged?: (newStageId: string) => void;
  onRemoved?: () => void;
}

const FOLLOW_UP_LABEL = 'follow-up';
const BOT_PAUSED_LABEL = 'bot-pausado';

export default function CardActionsPanel({
  item,
  stages,
  onClose,
  onStageChanged,
  onRemoved,
}: CardActionsPanelProps) {
  const canScheduleAction = useFeature('card_schedule_action');

  const convId = item.conversation?.id ? String(item.conversation.id) : null;
  const contactId = item.contact?.id ?? (item.conversation as any)?.contact?.id;

  // Derive initial state from conversation labels
  const convLabels: string[] = (() => {
    const raw = (item.conversation as any)?.labels ?? [];
    return Array.isArray(raw)
      ? raw.map((l: any) => (typeof l === 'string' ? l : l?.title ?? ''))
      : [];
  })();

  const [followUpActive, setFollowUpActive] = useState(convLabels.includes(FOLLOW_UP_LABEL));
  const [followUpPaused, setFollowUpPaused] = useState(convLabels.includes('follow-up-pausado'));
  const [botPaused, setBotPaused] = useState(convLabels.includes(BOT_PAUSED_LABEL));

  const [togglingFollowUp, setTogglingFollowUp] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
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

  const toggleFollowUp = useCallback(async () => {
    if (!convId) return;
    setTogglingFollowUp(true);
    try {
      if (followUpActive) {
        await conversationAPI.removeLabels(convId, [FOLLOW_UP_LABEL]);
        setFollowUpActive(false);
        toast.success('Follow-up desativado');
      } else {
        await conversationAPI.addLabels(convId, [FOLLOW_UP_LABEL]);
        setFollowUpActive(true);
        toast.success('Follow-up ativado');
      }
    } catch {
      toast.error('Erro ao alterar follow-up');
    } finally {
      setTogglingFollowUp(false);
    }
  }, [convId, followUpActive]);

  const toggleFollowUpPause = useCallback(async () => {
    if (!convId) return;
    setTogglingFollowUp(true);
    try {
      if (followUpPaused) {
        await conversationAPI.removeLabels(convId, ['follow-up-pausado']);
        setFollowUpPaused(false);
        toast.success('Follow-up retomado');
      } else {
        await conversationAPI.addLabels(convId, ['follow-up-pausado']);
        setFollowUpPaused(true);
        toast.success('Follow-up pausado');
      }
    } catch {
      toast.error('Erro ao pausar follow-up');
    } finally {
      setTogglingFollowUp(false);
    }
  }, [convId, followUpPaused]);

  const toggleBot = useCallback(async () => {
    if (!convId) return;
    setTogglingBot(true);
    try {
      if (botPaused) {
        await conversationAPI.removeLabels(convId, [BOT_PAUSED_LABEL]);
        setBotPaused(false);
        toast.success('Chatbot reativado');
      } else {
        await conversationAPI.addLabels(convId, [BOT_PAUSED_LABEL]);
        setBotPaused(true);
        toast.success('Chatbot pausado');
      }
    } catch {
      toast.error('Erro ao alterar chatbot');
    } finally {
      setTogglingBot(false);
    }
  }, [convId, botPaused]);

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
      {/* Follow-up */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Follow-up</h5>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={followUpActive ? 'default' : 'outline'}
            className="h-7 text-xs gap-1.5"
            onClick={toggleFollowUp}
            disabled={togglingFollowUp || !convId}
          >
            {togglingFollowUp ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : followUpActive ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {followUpActive ? 'Follow-up ativo' : 'Ativar follow-up'}
          </Button>

          {followUpActive && (
            <Button
              size="sm"
              variant={followUpPaused ? 'destructive' : 'outline'}
              className="h-7 text-xs gap-1.5"
              onClick={toggleFollowUpPause}
              disabled={togglingFollowUp || !convId}
            >
              {followUpPaused ? (
                <PlayCircle className="h-3.5 w-3.5" />
              ) : (
                <PauseCircle className="h-3.5 w-3.5" />
              )}
              {followUpPaused ? 'Retomar' : 'Pausar'}
            </Button>
          )}
        </div>
        {!convId && (
          <p className="text-[10px] text-muted-foreground">Disponível apenas para leads com conversa WhatsApp.</p>
        )}
        {/* Linha do tempo dos passos do follow-up (o que o robô já mandou e o que falta) */}
        <div className="pt-1 border-t border-border/60 mt-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Linha do tempo</p>
          <FollowupTimeline contactId={contactId ? String(contactId) : null} conversationId={convId} />
        </div>
      </div>

      {/* Chatbot */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chatbot</h5>
        <Button
          size="sm"
          variant={botPaused ? 'destructive' : 'outline'}
          className="h-7 text-xs gap-1.5"
          onClick={toggleBot}
          disabled={togglingBot || !convId}
        >
          {togglingBot ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : botPaused ? (
            <BotOff className="h-3.5 w-3.5" />
          ) : (
            <Bot className="h-3.5 w-3.5" />
          )}
          {botPaused ? 'Chatbot pausado — retomar' : 'Pausar chatbot'}
        </Button>
        {!convId && (
          <p className="text-[10px] text-muted-foreground">Disponível apenas para leads com conversa WhatsApp.</p>
        )}
      </div>

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
        <ScheduleActionModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          contactId={String(contactId)}
        />
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
