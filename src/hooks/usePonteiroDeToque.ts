// src/hooks/usePonteiroDeToque.ts
// true quando a tela é de toque (celular, tablet) — ou quando o navegador não
// sabe responder (sem matchMedia: navegador antigo e o ambiente de testes).
// Nesses casos o Seletor usa a lista do sistema, que é a melhor de usar com o
// polegar. Acompanha a troca: iPad que conecta um mouse muda na hora.
import { useSyncExternalStore } from 'react';

// Não reaproveita o useMediaQuery: sem matchMedia ele devolve false e aqui o
// padrão é true (lista nativa); e useSyncExternalStore evita piscar no 1º desenho.
const CONSULTA = '(pointer: coarse)';

const consulta = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(CONSULTA)
    : null;

const assinar = (avisar: () => void) => {
  const lista = consulta();
  if (!lista) return () => {};
  lista.addEventListener('change', avisar);
  return () => lista.removeEventListener('change', avisar);
};

const ler = () => consulta()?.matches ?? true;

export function usePonteiroDeToque(): boolean {
  return useSyncExternalStore(assinar, ler, () => true);
}
