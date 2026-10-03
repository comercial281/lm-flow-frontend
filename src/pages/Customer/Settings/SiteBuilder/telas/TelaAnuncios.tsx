import { EyeOff } from 'lucide-react';
import LandingsPanel from '@/features/landing/manage/LandingsPanel';
import type { Site } from '@/services/siteBuilder/siteBuilderService';

interface Props {
  site: Site;
  // Só o super-admin recebe o aviso: o cliente sem a chave nem vê o item.
  landingsHiddenFromClient: boolean;
}

export default function TelaAnuncios({ site, landingsHiddenFromClient }: Props) {
  return (
    <div className="space-y-3">
      {landingsHiddenFromClient && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600">
          <EyeOff className="h-3.5 w-3.5" aria-hidden /> Oculto pro cliente
        </p>
      )}
      <LandingsPanel siteId={site.id} siteSlug={site.slug} />
    </div>
  );
}
