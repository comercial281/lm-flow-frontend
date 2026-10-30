import React, { useEffect, useRef, useState } from 'react';

// Sem matchMedia (jsdom dos testes) o número sai direto, sem contar.
const reduzMovimento = () =>
  typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Número que conta até o valor ao abrir a Dashboard e quando o valor muda (troca
 * de período ou de filtro), saindo do valor anterior. Com "reduzir movimento" no
 * sistema mostra o valor direto.
 */
export const NumeroQueConta: React.FC<{ valor: number; formatar: (n: number) => string }> = ({ valor, formatar }) => {
  const [mostrado, setMostrado] = useState(() => (reduzMovimento() ? valor : 0));
  const anterior = useRef(reduzMovimento() ? valor : 0);

  useEffect(() => {
    if (reduzMovimento()) {
      anterior.current = valor;
      setMostrado(valor);
      return;
    }
    const de = anterior.current;
    const inicio = performance.now();
    const duracao = 1200;
    let quadro = 0;
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - inicio) / duracao);
      const suave = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setMostrado(de + (valor - de) * suave);
      if (p < 1) quadro = requestAnimationFrame(passo);
      else anterior.current = valor;
    };
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      anterior.current = valor;
    };
  }, [valor]);

  return <>{formatar(Math.round(mostrado))}</>;
};
