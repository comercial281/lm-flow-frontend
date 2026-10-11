import { useEffect, useState } from 'react';

const consultar = (query: string): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;

/**
 * `true` enquanto a tela casa com a media query (ex.: '(min-width: 1280px)').
 * Já nasce com o valor certo (sem piscar no primeiro desenho) e acompanha o
 * redimensionamento. Sem `window`/`matchMedia` (servidor, teste), devolve `false`.
 */
export function useMediaQuery(query: string): boolean {
  const [casa, setCasa] = useState(() => consultar(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const atualizar = () => setCasa(mql.matches);
    atualizar();
    mql.addEventListener('change', atualizar);
    return () => mql.removeEventListener('change', atualizar);
  }, [query]);

  return casa;
}
