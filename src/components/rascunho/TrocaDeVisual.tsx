// RASCUNHO (spike de 30/10/2026): troca entre o visual de hoje e as duas
// propostas de design system (A · Vidro violeta, B · Claro refinado).
// Não vai pro ar: vive só na branch claude/ds-propostas e na prévia da Vercel.
// A escolha carimba data-ds no <html>; o desenho mora em styles/ds-propostas.css.
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type Proposta = 'atual' | 'a' | 'b';

const CHAVE = 'lmflow:ds-proposta';
const OPCOES: { valor: Proposta; nome: string }[] = [
  { valor: 'atual', nome: 'Atual' },
  { valor: 'a', nome: 'A · Vidro violeta' },
  { valor: 'b', nome: 'B · Claro refinado' },
];

const valida = (v: string | null | undefined): v is Proposta => v === 'atual' || v === 'a' || v === 'b';

// ?ds=a no endereço vale mais que a escolha guardada (link pronto pra mandar pro Giovani).
function lerInicial(): Proposta {
  try {
    const daUrl = new URLSearchParams(window.location.search).get('ds');
    if (valida(daUrl)) {
      localStorage.setItem(CHAVE, daUrl);
      return daUrl;
    }
    const guardada = localStorage.getItem(CHAVE);
    if (valida(guardada)) return guardada;
  } catch {
    // navegador sem localStorage: fica na proposta A
  }
  return 'a';
}

function aplicar(p: Proposta) {
  if (p === 'atual') delete document.documentElement.dataset.ds;
  else document.documentElement.dataset.ds = p;
}

let atual: Proposta = lerInicial();
aplicar(atual);
const ouvintes = new Set<() => void>();

function escolher(p: Proposta) {
  atual = p;
  try {
    localStorage.setItem(CHAVE, p);
  } catch {
    // sem localStorage a escolha vale só nesta aba
  }
  aplicar(p);
  ouvintes.forEach(f => f());
}

export function useProposta(): Proposta {
  return useSyncExternalStore(
    f => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => atual,
  );
}

export const TrocaDeVisual: React.FC = () => {
  const proposta = useProposta();
  return (
    <div className="ds-troca" role="group" aria-label="Proposta de visual">
      <span className="ds-troca-rotulo">Rascunho de visual</span>
      {OPCOES.map(o => (
        <button key={o.valor} type="button" aria-pressed={proposta === o.valor} onClick={() => escolher(o.valor)}>
          {o.nome}
        </button>
      ))}
    </div>
  );
};

/** Grade e bolhas que derivam atrás do app. Só aparece na proposta A (CSS). */
export const FundoVivo: React.FC = () => (
  <div className="ds-fundo-vivo" aria-hidden="true">
    <div className="ds-grade" />
    <div className="ds-bolha ds-bolha-a" />
    <div className="ds-bolha ds-bolha-b" />
    <div className="ds-bolha ds-bolha-c" />
  </div>
);

const reduzMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Número que conta até o valor ao abrir (e ao trocar de proposta). No visual de
 * hoje, ou com "reduzir movimento" no sistema, mostra o valor direto.
 */
export const NumeroQueConta: React.FC<{ valor: number; formatar: (n: number) => string }> = ({ valor, formatar }) => {
  const proposta = useProposta();
  const [mostrado, setMostrado] = useState(proposta === 'atual' ? valor : 0);
  const anterior = useRef(proposta === 'atual' ? valor : 0);
  const propostaAnterior = useRef(proposta);

  useEffect(() => {
    if (proposta === 'atual' || reduzMovimento()) {
      anterior.current = valor;
      propostaAnterior.current = proposta;
      setMostrado(valor);
      return;
    }
    const de = propostaAnterior.current !== proposta ? 0 : anterior.current;
    propostaAnterior.current = proposta;
    const duracao = proposta === 'a' ? 1200 : 700;
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - inicio) / duracao);
      const suave = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setMostrado(de + (valor - de) * suave);
      if (p < 1) quadro = requestAnimationFrame(passo);
      else anterior.current = valor;
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, proposta]);

  return <>{formatar(Math.round(mostrado))}</>;
};
