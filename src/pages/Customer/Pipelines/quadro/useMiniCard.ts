// src/pages/Customer/Pipelines/quadro/useMiniCard.ts
// Quando abrir e fechar o mini card do quadro. Um só pro quadro inteiro: o card
// só avisa que o mouse entrou, saiu ou apertou (`aoPassarMouse`, estável).
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { PipelineItem } from '@/types/analytics';
import { ESPERA_DO_MINI_CARD_MS } from './miniCard';

export type EventoDoMouse = 'entrou' | 'saiu' | 'apertou';

export interface AlvoDoMiniCard {
  item: PipelineItem;
  rect: { left: number; right: number; top: number };
  ultimaColuna: boolean;
}

// Folga pra levar o mouse do card até o mini card sem ele sumir no caminho.
const FOLGA_PRA_SAIR_MS = 150;

export function useMiniCard(isDraggingRef: MutableRefObject<boolean>) {
  const [alvo, setAlvo] = useState<AlvoDoMiniCard | null>(null);
  const alvoRef = useRef<AlvoDoMiniCard | null>(null);
  alvoRef.current = alvo;
  const abrirRef = useRef<number | null>(null);
  const fecharRef = useRef<number | null>(null);

  const limpar = useCallback(() => {
    if (abrirRef.current != null) window.clearTimeout(abrirRef.current);
    if (fecharRef.current != null) window.clearTimeout(fecharRef.current);
    abrirRef.current = null;
    fecharRef.current = null;
  }, []);

  const fechar = useCallback(() => {
    limpar();
    setAlvo(null);
  }, [limpar]);

  const aoPassarMouse = useCallback((evento: EventoDoMouse, item: PipelineItem, el: HTMLElement) => {
    // Apertou (clique, arrasto, menu ⋯): sem resuminho até sair e voltar.
    if (evento === 'apertou') {
      fechar();
      return;
    }
    if (evento === 'saiu') {
      if (abrirRef.current != null) window.clearTimeout(abrirRef.current);
      abrirRef.current = null;
      if (fecharRef.current == null && alvoRef.current) {
        fecharRef.current = window.setTimeout(() => {
          fecharRef.current = null;
          setAlvo(null);
        }, FOLGA_PRA_SAIR_MS);
      }
      return;
    }
    if (isDraggingRef.current) return;
    if (fecharRef.current != null) window.clearTimeout(fecharRef.current);
    fecharRef.current = null;
    if (alvoRef.current?.item.id === item.id) return;
    if (alvoRef.current) setAlvo(null);
    if (abrirRef.current != null) window.clearTimeout(abrirRef.current);
    abrirRef.current = window.setTimeout(() => {
      abrirRef.current = null;
      if (isDraggingRef.current || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      const proxima = el.closest('[id^="etapa-"]')?.nextElementSibling;
      setAlvo({
        item,
        rect: { left: r.left, right: r.right, top: r.top },
        ultimaColuna: !(proxima && proxima.id.startsWith('etapa-')),
      });
    }, ESPERA_DO_MINI_CARD_MS);
  }, [fechar, isDraggingRef]);

  const aoEntrarNoMini = useCallback(() => {
    if (fecharRef.current != null) window.clearTimeout(fecharRef.current);
    fecharRef.current = null;
  }, []);

  // Aberto: rolar (o quadro ou uma coluna), redimensionar ou Esc fecham.
  useEffect(() => {
    if (!alvo) return;
    const aoTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    window.addEventListener('keydown', aoTecla);
    return () => {
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('keydown', aoTecla);
    };
  }, [alvo, fechar]);

  useEffect(() => limpar, [limpar]);

  return { alvo, aoPassarMouse, aoEntrarNoMini, aoSairDoMini: fechar, fechar };
}
