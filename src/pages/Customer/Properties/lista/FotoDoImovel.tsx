// src/pages/Customer/Properties/lista/FotoDoImovel.tsx
import { useState } from 'react';
import { Building2 } from 'lucide-react';
import type { Property } from '@/services/properties/propertiesService';
import { plural } from '@/lib/formato';

// A capa é a mesma do site (regra do servidor). Guarda a URL que falhou, não um
// booleano: o componente é reaproveitado entre imóveis (ver o card antigo).
export default function FotoDoImovel({ p, aoAdicionar, compacta = false }: {
  p: Property; aoAdicionar: () => void; compacta?: boolean;
}) {
  const [falhou, setFalhou] = useState<string | null>(null);
  const url = p.cover_photo_url && p.cover_photo_url !== falhou ? p.cover_photo_url : null;
  const altura = compacta ? 'min-h-[140px]' : 'min-h-[120px] sm:min-h-[150px]';

  if (!url) {
    return (
      <div className={`relative flex ${altura} flex-col items-center justify-center gap-2 bg-muted text-muted-foreground`}>
        <span className="absolute left-2 top-2 rounded-md border bg-card px-2 py-0.5 text-[11px] font-semibold">{p.code}</span>
        <Building2 className="h-6 w-6 opacity-40" />
        <button type="button" onClick={aoAdicionar}
          className="rounded-md border border-dashed border-primary/50 bg-card px-2.5 py-1 text-xs font-semibold text-primary">
          Adicionar fotos
        </button>
      </div>
    );
  }
  return (
    <div className={`relative ${altura} overflow-hidden bg-muted`}>
      <img src={url} alt={p.title} loading="lazy" onError={() => setFalhou(url)} className="absolute inset-0 h-full w-full object-cover" />
      <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">{p.code}</span>
      {p.photos_count ? (
        <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] text-white">{plural(p.photos_count, 'foto', 'fotos')}</span>
      ) : null}
    </div>
  );
}
