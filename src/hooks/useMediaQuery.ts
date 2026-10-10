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

/**
 * Tela de celular: abaixo do `md` do Tailwind (768px), o mesmo corte do menu do
 * celular e do construtor de fluxos. Raio-X do celular, 10/10/2026: card do lead
 * abre como página e o suporte vira sempre a aba da borda.
 */
export const TELA_DE_CELULAR = '(max-width: 767px)';

export function useTelaDeCelular(): boolean {
  return useMediaQuery(TELA_DE_CELULAR);
}

/** O mesmo corte, lido na hora (fora de componente, ex.: num clique). */
export function ehTelaDeCelular(): boolean {
  return consultar(TELA_DE_CELULAR);
}
