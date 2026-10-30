// RASCUNHO (spike de 30/10/2026): compara o card do funil, Conversas e o
// construtor de hoje com a proposta na linguagem do Vidro violeta. Não vai pro
// ar: vive só na prévia. "Depois" carimba data-vv-telas no <html>; o desenho mora
// em styles/vv-telas.css.
import React, { useSyncExternalStore } from 'react';

type Modo = 'antes' | 'depois';
const CHAVE = 'lmflow:vv-telas';

function lerInicial(): Modo {
  try {
    const daUrl = new URLSearchParams(window.location.search).get('telas');
    if (daUrl === 'antes' || daUrl === 'depois') {
      localStorage.setItem(CHAVE, daUrl);
      return daUrl;
    }
    return localStorage.getItem(CHAVE) === 'antes' ? 'antes' : 'depois';
  } catch {
    return 'depois';
  }
}

function aplicar(m: Modo) {
  if (m === 'depois') document.documentElement.dataset.vvTelas = '';
  else delete document.documentElement.dataset.vvTelas;
}

let atual: Modo = lerInicial();
aplicar(atual);
const ouvintes = new Set<() => void>();

function escolher(m: Modo) {
  atual = m;
  try {
    localStorage.setItem(CHAVE, m);
  } catch {
    // sem localStorage vale só nesta aba
  }
  aplicar(m);
  ouvintes.forEach(f => f());
}

export function useTelasNovas(): boolean {
  return useSyncExternalStore(
    f => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => atual === 'depois',
  );
}

export const AntesDepois: React.FC = () => {
  const novas = useTelasNovas();
  return (
    <div className="vv-troca" role="group" aria-label="Comparar telas">
      <span className="vv-troca-rotulo">Rascunho: funil, Conversas e construtor</span>
      <button type="button" aria-pressed={!novas} onClick={() => escolher('antes')}>Antes</button>
      <button type="button" aria-pressed={novas} onClick={() => escolher('depois')}>Depois</button>
    </div>
  );
};
