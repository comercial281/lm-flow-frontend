// src/pages/Customer/Pipelines/quadro/SetasDoQuadro.tsx
// Setas ‹ › nas laterais do quadro do funil (pedido do dono em 15/10/2026). A roda
// do mouse em cima dos cards desce a lista da coluna, e os cards ocupam quase o
// quadro inteiro: sem as setas, quem usa mouse não tinha como ir pro lado. Cada
// clique anda uma coluna. A seta só aparece quando tem coluna escondida daquele
// lado. No celular não entra (o dedo já arrasta): quem decide é o quadro.
import { useCallback, useEffect, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/ds';

// Coluna `w-80` (320px) + o `gap-6` (24px) entre elas.
export const PASSO_DA_SETA = 344;

interface Props {
  quadro: RefObject<HTMLDivElement | null>;
}

export default function SetasDoQuadro({ quadro }: Props) {
  const [lados, setLados] = useState({ esquerda: false, direita: false });

  const medir = useCallback(() => {
    const el = quadro.current;
    if (!el) return;
    const esquerda = el.scrollLeft > 1;
    const direita = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setLados(atual => (atual.esquerda === esquerda && atual.direita === direita ? atual : { esquerda, direita }));
  }, [quadro]);

  useEffect(() => {
    const el = quadro.current;
    if (!el) return;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    // A largura muda com a janela e com as colunas (filtro, etapa nova, aba).
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    observador?.observe(el);
    if (el.firstElementChild) observador?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', medir);
      observador?.disconnect();
    };
  }, [quadro, medir]);

  const andar = (direcao: 1 | -1) => {
    quadro.current?.scrollBy({ left: direcao * PASSO_DA_SETA, behavior: 'smooth' });
  };

  const classe = 'absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-background shadow-md';

  return (
    <>
      {lados.esquerda && (
        <Button variant="outline" size="icon" className={`${classe} left-2`}
          onClick={() => andar(-1)} aria-label="Ver colunas à esquerda" title="Ver colunas à esquerda">
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      {lados.direita && (
        <Button variant="outline" size="icon" className={`${classe} right-2`}
          onClick={() => andar(1)} aria-label="Ver colunas à direita" title="Ver colunas à direita">
          <ChevronRight className="h-5 w-5" />
        </Button>
      )}
    </>
  );
}
