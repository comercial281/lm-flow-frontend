import { useEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MetaPagesPanel from '@/pages/Customer/Automations/Origem/MetaPagesPanel';
import PixelCapiConfig from '@/pages/Customer/Automations/PixelCapi/PixelCapiConfig';
import { useMenuSecoes } from '@/contexts/MenuContext';
import type { MenuItem } from '@/components/layout/config/menuItems';
import { itemDeIntegracoes } from './cartoes';

// Integrações → Facebook (07/10/2026): a Página do Facebook (Lead Ads) e o Pixel
// numa rolagem só. Os dois endereços de antes abrem esta tela, cada um com a
// trava dele na rota; o do Pixel abre rolado até o Pixel. Até 07/10 eram duas
// abas; até 01/10 a Página era aba da tela Origem.

const PAGINA = '/settings/facebook';
const PIXEL = '/settings/pixel-capi';

/**
 * Bloco aparece se a tela dele sobrou no menu filtrado, OU se é o endereço aberto
 * (a rota já conferiu a permissão: o super que digita /settings/facebook no painel
 * raiz continua vendo a Página, como antes).
 */
export function blocosDoFacebook(item: MenuItem | null, pathname: string): { pagina: boolean; pixel: boolean } {
  const visiveis = new Set((item?.abas ?? []).map(a => a.href));
  return {
    pagina: visiveis.has(PAGINA) || pathname === PAGINA,
    pixel: visiveis.has(PIXEL) || pathname === PIXEL,
  };
}

// A Página, em cima, carrega depois e empurra o Pixel pra baixo. Por 3 s, cada
// mudança de altura dela rola de novo, até a pessoa rolar sozinha.
function useRolarAte(ativo: boolean, acimaRef: RefObject<HTMLElement | null>, alvoRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const alvo = alvoRef.current;
    if (!ativo || !alvo) return;
    const rolar = () => alvo.scrollIntoView?.({ block: 'start' });
    rolar();

    const acima = acimaRef.current;
    if (!acima || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(rolar);
    observador.observe(acima);
    const parar = () => observador.disconnect();
    const prazo = window.setTimeout(parar, 3000);
    window.addEventListener('wheel', parar, { once: true, passive: true });
    window.addEventListener('touchstart', parar, { once: true, passive: true });
    return () => {
      parar();
      window.clearTimeout(prazo);
      window.removeEventListener('wheel', parar);
      window.removeEventListener('touchstart', parar);
    };
  }, [ativo, acimaRef, alvoRef]);
}

export default function FacebookIntegracao() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { pagina, pixel } = blocosDoFacebook(itemDeIntegracoes(useMenuSecoes()), pathname);
  const paginaRef = useRef<HTMLElement>(null);
  const pixelRef = useRef<HTMLElement>(null);

  useRolarAte(pathname === PIXEL && pagina && pixel, paginaRef, pixelRef);

  // Os dois blocos usam o título que já têm (Páginas conectadas; Pixel / Conversões).
  return (
    <div className="h-full overflow-y-auto">
      {pagina && (
        <section ref={paginaRef} aria-label="Página do Facebook">
          <MetaPagesPanel onGoToForms={() => navigate('/automations/origem')} />
        </section>
      )}
      {pixel && (
        <section ref={pixelRef} aria-label="Pixel" className={pagina ? 'scroll-mt-0 border-t border-border' : undefined}>
          <PixelCapiConfig />
        </section>
      )}
    </div>
  );
}
