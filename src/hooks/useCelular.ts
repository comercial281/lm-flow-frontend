import { useMediaQuery } from './useMediaQuery';

// ── CELULAR: O DETECTOR ÚNICO DA CASA ────────────────────────────────────────
//
// Abaixo de 768px (o `md` do Tailwind) o app é "celular": o menu vira a gaveta
// do ☰ e o construtor de fluxos troca os painéis por tela cheia. Raio-X do
// celular (10/10/2026): o que não serve na tela pequena some só aqui.
//
// `useCelular` (acompanha o redimensionamento), `ehCelular` (leitura de uma vez,
// fora de componente ou no começo da tela) e `CONSULTA_CELULAR` são o detector
// ÚNICO de celular. Não crie outro corte.
//
// É `max-width` de propósito: sem `matchMedia` (testes, servidor) a resposta é
// `false`, ou seja, "computador" — o que já existia continua aparecendo.

export const CONSULTA_CELULAR = '(max-width: 767px)';

/** `true` em tela de celular (abaixo de 768px). Acompanha o redimensionamento. */
export function useCelular(): boolean {
  return useMediaQuery(CONSULTA_CELULAR);
}

/**
 * A mesma pergunta, lida uma vez (fora de componente, ou pra decidir algo só na
 * abertura da tela e não seguir o redimensionamento). Sem `matchMedia`: `false`.
 */
export function ehCelular(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(CONSULTA_CELULAR)?.matches ?? false;
}
