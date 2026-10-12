// "Ver como" da Leal Mídia na Área de Membros: mostra a tela como um gestor ou
// um corretor veria, sem trocar de conta. Vale pra aba inteira (home e aula) e
// some ao fechar a aba (sessionStorage).

import { useSyncExternalStore } from 'react';
import type { CargoNaAcademia } from './quemVe';

const CHAVE = 'lmflow:academia:ver-como';
const VALIDOS: CargoNaAcademia[] = ['admin', 'gestor', 'corretor'];

function ler(): CargoNaAcademia | null {
  try {
    const v = sessionStorage.getItem(CHAVE);
    return VALIDOS.includes(v as CargoNaAcademia) ? (v as CargoNaAcademia) : null;
  } catch {
    return null;
  }
}

let atual: CargoNaAcademia | null = ler();
const ouvintes = new Set<() => void>();

export function definirVerComo(c: CargoNaAcademia | null): void {
  atual = c;
  try {
    if (c) sessionStorage.setItem(CHAVE, c);
    else sessionStorage.removeItem(CHAVE);
  } catch {
    // navegador sem armazenamento: vale só na memória
  }
  ouvintes.forEach((fn) => fn());
}

function assinar(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function useVerComo(): CargoNaAcademia | null {
  return useSyncExternalStore(assinar, () => atual, () => null);
}
