import { Crown } from 'lucide-react';
import { Card } from '@/components/ui/ds';
import { Aviso } from '@/components/base';
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';

export default function CartaoDaCapa({ capa }: { capa: PropertyPhoto | null }) {
  return (
    <Card role="region" aria-labelledby="titulo-capa" className="gap-3 p-4 lg:sticky lg:top-0">
      <h2 id="titulo-capa" className="flex items-center gap-2 text-base font-semibold">
        <Crown className="h-4 w-4 text-amber-500" aria-hidden="true" />Capa
      </h2>
      <div className="aspect-[4/3] max-w-full overflow-hidden rounded-lg bg-muted">
        {capa && (
          <img
            src={capa.file_url}
            alt={capa.alt_text ?? capa.caption ?? 'Capa do imóvel'}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        É a primeira coisa que o lead vê: no site, nos portais e na primeira foto que a IA manda.
      </p>
      <p className="text-sm text-muted-foreground">
        Para trocar, arraste outra foto para o 1º lugar ou clique na coroa dela.
      </p>
      {capa && !capa.published && (
        <Aviso tom="atencao" compacto>A capa está oculta. No site e nos portais aparece a próxima foto visível.</Aviso>
      )}
    </Card>
  );
}
