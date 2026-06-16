import { useState, useCallback } from 'react';
import { Button } from '@evoapi/design-system';
import {
  Loader2, Calendar, Trash2, Move, CheckSquare, Square,
  PauseCircle, PlayCircle, BotOff, Bot, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { conversationAPI } from '@/services/conversations/conversationService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { ScheduleActionModal } from '@/components/scheduledActions/ScheduleActionModal';
import type { PipelineItem, PipelineStage } from '@/types/analytics';

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
  const [botPaused, setBotPaused] = useState(
    (item.conversation as any)?.muted ?? convLabels.includes(BOT_PAUSED_LABEL)
  );

  const [togglingFollowUp, setTogglingFollowUp] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const [movingStage, setMovingStage] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Current stage
  const currentStageId = item.stage_id ?? null;

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
        await conversationAPI.unmuteConversation(convId);
        setBotPaused(false);
        toast.success('Chatbot reativado');
      } else {
        await conversationAPI.muteConversation(convId);
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
          {contactId && (
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
    </div>
  );
}
