import { vi } from 'vitest';
import { CONSULTA_CELULAR } from '@/hooks/useCelular';

// Testes do Raio-X do celular (10/10/2026): o jsdom não tem `matchMedia`, e sem
// ele o `useCelular` responde "computador". Isto finge a tela de celular só
// para a consulta do celular; qualquer outra consulta responde `false`.
//
//   const tela = simularCelular();   // antes de desenhar
//   tela.restaurar();                // no afterEach

export function simularCelular(celular = true) {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: celular && query === CONSULTA_CELULAR,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
  return {
    restaurar() {
      window.matchMedia = original;
    },
  };
}
