import React, { useState, useEffect } from 'react';
import { Button } from '@evoapi/design-system/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@evoapi/design-system/select';
import { Label } from '@evoapi/design-system/label';
import { Loader2, GitBranch, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { Pipeline, PipelineItem, PipelineStage } from '@/types/analytics';
import { useLanguage } from '@/hooks/useLanguage';
import { useConfirmacao } from '@/hooks/useConfirmacao';

interface PipelineManagementProps {
  conversationId: string;
  pipelines: Pipeline[];
  onPipelineUpdated?: () => void;
}

interface ConversationPipelineData {
  pipeline: Pipeline;
  stage: PipelineStage;
}

const PipelineManagement: React.FC<PipelineManagementProps> = ({
  conversationId,
  pipelines, 
  onPipelineUpdated,
}) => {
  const { t } = useLanguage('chat');
  const [currentPipeline, setCurrentPipeline] = useState<ConversationPipelineData | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [originalPipelines, setOriginalPipelines] = useState<Pipeline[]>([]);

  const loadData = async () => {
    const pipelinesResponse = await pipelinesService.getPipelines();
    setOriginalPipelines(pipelinesResponse.data || []);
    
    let foundPipeline: ConversationPipelineData | null = null;
    
    for (const pipeline of pipelines) {
      if (pipeline.stages) {
        // Procurar o item da conversation nos stages
        for (const stage of pipeline.stages) {
          if (stage.items && stage.items.length > 0) {
            foundPipeline = { pipeline, stage };
            setSelectedPipelineId(String(pipeline.id));
            setSelectedStageId(String(stage.id));
            break;
          }
        }
      }
    }
    
    if (!foundPipeline) return;

    setCurrentPipeline(foundPipeline);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, pipelines]);

  const selectedPipeline = pipelines.find(p => String(p.id) === selectedPipelineId);

  // Load stages when pipeline is selected
  const [availableStages, setAvailableStages] = useState<PipelineStage[]>([]);

  useEffect(() => {
    const loadStages = async () => {
      if (!selectedPipelineId) {
        setAvailableStages([]);
        return;
      }

      try {
        const pipelinesToSearch = originalPipelines || [];
        const selectedPipeline = pipelinesToSearch.find(
          (p) => String(p.id) === selectedPipelineId,
        );

        setAvailableStages(selectedPipeline?.stages || []);
      } catch (error) {
        console.error('Error loading stages:', error);
        setAvailableStages([]);
      }
    };

    loadStages();
  }, [selectedPipelineId, originalPipelines]);

  const handlePipelineChange = (value: string) => {
    setSelectedPipelineId(value);
    // Reset stage when pipeline changes
    setSelectedStageId('');
  };

  const handleSaveClick = async () => {
    if (!selectedPipelineId || !selectedStageId) {
      toast.error(t('contactSidebar.pipeline.selectError'));
      return;
    }
    // Frase com o nome do funil e da etapa em negrito.
    const chave = currentPipeline ? 'update' : 'add';
    const pipelineName = selectedPipeline?.name || '';
    const stageName = availableStages.find(s => String(s.id) === selectedStageId)?.name || '';
    const parts = t(`contactSidebar.pipeline.dialogs.${chave}.description`, {
      pipelineName,
      stageName,
    }).split(pipelineName);
    const stageParts = parts[1]?.split(stageName) || [];
    const ok = await confirmar({
      titulo: t(`contactSidebar.pipeline.dialogs.${chave}.title`),
      descricao: (
        <>
          {parts[0]}
          <strong>{selectedPipeline?.name}</strong>
          {stageParts[0]}
          <strong>{stageName}</strong>
          {stageParts[1]}
        </>
      ),
      rotuloDeCancelar: t('contactSidebar.pipeline.dialogs.remove.cancel'),
      rotuloDaAcao: t(`contactSidebar.pipeline.dialogs.${chave}.confirm`),
    });
    if (ok) await confirmSave();
  };

  const confirmSave = async () => {
    if (!selectedPipelineId || !selectedStageId) return;

    try {
      setIsSaving(true);

      // Find the pipeline item for this conversation by searching through stages
      const conversationPipeline = pipelines?.find(
        (pipeline: Pipeline) => String(pipeline.id) === selectedPipelineId
      );

      let conversationItem: PipelineItem | undefined;
      if (conversationPipeline?.stages) {
        for (const stage of conversationPipeline.stages) {
          const found = stage.items?.find(
            (item: PipelineItem) => String(item.item_id) === conversationId
          );
          if (found) {
            conversationItem = found;
            break;
          }
        }
      }

      if (conversationItem) {
        // Use move_to_stage endpoint (same as Kanban drag-and-drop)
        await pipelinesService.moveItem({
          item_id: conversationItem.id,
          pipeline_id: selectedPipelineId,
          from_stage_id: conversationItem.stage_id,
          to_stage_id: selectedStageId,
        });
      } else {
        await pipelinesService.addItemToPipeline(selectedPipelineId, {
          item_id: conversationId,
          type: 'conversation',
          pipeline_stage_id: selectedStageId,
        });
      }

      toast.success(t('contactSidebar.pipeline.saveSuccess'));
      await loadData();
      onPipelineUpdated?.();
    } catch (error) {
      console.error('Error updating pipeline:', error);
      toast.error(t('contactSidebar.pipeline.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveClick = async () => {
    const pipelineName = currentPipeline?.pipeline.name || '';
    const parts = t('contactSidebar.pipeline.dialogs.remove.description', { pipelineName }).split(
      pipelineName,
    );
    const ok = await confirmar({
      titulo: t('contactSidebar.pipeline.dialogs.remove.title'),
      descricao: (
        <>
          {parts[0]}
          <strong>{pipelineName}</strong>
          {parts[1]}
        </>
      ),
      rotuloDeCancelar: t('contactSidebar.pipeline.dialogs.remove.cancel'),
      rotuloDaAcao: t('contactSidebar.pipeline.dialogs.remove.confirm'),
      destrutivo: true,
    });
    if (ok) await confirmRemove();
  };

  const confirmRemove = async () => {
    if (!currentPipeline) return;

    try {
      setIsSaving(true);
      await pipelinesService.removeItemFromPipeline(
        String(currentPipeline.pipeline.id),
        conversationId,
      );
      toast.success(t('contactSidebar.pipeline.removeSuccess'));
      setSelectedPipelineId('');
      setSelectedStageId('');
      setCurrentPipeline(null);
      onPipelineUpdated?.();
    } catch (error) {
      console.error('Error removing from pipeline:', error);
      toast.error(t('contactSidebar.pipeline.removeError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Pipeline Status */}
      {currentPipeline && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <GitBranch className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t('contactSidebar.pipeline.current')}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {currentPipeline.pipeline.name} • {currentPipeline.stage.name}
          </p>
        </div>
      )}

      {/* Pipeline Selection */}
      <div className="space-y-2">
        <Label htmlFor="pipeline-select" className="text-xs font-medium">
          {t('contactSidebar.pipeline.label')}
        </Label>
        <Select value={selectedPipelineId} onValueChange={handlePipelineChange}>
          <SelectTrigger id="pipeline-select">
            <SelectValue placeholder={t('contactSidebar.pipeline.selectPipeline')} />
          </SelectTrigger>
          <SelectContent>
            {originalPipelines.map(pipeline => (
              <SelectItem key={pipeline.id} value={String(pipeline.id)}>
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stage Selection */}
      {selectedPipelineId && (
        <div className="space-y-2">
          <Label htmlFor="stage-select" className="text-xs font-medium">
            {t('contactSidebar.pipeline.stage')}
          </Label>
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger id="stage-select">
              <SelectValue placeholder={t('contactSidebar.pipeline.selectStage')} />
            </SelectTrigger>
            <SelectContent>
              {availableStages
                .sort((a, b) => a.position - b.position)
                .map(stage => (
                  <SelectItem key={stage.id} value={String(stage.id)}>
                    {stage.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={handleSaveClick}
          disabled={!selectedPipelineId || !selectedStageId || isSaving}
          className="flex-1"
          size="sm"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('contactSidebar.pipeline.saving')}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {t('contactSidebar.pipeline.save')}
            </>
          )}
        </Button>
        {currentPipeline && (
          <Button onClick={handleRemoveClick} disabled={isSaving} variant="outline" size="sm" aria-label="Remover do funil" title="Remover do funil">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {dialogoDeConfirmacao}
    </div>
  );
};

export default PipelineManagement;
