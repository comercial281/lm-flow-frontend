// src/pages/Customer/Pipelines/quadro/StageColumn.tsx
// Uma coluna (etapa) do quadro do funil: cabeçalho com nome, contagem, valor e
// menu da etapa, e a lista de cards que recebe o arraste. Saiu do
// PipelineKanban.tsx sem mudar comportamento (spec funil §4.5).
import type { DragEvent, MutableRefObject } from 'react';
import { toast } from 'sonner';
import { Copy, Edit, MoreVertical, Trash2 } from 'lucide-react';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import { useLanguage } from '@/hooks/useLanguage';
import { dinheiro } from '@/lib/formato';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
// Card do board, sempre visível de cara — import estático de propósito.
import PipelineItemCard from '../PipelineItemCard';
import { calculateStageTotal } from '../pipelineItemHelpers';

export interface StageColumnProps {
  stage: PipelineStage;
  destacada: boolean;
  visitsByContact: Record<string, string>;
  isDraggingRef: MutableRefObject<boolean>;
  suppressClickUntilRef: MutableRefObject<number>;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent, stageId: string) => void;
  onCardDragStart: (item: PipelineItem) => void;
  onCardDragEnd: () => void;
  onCardDragOver: (e: DragEvent) => void;
  onCardDrop: (e: DragEvent, item: PipelineItem, stageId: string) => void;
  onOpenItem: (item: PipelineItem) => void;
  onArchive: (item: PipelineItem) => void;
  onRemove: (item: PipelineItem) => void;
  /** A aba decide se o card arrasta (podeArrastarNaAba). Referência estável. */
  podeArrastar: (item: PipelineItem) => boolean;
  arquivado: boolean;
  onUnarchive: (item: PipelineItem) => void;
  onOpenConversation: (item: PipelineItem) => void;
  openingConversation: boolean;
  onEditStage: (stage: PipelineStage) => void;
  onDeleteStage: (stage: PipelineStage) => void;
}

export default function StageColumn({
  stage, destacada, visitsByContact, isDraggingRef, suppressClickUntilRef, onDragOver, onDrop,
  onCardDragStart, onCardDragEnd, onCardDragOver, onCardDrop, onOpenItem, onArchive, onRemove,
  podeArrastar, arquivado, onUnarchive, onOpenConversation, openingConversation, onEditStage, onDeleteStage,
}: StageColumnProps) {
  const { t } = useLanguage('pipelines');
  const total = calculateStageTotal(stage.items);

  return (
    <div
      id={`etapa-${stage.id}`}
      className={`w-80 flex-shrink-0 rounded-xl transition-shadow ${destacada ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="bg-muted/40 rounded-xl shadow-sm border border-border h-full flex flex-col">
        {/* Stage Header */}
        <div
          className="flex-shrink-0 px-4 py-3 border-b border-border rounded-t-xl border-t-4"
          style={{
            borderTopColor: stage.color,
            backgroundColor: stage.color?.startsWith('#') ? `${stage.color}1f` : undefined,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
              <h3 className="text-sm font-medium text-foreground">{stage.name}</h3>
              <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
                {stage.items?.length || stage.item_count || 0}
              </span>
              {/* Stage Total Value */}
              {total > 0 && (
                <span className="bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs px-2 py-1 rounded-full font-medium">
                  {t('kanban.stage.totalValue', { value: dinheiro(total) })}
                </span>
              )}
            </div>

            {/* Stage Options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-auto p-1" aria-label="Mais ações" title="Mais ações">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditStage(stage)}>
                  <Edit className="h-4 w-4 mr-2" />
                  {t('kanban.stage.editStage')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await navigator.clipboard.writeText(String(stage.id));
                    toast.success(t('kanban.idCopied'));
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {t('kanban.copyId')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => onDeleteStage(stage)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('kanban.stage.deleteStage')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Items Drop Zone */}
        <div
          data-col-scroll
          className="flex-1 overflow-y-auto p-4 space-y-3"
          onDragOver={onDragOver}
          onDrop={e => onDrop(e, stage.id)}
        >
          {(stage.items || []).map(item => (
            <PipelineItemCard
              key={item.id}
              item={item}
              stageId={stage.id}
              visitsByContact={visitsByContact}
              isDraggingRef={isDraggingRef}
              suppressClickUntilRef={suppressClickUntilRef}
              onDragStart={onCardDragStart}
              onDragEnd={onCardDragEnd}
              onCardDragOver={onCardDragOver}
              onCardDrop={onCardDrop}
              onOpenItem={onOpenItem}
              onArchive={onArchive}
              onRemove={onRemove}
              podeArrastar={podeArrastar(item)}
              arquivado={arquivado}
              onUnarchive={onUnarchive}
              onOpenConversation={onOpenConversation}
              openingConversation={openingConversation}
            />
          ))}

          {/* Empty state */}
          {(!stage.items || stage.items.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-sm">{t('kanban.stage.noConversations')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
