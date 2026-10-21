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
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import { comSituacaoNova, ehColunaDeFollowup, ehColunaDeGanho, mensagemDaRecusa } from '@/features/pipelines/situacao/situacao';
import { itemPos } from '../pipelineItemHelpers';
import { indiceDoArraste, type AlvoDoArraste } from './ondeOCardCai';

// Position logo abaixo do último card visível. Na coluna com cards ainda não
// carregados (quadro em lotes), "- 1" podia passar por baixo deles: o card ia
// parar no meio dos que a pessoa nem vê. Um passo mínimo o deixa colado no último.
function abaixoDoUltimo(coluna: PipelineStage | undefined, ultimo: PipelineItem): number {
  const temNaoCarregados = (coluna?.items_total ?? 0) > (coluna?.items?.length ?? 0);
  return itemPos(ultimo) - (temNaoCarregados ? 1e-4 : 1);
}

interface OpcoesDoArraste {
  pipelineId?: string;
  stages: PipelineStage[];
  setStages: Dispatch<SetStateAction<PipelineStage[]>>;
  /** Aviso quando o servidor recusa a mudança (o card volta pra onde estava). */
  mensagemDeErro: string;
  /** A aba decide (podeArrastarNaAba): Ganhos, Perdidos e Arquivados não arrastam. */
  podeArrastar: (item: PipelineItem) => boolean;
  /**
   * Soltar em Concluído marcou Ganho (ajuste de 08/10): o quadro recebe o card
   * que o servidor devolveu (sai de Abertos, os números se refazem).
   */
  aoGanhar?: (item: PipelineItem) => void;
  /**
   * Soltar na coluna Follow-up (Fase 2, 20/10/2026) não move o card: abre a
   * janela "Colocar em follow-up". Quem move é o servidor, quando o follow-up
   * começa. `terminar` encerra o arraste (Iniciar e Cancelar chamam); o card
   * nunca saiu do lugar, então Cancelar não tem o que desfazer.
   */
  aoSoltarNoFollowup?: (item: PipelineItem, terminar: () => void) => void;
}

