// src/pages/Customer/Pipelines/quadro/StageColumn.tsx
// Uma coluna (etapa) do quadro do funil: cabeçalho com nome, contagem, valor e
// menu da etapa, e a lista de cards que recebe o arraste. Saiu do
// PipelineKanban.tsx sem mudar comportamento (spec funil §4.5).
import { Fragment, useCallback, useEffect, useRef, type CSSProperties, type DragEvent, type MutableRefObject } from 'react';
import { toast } from 'sonner';
import { Copy, Edit, Trash2 } from 'lucide-react';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import { useLanguage } from '@/hooks/useLanguage';
import { dinheiro } from '@/lib/formato';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import { Skeleton } from '@/components/ui/ds';
// Card do board, sempre visível de cara — import estático de propósito.
import PipelineItemCard from '../PipelineItemCard';
import { calculateStageTotal } from '../pipelineItemHelpers';
import type { EventoDoMouse } from './useMiniCard';
import './quadro.css';

export interface StageColumnProps {
  stage: PipelineStage;
  destacada: boolean;
  visitsByContact: Record<string, string>;
  isDraggingRef: MutableRefObject<boolean>;
  suppressClickUntilRef: MutableRefObject<number>;
  onDragOver: (e: DragEvent, stageId: string) => void;
  onDrop: (e: DragEvent, stageId: string) => void;
  onCardDragStart: (item: PipelineItem, altura?: number) => void;
  onCardDragEnd: () => void;
  onCardDragOver: (e: DragEvent, item: PipelineItem, stageId: string) => void;
  /** Card pego agora (fica só o contorno no lugar dele). */
  arrastandoId: string | null;
  /** Onde o card pego cai nesta coluna (índice sem ele) e a altura dele; null = não cai aqui. */
  esqueleto: { indice: number; altura: number } | null;
  /** Mini card do quadro (useMiniCard). Referência estável. */
  onPassarMouse?: (evento: EventoDoMouse, item: PipelineItem, el: HTMLElement) => void;
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
  carregandoMais: boolean;
  erroAoCarregarMais: boolean;
  /** Coluna perto do fim (ou sem rolagem e com mais no servidor): pede o próximo lote. */
  onCarregarMais: (stage: PipelineStage, opcoes?: { manual?: boolean }) => void;
}

export default function StageColumn({
  stage, destacada, visitsByContact, isDraggingRef, suppressClickUntilRef, onDragOver, onDrop,
  onCardDragStart, onCardDragEnd, onCardDragOver, onCardDrop, arrastandoId, esqueleto, onPassarMouse, onOpenItem, onArchive, onRemove,
  podeArrastar, arquivado, onUnarchive, onOpenConversation, openingConversation, onEditStage, onDeleteStage,
  carregandoMais, erroAoCarregarMais, onCarregarMais,
}: StageColumnProps) {
  const { t } = useLanguage('pipelines');
  const total = stage.value_total ?? calculateStageTotal(stage.items);
  const carregados = stage.items?.length ?? 0;
  // Total do servidor (quadro em lotes), não só os cards carregados.
  const naColuna = stage.items_total ?? carregados;
  const temMais = carregados < naColuna;
  const rolagemRef = useRef<HTMLDivElement>(null);
  const PERTO_DO_FIM = 160;
  // O esqueleto entra antes do card que hoje ocupa o índice de queda (sem contar
  // o card pego); índice no fim = depois de todos.
  const itens = stage.items || [];
  const semArrastado = arrastandoId ? itens.filter(i => i.id !== arrastandoId) : itens;
  const esqueletoAntesDe = esqueleto ? semArrastado[esqueleto.indice]?.id ?? null : undefined;
  const desenharEsqueleto = esqueleto
    ? <EsqueletoDoCard altura={esqueleto.altura} onDrop={e => onDrop(e, stage.id)} />
    : null;

  const conferirFim = useCallback(() => {
    const el = rolagemRef.current;
    if (!el || !temMais || carregandoMais || erroAoCarregarMais) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= PERTO_DO_FIM) onCarregarMais(stage);
  }, [temMais, carregandoMais, erroAoCarregarMais, onCarregarMais, stage]);

  // Coluna que não enche a altura não rola: pede o próximo lote sozinha. Coluna sem
  // altura (escondida, ainda sem layout) não conta: 0 - 0 - 0 cairia sempre "no fim"
  // e ela pediria lote atrás de lote até trazer a coluna inteira.
  useEffect(() => {
    if ((rolagemRef.current?.clientHeight ?? 0) > 0) conferirFim();
  }, [carregados, conferirFim]);

  return (
    <div
      id={`etapa-${stage.id}`}
      className={`w-80 flex-shrink-0 rounded-xl transition-shadow ${destacada ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="quadro-coluna border h-full flex flex-col">
        {/* Stage Header */}
        <div
          className="quadro-coluna-topo flex-shrink-0 px-4 py-3 border-b"
          // Fio aceso na cor da etapa (quadro.css); sem cor, o roxo de reserva do CSS.
          style={stage.color ? ({ '--etapa': stage.color } as CSSProperties) : undefined}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
              <h3 className="quadro-coluna-nome text-foreground">{stage.name}</h3>
              <span className="quadro-coluna-total text-xs px-2 py-1 rounded-full">
                {naColuna}
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
                <BotaoMaisAcoes compacto className="shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditStage(stage)}>
                  <Edit className="h-4 w-4" />
                  {t('kanban.stage.editStage')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await navigator.clipboard.writeText(String(stage.id));
                    toast.success(t('kanban.idCopied'));
                  }}
                >
                  <Copy className="h-4 w-4" />
                  {t('kanban.copyId')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDeleteStage(stage)}>
                  <Trash2 className="h-4 w-4" />
                  {t('kanban.stage.deleteStage')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Items Drop Zone */}
        <div
          data-col-scroll
          ref={rolagemRef}
          onScroll={conferirFim}
          className="flex-1 overflow-y-auto p-4 space-y-3"
          onDragOver={e => onDragOver(e, stage.id)}
          onDrop={e => onDrop(e, stage.id)}
        >
          {itens.map(item => (
            <Fragment key={item.id}>
            {esqueletoAntesDe === item.id && desenharEsqueleto}
            <PipelineItemCard
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
              arrastando={arrastandoId === item.id}
              onPassarMouse={onPassarMouse}
            />
            </Fragment>
          ))}
          {esqueletoAntesDe === null && desenharEsqueleto}

          {carregandoMais && <Carregando variante="lista" linhas={2} rotulo="Carregando mais leads…" />}
          {erroAoCarregarMais && (
            <Aviso tom="erro" compacto acao={<Button variant="outline" size="sm" onClick={() => onCarregarMais(stage, { manual: true })}>Tentar de novo</Button>}>
              Não deu pra carregar mais leads.
            </Aviso>
          )}

          {/* Empty state */}
          {naColuna === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-sm">{t('kanban.stage.noConversations')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Onde o card pego vai cair: um card cinza do mesmo tamanho. Segura o dragover
// (senão a coluna recalcula o ponto por baixo dele) e aceita o drop no lugar.
function EsqueletoDoCard({ altura, onDrop }: { altura: number; onDrop: (e: DragEvent) => void }) {
  return (
    <div
      data-esqueleto-do-card
      aria-hidden="true"
      style={{ height: altura }}
      className="rounded-xl border border-primary/30 bg-background/70 p-3 shadow-sm"
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={onDrop}
    >
      <div className="flex items-start gap-2">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
