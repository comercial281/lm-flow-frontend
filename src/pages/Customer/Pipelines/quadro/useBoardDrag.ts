// src/pages/Customer/Pipelines/quadro/useBoardDrag.ts
// Arrastar no quadro do funil: o card (de coluna e de posição dentro dela), o
// fundo (rolar pro lado) e a roda do mouse. Saiu do PipelineKanban.tsx sem
// mudar comportamento (spec funil §4.5).
import {
  useCallback, useEffect, useRef, useState,
  type Dispatch, type DragEvent, type MouseEvent as ReactMouseEvent, type SetStateAction, type WheelEvent,
} from 'react';
import { toast } from 'sonner';
import { pipelinesService } from '@/services/pipelines';
import { situacaoDe } from '@/features/pipelines/situacao/situacao';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import { itemPos } from '../pipelineItemHelpers';

interface OpcoesDoArraste {
  pipelineId?: string;
  stages: PipelineStage[];
  setStages: Dispatch<SetStateAction<PipelineStage[]>>;
  /** Aviso quando o servidor recusa a mudança (o card volta pra onde estava). */
  mensagemDeErro: string;
}

export function useBoardDrag({ pipelineId, stages, setStages, mensagemDeErro }: OpcoesDoArraste) {
  const [draggedItem, setDraggedItem] = useState<PipelineItem | null>(null);
  const isDraggingRef = useRef(false);
  const suppressClickUntilRef = useRef(0);

  // Scroll horizontal do board — feito por arrastar-pra-rolar e roda do mouse.
  // O scroll nativo é pouco descobrível no desktop.
  const boardScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll enquanto arrasta um card: chegar perto da borda do board rola
  // na horizontal (pra alcançar coluna escondida); perto do topo/fundo de uma
  // coluna rola a lista de cards dela. Usa setInterval (não rAF) pra rodar
  // independente de a aba estar visível ou não. dragPointer guarda a última
  // posição do cursor capturada no onDragOver.
  const dragPointerRef = useRef({ x: 0, y: 0, active: false });
  const autoScrollRef = useRef<number | null>(null);
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current != null) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
    dragPointerRef.current = { x: 0, y: 0, active: false };
  }, []);
  const startAutoScroll = useCallback(() => {
    if (autoScrollRef.current != null) return;
    const EDGE = 90; // zona de borda (px) que ativa o scroll
    const SPEED = 14; // px por tick
    autoScrollRef.current = window.setInterval(() => {
      const board = boardScrollRef.current;
      const p = dragPointerRef.current;
      if (!board || !p.active) return;
      const r = board.getBoundingClientRect();
      // horizontal
      if (p.x < r.left + EDGE) board.scrollLeft -= SPEED;
      else if (p.x > r.right - EDGE) board.scrollLeft += SPEED;
      // vertical: a lista de cards da coluna sob o cursor
      const col = (document.elementFromPoint(p.x, p.y) as HTMLElement | null)?.closest(
        '[data-col-scroll]',
      ) as HTMLElement | null;
      if (col) {
        const cr = col.getBoundingClientRect();
        if (p.y < cr.top + EDGE) col.scrollTop -= SPEED;
        else if (p.y > cr.bottom - EDGE) col.scrollTop += SPEED;
      }
    }, 16);
  }, []);
  // Captura a posição do cursor durante o arraste (dragover do board inteiro).
  const handleBoardDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    dragPointerRef.current = { x: e.clientX, y: e.clientY, active: true };
  }, []);

  // Arrastar-pra-rolar (pan): clicar no fundo do board e arrastar move na
  // horizontal — scroll lateral natural no desktop, sem depender de seta nem da
  // barrinha. Não inicia se o clique foi num card/botão/input (deixa o drag do
  // card e os cliques funcionarem normal).
  const panRef = useRef({ active: false, startX: 0, startScroll: 0, moved: false });
  const handleBoardMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    const el = boardScrollRef.current;
    if (!el) return;
    if (
      (e.target as HTMLElement).closest(
        '[draggable="true"], button, a, input, textarea, select, [role="button"], [data-no-pan]',
      )
    ) {
      return;
    }
    panRef.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    el.style.cursor = 'grabbing';
  }, []);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const p = panRef.current;
      if (!p.active) return;
      const el = boardScrollRef.current;
      if (!el) return;
      const dx = e.clientX - p.startX;
      if (Math.abs(dx) > 3) p.moved = true;
      el.scrollLeft = p.startScroll - dx;
    };
    const onUp = () => {
      const p = panRef.current;
      if (!p.active) return;
      p.active = false;
      const el = boardScrollRef.current;
      if (el) el.style.cursor = '';
      // bloqueia o clique fantasma logo após um arraste real
      if (p.moved) suppressClickUntilRef.current = Date.now() + 200;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Roda do mouse vertical vira scroll horizontal quando o cursor está sobre o
  // board mas fora de uma lista de cards (colunas têm scroll vertical próprio).
  const handleBoardWheel = useCallback((e: WheelEvent) => {
    if (e.deltaY === 0 || e.shiftKey) return;
    const overColumnList = (e.target as HTMLElement).closest('[data-col-scroll]');
    if (overColumnList) return; // deixa a roda rolar os cards da coluna
    const el = boardScrollRef.current;
    if (!el) return;
    el.scrollLeft += e.deltaY;
  }, []);

  // Viram useCallback (referência estável) porque handleDragStart/handleCardDragOver/
  // handleCardDrop/handleDragEnd são passados como prop pro PipelineItemCard
  // memoizado — sem isso, cada render do board recriava a função e quebrava o
  // memo (card inteiro re-renderizava mesmo sem o item mudar).
  const handleDragStart = useCallback((item: PipelineItem) => {
    // Card ganho/perdido não muda de etapa: reabre antes (spec funil §3.5).
    if (situacaoDe(item) !== 'open') return;
    setDraggedItem(item);
    isDraggingRef.current = true;
    suppressClickUntilRef.current = Date.now() + 200;
    startAutoScroll();
  }, [startAutoScroll]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  // Limpa o estado de arraste (reuso entre drop em coluna e em card).
  const finishDrag = useCallback(() => {
    setDraggedItem(null);
    isDraggingRef.current = false;
    suppressClickUntilRef.current = Date.now() + 200;
    stopAutoScroll();
  }, [stopAutoScroll]);

  // Onde o cursor está sobre o card alvo (metade de cima = acima, baixo = abaixo).
  const dragOverPosRef = useRef<'above' | 'below'>('above');

  // Move/reordena o card arrastado para targetStageId na position newPos,
  // inserindo no índice insertIdx (no array já SEM o card arrastado).
  // Atualização otimista + persistência via /reorder.
  const commitReorder = useCallback(async (targetStageId: string, newPos: number, insertIdx: number) => {
    if (!draggedItem || !pipelineId) {
      finishDrag();
      return;
    }
    const fromStageId = draggedItem.stage_id;
    const previousStages = stages;
    const moved = {
      ...draggedItem,
      stage_id: targetStageId,
      pipeline_stage_id: targetStageId,
      position: newPos,
    };
    const next = stages.map(stage => {
      let items = (stage.items || []).filter(i => i.id !== draggedItem.id);
      if (stage.id === targetStageId) {
        items = [...items];
        const idx = Math.max(0, Math.min(insertIdx, items.length));
        items.splice(idx, 0, moved);
      }
      return { ...stage, items };
    });
    setStages(next);

    try {
      await pipelinesService.reorderItem(pipelineId, draggedItem.id, {
        position: newPos,
        ...(fromStageId !== targetStageId ? { new_stage_id: targetStageId } : {}),
      });
    } catch (error) {
      console.error('Error reordering item:', error);
      setStages(previousStages);
      toast.error(mensagemDeErro);
    } finally {
      finishDrag();
    }
  }, [draggedItem, pipelineId, stages, setStages, mensagemDeErro, finishDrag]);

  // Drop na área da coluna (fora de um card):
  // - outra coluna: lead vai pro TOPO da coluna destino.
  // - mesma coluna (área vazia abaixo dos cards): manda o card pro FUNDO.
  //   Sem isso, arrastar pro espaço vazio embaixo não fazia nada e dava a
  //   impressão de que o card "não desce".
  const handleDrop = useCallback((e: DragEvent, targetStageId: string) => {
    e.preventDefault();
    if (!draggedItem) return;
    const targetStage = stages.find(s => s.id === targetStageId);
    const items = (targetStage?.items || []).filter(i => i.id !== draggedItem.id);
    if (draggedItem.stage_id === targetStageId) {
      // mesma coluna: já está sozinho na coluna → nada a fazer
      if (!items.length) {
        finishDrag();
        return;
      }
      // fundo da coluna: position menor que a do último card
      const newPos = itemPos(items[items.length - 1]) - 1;
      void commitReorder(targetStageId, newPos, items.length);
      return;
    }
    const newPos = items.length ? itemPos(items[0]) + 1 : Date.now() / 1000;
    void commitReorder(targetStageId, newPos, 0);
  }, [draggedItem, stages, commitReorder, finishDrag]);

  // Marca acima/abaixo conforme a metade do card sob o cursor.
  const handleCardDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOverPosRef.current = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
  }, []);

  // Drop em cima de um card: insere acima/abaixo dele e grava a position no
  // ponto médio entre os vizinhos (ou topo+1 / fundo-1 nas pontas).
  const handleCardDrop = useCallback((e: DragEvent, targetItem: PipelineItem, targetStageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.id === targetItem.id) {
      finishDrag();
      return;
    }
    const where = dragOverPosRef.current;
    const targetStage = stages.find(s => s.id === targetStageId);
    if (!targetStage) {
      finishDrag();
      return;
    }
    const arr = (targetStage.items || []).filter(i => i.id !== draggedItem.id);
    const at = arr.findIndex(i => i.id === targetItem.id);
    if (at < 0) {
      finishDrag();
      return;
    }
    const insertIdx = where === 'above' ? at : at + 1;
    const above = arr[insertIdx - 1];
    const below = arr[insertIdx];
    let newPos: number;
    if (!above) newPos = itemPos(below) + 1;
    else if (!below) newPos = itemPos(above) - 1;
    else newPos = (itemPos(above) + itemPos(below)) / 2;
    void commitReorder(targetStageId, newPos, insertIdx);
  }, [draggedItem, stages, commitReorder, finishDrag]);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    suppressClickUntilRef.current = Date.now() + 200;
    stopAutoScroll();
  }, [stopAutoScroll]);

  // Garante que o auto-scroll do drag pare se o quadro desmontar no meio.
  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  return {
    boardScrollRef,
    isDraggingRef,
    suppressClickUntilRef,
    handleBoardDragOver,
    handleBoardMouseDown,
    handleBoardWheel,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleCardDragOver,
    handleCardDrop,
    handleDragEnd,
  };
}
