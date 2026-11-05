import { Globe } from 'lucide-react';
import canalProLogo from '@/assets/portals/canal-pro.svg';
import imovelwebLogo from '@/assets/portals/imovelweb.svg';
import chavesNaMaoLogo from '@/assets/portals/chaves-na-mao.svg';
import casaMineiraLogo from '@/assets/portals/casa-mineira.svg';
import metaLogo from '@/assets/portals/meta.svg';

// O Canal Pro (Grupo OLX) é um card só: `portal_vivareal`. O mesmo XML publica
// em ZAP, Viva Real e OLX, então o servidor não serve mais portal_zap/portal_olx.
// Os demais portais novos (Quinto Andar, Buskaza, Imóveis Global, Imovel Guide,
// Homer) não têm logo aqui e caem no globo.
const PORTAL_LOGO_SRC: Record<string, string> = {
  portal_vivareal: canalProLogo,
  portal_imovelweb: imovelwebLogo,
  portal_chaves_na_mao: chavesNaMaoLogo,
  portal_casa_mineira: casaMineiraLogo,
  portal_meta_catalog: metaLogo,
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