export function useBoardDrag({ pipelineId, stages, setStages, mensagemDeErro, podeArrastar, aoGanhar, aoSoltarNoFollowup }: OpcoesDoArraste) {
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

  // Esqueleto do arraste: o card pego vira contorno tracejado no lugar dele
  // (`arraste`) e a coluna sob o cursor ganha um card-esqueleto onde ele vai cair
  // (`alvo`). O ref do alvo é o que o drop lê: o dragover não é evento discreto e
  // o estado pode não ter assentado quando o drop chega.
  const [arraste, setArraste] = useState<{ id: string; altura: number } | null>(null);
  const [alvo, setAlvo] = useState<AlvoDoArraste | null>(null);
  const alvoRef = useRef<AlvoDoArraste | null>(null);
  const arrastadoRef = useRef<PipelineItem | null>(null);
  const stagesRef = useRef(stages);
  stagesRef.current = stages;
  const rafRef = useRef<number | null>(null);

  const limparEsqueleto = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    alvoRef.current = null;
    arrastadoRef.current = null;
    setArraste(null);
    setAlvo(null);
  }, []);

  // Só troca o estado quando o ponto de queda muda (o dragover dispara sem parar).
  const marcarAlvo = useCallback((stageId: string, sobre?: { id: string; metade: 'above' | 'below' }) => {
    const arrastado = arrastadoRef.current;
    if (!arrastado) return;
    const coluna = stagesRef.current.find(s => s.id === stageId);
    if (!coluna) return;
    const indice = indiceDoArraste({
      itens: coluna.items || [],
      arrastadoId: arrastado.id,
      mesmaColuna: arrastado.stage_id === stageId,
      colunaDeGanho: ehColunaDeGanho(coluna),
      sobre,
    });
    const novo = indice == null ? null : { stageId, indice };
    const atual = alvoRef.current;
    if (atual?.stageId === novo?.stageId && atual?.indice === novo?.indice) return;
    alvoRef.current = novo;
    setAlvo(novo);
  }, []);

  // Viram useCallback (referência estável) porque handleDragStart/handleCardDragOver/
  // handleCardDrop/handleDragEnd são passados como prop pro PipelineItemCard
  // memoizado — sem isso, cada render do board recriava a função e quebrava o
  // memo (card inteiro re-renderizava mesmo sem o item mudar).
  const handleDragStart = useCallback((item: PipelineItem, altura?: number) => {
    // Card que a aba não deixa arrastar: nem começa (o dragstart sintético dispara mesmo com draggable="false").
    if (!podeArrastar(item)) return;
    setDraggedItem(item);
    arrastadoRef.current = item;
    alvoRef.current = null;
    isDraggingRef.current = true;
    suppressClickUntilRef.current = Date.now() + 200;
    startAutoScroll();
    // O contorno entra no quadro seguinte: o navegador tira a foto do card que
    // segue o cursor ao fim do dragstart, e ela tem que ser a do card normal.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (arrastadoRef.current?.id === item.id) setArraste({ id: item.id, altura: altura || 88 });
    });
  }, [startAutoScroll, podeArrastar]);

  // Dragover no espaço da coluna (fora de um card): acha o card logo abaixo do
  // cursor, pra o vão entre dois cards não jogar o esqueleto pro topo e voltar.
  // Abaixo de todos é o espaço vazio da coluna (outra coluna = topo, mesma = fundo).
  const handleDragOver = useCallback((e: DragEvent, stageId?: string) => {
    e.preventDefault();
    const arrastado = arrastadoRef.current;
    if (!arrastado || !stageId) return;
    const cards = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-card-id]');
    let sobre: { id: string; metade: 'above' | 'below' } | undefined;
    for (const card of Array.from(cards)) {
      const id = card.dataset.cardId;
      if (!id || id === arrastado.id) continue;
      const r = card.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        sobre = { id, metade: 'above' };
        break;
      }
    }
    marcarAlvo(stageId, sobre);
  }, [marcarAlvo]);

  // Limpa o estado de arraste (reuso entre drop em coluna e em card).
  const finishDrag = useCallback(() => {
    setDraggedItem(null);
    limparEsqueleto();
    isDraggingRef.current = false;
    suppressClickUntilRef.current = Date.now() + 200;
    stopAutoScroll();
  }, [stopAutoScroll, limparEsqueleto]);

  // Concluído é a coluna do Ganho (ajuste de 08/10): soltar o card nela marca
  // Ganho pela mesma rota do botão. O card vai na hora para Concluído, já ganho;
  // o servidor confirma (e roda os efeitos) ou recusa com a frase pronta.
  const ganhar = useCallback(async (targetStageId: string) => {
    if (!draggedItem || !pipelineId) {
      finishDrag();
      return;
    }
    const previousStages = stages;
    const ganho = {
      ...draggedItem, stage_id: targetStageId, pipeline_stage_id: targetStageId, status: 'won',
    } as PipelineItem;
    setStages(stages.map(stage => {
      const items = (stage.items || []).filter(i => i.id !== draggedItem.id);
      return stage.id === targetStageId ? { ...stage, items: [ganho, ...items] } : { ...stage, items };
    }));
    // O card já está no destino: some o esqueleto agora, não quando o servidor responder.
    limparEsqueleto();
    try {
      const resposta = await pipelinesService.setItemStatus(pipelineId, draggedItem.id, { status: 'won' });
      toast.success('Lead marcado como ganho.');
      aoGanhar?.(comSituacaoNova(ganho, resposta));
    } catch (erro) {
      setStages(previousStages);
      toast.error(mensagemDaRecusa(erro, 'Não consegui marcar o lead como ganho.'));
    } finally {
      finishDrag();
    }
  }, [draggedItem, pipelineId, stages, setStages, finishDrag, aoGanhar, limparEsqueleto]);

  // Move/reordena o card arrastado para targetStageId na position newPos,
  // inserindo no índice insertIdx (no array já SEM o card arrastado).
  // Atualização otimista + persistência via /reorder.
  const commitReorder = useCallback(async (targetStageId: string, newPos: number, insertIdx: number) => {
    if (!draggedItem || !pipelineId) {
      finishDrag();
      return;
    }
    if (draggedItem.stage_id !== targetStageId && ehColunaDeGanho(stages.find(s => s.id === targetStageId))) {
      void ganhar(targetStageId);
      return;
    }
    // Coluna Follow-up: pergunta antes (janela), sem mexer no quadro nem no servidor.
    if (aoSoltarNoFollowup && draggedItem.stage_id !== targetStageId && ehColunaDeFollowup(stages.find(s => s.id === targetStageId))) {
      limparEsqueleto();
      aoSoltarNoFollowup(draggedItem, finishDrag);
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
    limparEsqueleto();

    try {
      await pipelinesService.reorderItem(pipelineId, draggedItem.id, {
        position: newPos,
        ...(fromStageId !== targetStageId ? { new_stage_id: targetStageId } : {}),
      });
    } catch (error) {
      console.error('Error reordering item:', error);
      setStages(previousStages);
      // Card fechado em outra guia: o servidor recusa com "Lead fechado não muda de etapa".
      toast.error(mensagemDaRecusa(error, mensagemDeErro));
    } finally {
      finishDrag();
    }
  }, [draggedItem, pipelineId, stages, setStages, mensagemDeErro, finishDrag, ganhar, limparEsqueleto, aoSoltarNoFollowup]);

  // Soltar: o card cai onde o esqueleto mostrou (`alvoRef`, regra em ondeOCardCai).
  // A position fica entre os vizinhos do índice (ou topo+1 / fundo-1 nas pontas).
  // Sem alvo (soltou onde já estava), nada muda.
  const soltar = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;
    const destino = alvoRef.current;
    const targetStage = destino ? stages.find(s => s.id === destino.stageId) : undefined;
    if (!destino || !targetStage) {
      finishDrag();
      return;
    }
    const arr = (targetStage.items || []).filter(i => i.id !== draggedItem.id);
    const above = arr[destino.indice - 1];
    const below = arr[destino.indice];
    let newPos: number;
    if (!above && !below) newPos = Date.now() / 1000;
    else if (!above) newPos = itemPos(below) + 1;
    else if (!below) newPos = abaixoDoUltimo(targetStage, above);
    else newPos = (itemPos(above) + itemPos(below)) / 2;
    void commitReorder(destino.stageId, newPos, destino.indice);
  }, [draggedItem, stages, commitReorder, finishDrag]);

  // Drop na área da coluna, num card ou no esqueleto: todos caem no mesmo ponto.
  const handleDrop = soltar;
  const handleCardDrop = soltar;

  // Marca acima/abaixo conforme a metade do card sob o cursor.
  const handleCardDragOver = useCallback((e: DragEvent, item?: PipelineItem, stageId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!item || !stageId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    marcarAlvo(stageId, { id: item.id, metade: e.clientY < rect.top + rect.height / 2 ? 'above' : 'below' });
  }, [marcarAlvo]);

  // Esc ou soltou fora do quadro: o dragend chega sem drop. Tudo volta ao normal.
  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    suppressClickUntilRef.current = Date.now() + 200;
    stopAutoScroll();
    limparEsqueleto();
  }, [stopAutoScroll, limparEsqueleto]);

  // Garante que o auto-scroll do drag pare se o quadro desmontar no meio.
  useEffect(() => () => {
    stopAutoScroll();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, [stopAutoScroll]);

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
    arraste,
    alvo,
  };
}
