import { Globe } from 'lucide-react';
import canalProLogo from '@/assets/portals/canal-pro.png';
import imovelwebLogo from '@/assets/portals/imovelweb.svg';
import chavesNaMaoLogo from '@/assets/portals/chaves-na-mao.png';
import casaMineiraLogo from '@/assets/portals/casa-mineira.svg';
import metaLogo from '@/assets/portals/meta.svg';
import quintoAndarLogo from '@/assets/portals/quinto-andar.png';
import buskazaLogo from '@/assets/portals/buskaza.png';
import imoveisGlobalLogo from '@/assets/portals/imoveis-global.png';
import imovelGuideLogo from '@/assets/portals/imovel-guide.png';
import homerLogo from '@/assets/portals/homer.svg';
import spImovelLogo from '@/assets/portals/sp-imovel.png';

// O Canal Pro (Grupo OLX) é um card só: `portal_vivareal`. O mesmo XML publica
// em ZAP, Viva Real e OLX, então o servidor não serve mais portal_zap/portal_olx.
// Símbolo (ícone) de cada portal, não o logo escrito: no quadrinho de 40-56 px
// o nome não dá pra ler. Ícone do app/aba do site oficial (12/11/2026); Homer,
// Imovelweb e Casa Mineira recortados do logo deles. Portal sem ícone cai no globo.
const PORTAL_LOGO_SRC: Record<string, string> = {
  portal_vivareal: canalProLogo,
  portal_imovelweb: imovelwebLogo,
  portal_chaves_na_mao: chavesNaMaoLogo,
  portal_casa_mineira: casaMineiraLogo,
  portal_meta_catalog: metaLogo,
  portal_quinto_andar: quintoAndarLogo,
  portal_buskaza: buskazaLogo,
  portal_imoveis_global: imoveisGlobalLogo,
  portal_imovel_guide: imovelGuideLogo,
  portal_homer: homerLogo,
  portal_sp_imovel: spImovelLogo,
};

export function PortalLogo({ portalKey, className = 'w-12 h-12' }: { portalKey: string; className?: string }) {
  const src = PORTAL_LOGO_SRC[portalKey];
  return (
    <div className={`rounded-xl bg-white border flex items-center justify-center shrink-0 overflow-hidden ${className}`}>
      {src ? (
        <img src={src} alt="" className="w-full h-full object-contain p-2" />
      ) : (
        <Globe className="h-1/2 w-1/2 text-muted-foreground" />
      )}
    </div>
  );
}
