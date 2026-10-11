import { vi } from 'vitest';
import { CONSULTA_CELULAR } from '@/hooks/useCelular';

// Testes do Raio-X do celular (10/10/2026): o jsdom não tem `matchMedia`, e sem
// ele o `useCelular` responde "computador". Isto finge a tela de celular só
// para a consulta do celular; qualquer outra consulta responde `false`.
//
//   const tela = simularCelular();   // antes de desenhar
//   tela.mudar(false);               // "gira" a tela: avisa quem escuta
//   tela.restaurar();                // no afterEach

export function simularCelular(celularInicial = true) {
  const original = window.matchMedia;
  let celular = celularInicial;
  const ouvintes = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() { return celular && query === CONSULTA_CELULAR; },
    media: query,
    addEventListener: (_: string, fn: () => void) => ouvintes.add(fn),
    removeEventListener: (_: string, fn: () => void) => ouvintes.delete(fn),
    addListener: (fn: () => void) => ouvintes.add(fn),
    removeListener: (fn: () => void) => ouvintes.delete(fn),
  })) as unknown as typeof window.matchMedia;
  return {
    mudar(novo: boolean) {
      celular = novo;
      ouvintes.forEach(fn => fn());
    },
    restaurar() {
      window.matchMedia = original;
    },
  };
}
