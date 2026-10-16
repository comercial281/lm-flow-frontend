// src/pages/Customer/Properties/lista/useCardNoMapa.ts
// Quando abrir e fechar o card do alfinete no Mapa. Com mouse: abre parado
// 0,3 s em cima do alfinete, e o clique no alfinete já leva ao imóvel. Com dedo
// (sem "passar o mouse"): o toque no alfinete abre o card, e o toque no card leva.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PropertyMapMarker } from '@/services/properties/propertiesService';
import { ESPERA_DO_CARD_NO_MAPA_MS } from './pinoDoMapa';
import type { AlvoDoCardNoMapa } from './CardNoMapa';

// Folga pra levar o mouse do alfinete até o card sem ele sumir no caminho.
const FOLGA_PRA_SAIR_MS = 150;

const alvoDe = (imovel: PropertyMapMarker, el: HTMLElement): AlvoDoCardNoMapa => {
  const r = el.getBoundingClientRect();
  return { imovel, pino: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } };
};

export function useCardNoMapa(irPara: (imovel: PropertyMapMarker) => boolean) {
  const [alvo, setAlvo] = useState<AlvoDoCardNoMapa | null>(null);
  const alvoRef = useRef<AlvoDoCardNoMapa | null>(null);
  alvoRef.current = alvo;
  // Último ponteiro visto no mapa: o "mouseover" do Leaflet também chega no toque.
  const ponteiroRef = useRef<string | null>(null);
  const abrirRef = useRef<number | null>(null);
  const fecharRef = useRef<number | null>(null);
  const irParaRef = useRef(irPara);
  irParaRef.current = irPara;

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

  const fecharDepois = useCallback(() => {
    if (abrirRef.current != null) window.clearTimeout(abrirRef.current);
    abrirRef.current = null;
    if (fecharRef.current == null && alvoRef.current) {
      fecharRef.current = window.setTimeout(() => {
        fecharRef.current = null;
        setAlvo(null);
      }, FOLGA_PRA_SAIR_MS);
    }
  }, []);

  const segurar = useCallback(() => {
    if (fecharRef.current != null) window.clearTimeout(fecharRef.current);
    fecharRef.current = null;
  }, []);

  // Caneta conta como dedo, igual ao mini card do funil.
  const aoVerPonteiro = useCallback((tipo: string) => { ponteiroRef.current = tipo === 'mouse' ? 'mouse' : 'toque'; }, []);

  const aoEntrarNoPino = useCallback((imovel: PropertyMapMarker, el: HTMLElement) => {
    if (ponteiroRef.current !== 'mouse') return;
    segurar();
    if (alvoRef.current?.imovel.id === imovel.id) return;
    if (abrirRef.current != null) window.clearTimeout(abrirRef.current);
    abrirRef.current = window.setTimeout(() => {
      abrirRef.current = null;
      if (el.isConnected) setAlvo(alvoDe(imovel, el));
    }, ESPERA_DO_CARD_NO_MAPA_MS);
  }, [segurar]);

  const aoClicarNoPino = useCallback((imovel: PropertyMapMarker, el: HTMLElement) => {
    // Mouse (ou teclado): o clique já leva. Sem destino, ou no dedo, mostra o card.
    if (ponteiroRef.current !== 'toque' && irParaRef.current(imovel)) {
      fechar();
      return;
    }
    limpar();
    setAlvo(alvoDe(imovel, el));
  }, [fechar, limpar]);

  // Aberto: arrastar ou dar zoom no mapa (quem chama), rolar a página,
  // redimensionar ou Esc fecham.
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

  return { alvo, aoVerPonteiro, aoEntrarNoPino, aoSairDoPino: fecharDepois, aoClicarNoPino, segurar, fecharDepois, fechar };
}
