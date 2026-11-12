import { useEffect, useState } from 'react';

// Logo em destaque na capa (Aparência › Logo na página inicial): o logo grande
// ao lado do título sobe junto com a página e, quando encosta no topo do site,
// some da capa e aparece no topo ("pousa"). Topo e capa usam ESTE hook, com a
// mesma medida: duas contas fariam o logo sumir dos dois lugares por um
// instante, ou aparecer nos dois.

/** Marca dos logos da capa (o do celular, em cima do título, e o do computador, ao lado). */
export const ATRIBUTO_DO_LOGO_DA_CAPA = 'data-logo-da-capa';
/** Marca do bloco do topo que flutua na home: a base dele é a pista de pouso. */
export const ATRIBUTO_DO_TOPO = 'data-topo-do-site';
/** Folga: o logo pousa um pouco antes de entrar embaixo do topo. */
export const FOLGA_DO_POUSO = 8;

/**
 * Pousou quando o topo do logo da capa chega na base do topo do site. Sem logo
 * da capa na tela (`null`) ele é tratado como pousado: o topo mostra o logo, e
 * o site nunca fica sem marca.
 */
export function estaPousado(topoDoLogo: number | null, baseDoTopo: number): boolean {
  if (topoDoLogo === null) return true;
  return topoDoLogo <= baseDoTopo + FOLGA_DO_POUSO;
}

/** O logo da capa que está à vista (o outro fica escondido pelo tamanho da tela). */
function topoDoLogoVisivel(): number | null {
  const logos = document.querySelectorAll<HTMLElement>(`[${ATRIBUTO_DO_LOGO_DA_CAPA}]`);
  for (const el of logos) {
    const r = el.getBoundingClientRect();
    if (r.height > 0) return r.top;
  }
  return null;
}

/**
 * `ativo` = logo em destaque e na home. Desligado, devolve sempre pousado (o
 * topo é o de sempre). Mede na rolagem e no redimensionamento, sem estado por
 * quadro: só troca quando cruza a linha.
 */
export function useLogoPousado(ativo: boolean): boolean {
  const [pousado, setPousado] = useState(!ativo);
  useEffect(() => {
    if (!ativo) { setPousado(true); return; }
    const medir = () => {
      const topo = document.querySelector(`[${ATRIBUTO_DO_TOPO}]`);
      setPousado(estaPousado(topoDoLogoVisivel(), topo ? topo.getBoundingClientRect().bottom : 0));
    };
    medir();
    window.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    return () => {
      window.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
    };
  }, [ativo]);
  return pousado;
}
