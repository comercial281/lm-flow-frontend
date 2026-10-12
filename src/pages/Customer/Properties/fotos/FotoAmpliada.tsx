import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Crown, Eye, EyeOff } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/ds';
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';
import type { Permissoes } from '@/features/properties/fotos/usePermissoesDasFotos';
import { podeOcultar } from '@/features/properties/fotos/regrasDasFotos';

interface Props {
  /** As fotos da aba aberta: as setas andam só por elas. */
  fotos: PropertyPhoto[];
  todas: PropertyPhoto[];
  abertaId: string | null;
  capaId: string | null;
  pode: Permissoes;
  aoTrocar: (id: string | null) => void;
  aoUsarComoCapa: (id: string) => void;
  aoAlternarVisivel: (id: string) => void;
}

export default function FotoAmpliada({ fotos, todas, abertaId, capaId, pode, aoTrocar, aoUsarComoCapa, aoAlternarVisivel }: Props) {
  const i = fotos.findIndex(p => p.id === abertaId);
  const foto = i >= 0 ? fotos[i] : null;
  const andar = (passo: number) => {
    if (!fotos.length || i < 0) return;
    aoTrocar(fotos[(i + passo + fotos.length) % fotos.length].id);
  };

  // Sem lista de dependências de propósito: "andar" enxerga sempre a foto atual.
  useEffect(() => {
    if (!foto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') andar(-1);
      if (e.key === 'ArrowRight') andar(1);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  const ehCapa = foto?.id === capaId;
  return (
    <Dialog open={!!foto} onOpenChange={o => { if (!o) aoTrocar(null); }}>
      <DialogContent size="wide">
        {foto && (
          <>
            <DialogTitle className="sr-only">Foto ampliada</DialogTitle>
            <DialogDescription className="text-sm tabular-nums text-muted-foreground">
              {`Foto ${todas.findIndex(p => p.id === foto.id) + 1} de ${todas.length}`}{!foto.published && ' · oculta'}
            </DialogDescription>
            <div className="relative flex max-h-[70vh] items-center justify-center overflow-hidden rounded-lg bg-black">
              <img src={foto.file_url} alt={foto.alt_text ?? foto.caption ?? ''} className="max-h-[70vh] w-auto max-w-full object-contain" />
              {fotos.length > 1 && (
                <>
                  <Button type="button" variant="secondary" size="icon" aria-label="Foto anterior" onClick={() => andar(-1)} className="absolute left-3 top-1/2 -translate-y-1/2">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button type="button" variant="secondary" size="icon" aria-label="Próxima foto" onClick={() => andar(1)} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>
            <DialogFooter>
              {pode.capa && foto.published && (
                <Button type="button" variant="outline" onClick={() => aoUsarComoCapa(foto.id)} disabled={ehCapa}>
                  <Crown className="mr-2 h-4 w-4" />{ehCapa ? 'É a capa' : 'Usar como capa'}
                </Button>
              )}
              {pode.ocultar && (
                <Button
                  type="button" variant="outline"
                  onClick={() => aoAlternarVisivel(foto.id)}
                  disabled={!podeOcultar(foto, capaId)}
                  title={!podeOcultar(foto, capaId) ? 'Escolha outra capa antes de ocultar esta.' : undefined}
                >
                  {foto.published ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                  {foto.published ? 'Ocultar' : 'Mostrar'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
