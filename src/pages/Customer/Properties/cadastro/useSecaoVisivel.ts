import { useEffect, useState } from 'react';

// Qual seção do cadastro está na tela, para o índice marcar. Observa os
// elementos `secao-<id>` numa faixa perto do topo da tela (de 20% a 30% da
// altura) e devolve a primeira, na ordem do índice, que está nessa faixa.
// Nenhuma na faixa (rolando entre duas seções) mantém a última marcada.
export function useSecaoVisivel<T extends string>(ids: readonly T[]): T | null {
  const [visivel, setVisivel] = useState<T | null>(ids[0] ?? null);
  const chave = ids.join('|');

  useEffect(() => {
    if (!ids.length || typeof IntersectionObserver === 'undefined') return;
    const naFaixa = new Set<string>();
    const observador = new IntersectionObserver(entradas => {
      for (const e of entradas) {
        const id = e.target.id.replace(/^secao-/, '');
        if (e.isIntersecting) naFaixa.add(id); else naFaixa.delete(id);
      }
      const primeira = ids.find(id => naFaixa.has(id));
      if (primeira) setVisivel(primeira);
    }, { rootMargin: '-20% 0px -70% 0px' });
    ids.forEach(id => {
      const el = document.getElementById(`secao-${id}`);
      if (el) observador.observe(el);
    });
    return () => observador.disconnect();
    // `chave` resume `ids`: a lista nova a cada render não pode religar o observador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return visivel;
}
