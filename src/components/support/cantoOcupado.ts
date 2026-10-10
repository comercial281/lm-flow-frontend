import { useEffect, useSyncExternalStore } from 'react';

// ── Canto inferior direito ocupado (10/10/2026, pedido do dono) ──────────────
//
// A bolinha do suporte mora no canto inferior direito e cobria a paginação das
// listas e o Salvar da barra "Alterações não salvas". Quem põe coisa nesse canto
// avisa aqui (`useOcupaCanto`), e enquanto alguém ocupa o SupportWidget troca a
// bolinha pela aba presa na borda direita. Contador, não booleano: duas peças
// podem ocupar ao mesmo tempo (a lista de Conta + a barra de Salvar).

let ocupantes = 0;
const ouvintes = new Set<() => void>();

const avisar = () => ouvintes.forEach(f => f());

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
};

const ler = () => ocupantes > 0;

/** Enquanto `ativo`, o canto conta como ocupado. Solta sozinho ao desmontar. */
export function useOcupaCanto(ativo = true) {
  useEffect(() => {
    if (!ativo) return;
    ocupantes += 1;
    avisar();
    return () => {
      ocupantes -= 1;
      avisar();
    };
  }, [ativo]);
}

export const useCantoOcupado = (): boolean => useSyncExternalStore(assinar, ler, ler);
