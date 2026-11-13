import { useEffect, useState } from 'react';

const prefereMenosMovimento = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Índice da foto ativa. Sem timer com 1 foto ou com "reduzir animações"; pausa com a aba escondida. */
export function useSlideshow(total: number, intervaloMs = 6000): number {
  const [indice, setIndice] = useState(0);
  const [escondida, setEscondida] = useState(() => typeof document !== 'undefined' && document.hidden);

  // Mudou a quantidade de fotos: recomeça da primeira.
  useEffect(() => { setIndice(0); }, [total]);

  useEffect(() => {
    const aoMudar = () => setEscondida(document.hidden);
    document.addEventListener('visibilitychange', aoMudar);
    return () => document.removeEventListener('visibilitychange', aoMudar);
  }, []);

  useEffect(() => {
    if (total < 2 || escondida || prefereMenosMovimento()) return;
    const id = setInterval(() => setIndice(i => (i + 1) % total), intervaloMs);
    return () => clearInterval(id);
  }, [total, intervaloMs, escondida]);

  return total < 1 ? 0 : Math.min(indice, total - 1);
}
