import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2, Search } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui/ds';
import { propertiesService, type Property } from '@/services/properties/propertiesService';
import { propertyPhotosService, type PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';

/**
 * Escolher a foto do banner da home entre as fotos dos imóveis PUBLICADOS no
 * site. Dois passos na mesma janela: o imóvel, depois a foto dele.
 *
 * Só imóvel ativo, publicado e com foto entra na lista: o servidor recusa
 * servir foto de imóvel despublicado no banner (cai no automático), então
 * oferecer esses aqui seria deixar a pessoa escolher algo que não vai aparecer.
 */

export interface HeroImagePick {
  property_id: string;
  photo_id: string;
  /** Só para a prévia da tela; quem serve a imagem de verdade é o servidor. */
  url: string;
  property_title: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (pick: HeroImagePick) => void;
  currentPropertyId?: string | null;
  currentPhotoId?: string | null;
}

const isImage = (ph: PropertyPhoto) => {
  const ct = ph.content_type ?? '';
  return !ct.startsWith('video/') && !ct.startsWith('audio/');
};

export default function HeroImagePicker({ open, onClose, onPick, currentPropertyId, currentPhotoId }: Props) {
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Property | null>(null);
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setSelected(null);
    setPhotos([]);
    setQ('');
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const res = await propertiesService.list({ status: 'active', per_page: 200 });
        if (!active) return;
        setProperties(res.data.filter(p => p.published_on_site && (p.photos_count ?? 0) > 0));
      } catch {
        if (active) setError('Não consegui carregar a lista de imóveis.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return properties;
    return properties.filter(p =>
      p.title.toLowerCase().includes(term)
      || p.code.toLowerCase().includes(term)
      || (p.address_neighborhood ?? '').toLowerCase().includes(term)
      || (p.address_city ?? '').toLowerCase().includes(term));
  }, [properties, q]);

  const openProperty = async (p: Property) => {
    setSelected(p);
    setPhotos([]);
    setError(null);
    setPhotosLoading(true);
    try {
      const list = await propertyPhotosService.list(p.id);
      setPhotos(list.filter(ph => ph.published && isImage(ph)));
    } catch {
      setError('Não consegui carregar as fotos deste imóvel.');
    } finally {
      setPhotosLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selected && (
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)} title="Voltar aos imóveis">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {selected ? selected.title : 'Foto de qual imóvel?'}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? 'Clique na foto que vai no topo do site.'
              : 'Só imóveis publicados no site e com foto aparecem aqui.'}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!selected && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por título, código, bairro ou cidade" className="pl-8" />
            </div>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando imóveis...</div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {properties.length === 0
                  ? 'Nenhum imóvel publicado no site tem foto ainda. Publique um imóvel com foto em Imóveis e volte aqui.'
                  : 'Nenhum imóvel bate com a busca.'}
              </p>
            ) : (
              <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                {filtered.map(p => (
                  <button key={p.id} type="button" onClick={() => openProperty(p)}
                    className={`group overflow-hidden rounded-lg border text-left transition-colors hover:border-primary ${p.id === currentPropertyId ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
                    <div className="aspect-[4/3] w-full bg-muted">
                      {p.cover_photo_url
                        ? <img src={p.cover_photo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">sem capa</div>}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.code}{p.address_neighborhood ? ` · ${p.address_neighborhood}` : ''} · {p.photos_count} foto{(p.photos_count ?? 0) === 1 ? '' : 's'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {selected && (
          photosLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando fotos...</div>
          ) : photos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Este imóvel não tem foto publicada.</p>
          ) : (
            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
              {photos.map(ph => {
                const isCurrent = selected.id === currentPropertyId && ph.id === currentPhotoId;
                return (
                  <button key={ph.id} type="button"
                    onClick={() => onPick({ property_id: selected.id, photo_id: ph.id, url: ph.file_url, property_title: selected.title })}
                    className={`relative aspect-[4/3] overflow-hidden rounded-lg border transition-colors hover:border-primary ${isCurrent ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
                    title={ph.caption ?? undefined}>
                    <img src={ph.thumbnail_url || ph.file_url} alt={ph.alt_text ?? ''} className="h-full w-full object-cover" loading="lazy" />
                    {ph.is_cover && <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">capa</span>}
                    {isCurrent && <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-1 text-primary-foreground"><Check className="h-3 w-3" /></span>}
                  </button>
                );
              })}
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
