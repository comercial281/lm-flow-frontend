import { useMediaQuery } from './useMediaQuery';

// ── CELULAR: O MESMO CORTE DO MENU ───────────────────────────────────────────
//
// Abaixo de 768px (o `md` do Tailwind) o app é "celular": o menu vira a gaveta
// do ☰ e o construtor de fluxos já trocava os painéis por tela cheia. Raio-X do
// celular (10/10/2026): o que não serve na tela pequena some só aqui.
//
// É `max-width` de propósito: sem `matchMedia` (testes, servidor) o hook dá
// `false`, ou seja, "computador" — o que já existia continua aparecendo.

export const CONSULTA_CELULAR = '(max-width: 767px)';

/** `true` em tela de celular (abaixo de 768px). Acompanha o redimensionamento. */
export function useCelular(): boolean {
  return useMediaQuery(CONSULTA_CELULAR);
}
