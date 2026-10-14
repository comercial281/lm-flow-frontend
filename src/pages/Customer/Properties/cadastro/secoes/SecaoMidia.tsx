import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Film, Image, Loader2, Megaphone, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { ACCEPTED_MIME_TYPES, propertyPhotosService, type PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';
import { separar } from '@/features/properties/fotos/regrasDasFotos';
import { numero, plural } from '@/lib/formato';
import { useCampoTravado } from '@/features/properties/cadastro/travasDoSite';
import { CampoTexto } from './campos';
import type { Property } from '@/services/properties/propertiesService';
import BlocoDoBook from './BlocoDoBook';
import type { PropsDaSecao } from './tipos';

interface Props extends PropsDaSecao {
  /** Criação: mídias escolhidas agora, que sobem depois de criar o imóvel. */
  arquivos: File[];
  aoMudarArquivos: (arquivos: File[]) => void;
  enviando: boolean;
  /** Edição: abre a página de fotos (quem chama pergunta se há alteração não salva). */
  aoGerenciarFotos: () => void;
  /** Criação: book (PDF) escolhido, que sobe depois de criar o imóvel. */
  book: File | null;
  aoMudarBook: (f: File | null) => void;
  /** Edição: o servidor devolveu o imóvel depois de subir/remover o book. */
  aoMudarImovel: (p: Property) => void;
}

const NA_FAIXA = 6;

// Edição: as primeiras fotos visíveis, na ordem do site, e o link pra página.
function FaixaDeFotos({ imovelId, total, aoGerenciar }: { imovelId: string; total: number; aoGerenciar: () => void }) {
  const [fotos, setFotos] = useState<PropertyPhoto[] | null>(null);
  useEffect(() => {
    let vivo = true;
    propertyPhotosService.list(imovelId)
      .then(l => { if (vivo) setFotos(separar(l).imagens.filter(p => p.published)); })
      .catch(() => { if (vivo) setFotos([]); });
    return () => { vivo = false; };
  }, [imovelId]);
  const mostradas = (fotos ?? []).slice(0, NA_FAIXA);
  const resto = (fotos?.length ?? 0) - mostradas.length;
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {total ? plural(total, 'foto ou vídeo', 'fotos e vídeos') : 'Nenhuma foto ainda'}
      </p>
      {mostradas.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {mostradas.map(p => (
            <img key={p.id} src={p.thumbnail_url || p.file_url} alt="" className="aspect-[4/3] w-24 shrink-0 rounded-md object-cover" loading="lazy" />
          ))}
          {resto > 0 && (
            <span className="flex aspect-[4/3] w-24 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
              +{resto}
            </span>
          )}
        </div>
      )}
      <div>
        <Button type="button" variant="outline" onClick={aoGerenciar} className="gap-2">
          <Image className="h-4 w-4" />Gerenciar fotos e vídeos<ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Arquivos({ editando, arquivos, aoMudarArquivos, enviando, aoGerenciarFotos }: Props) {
  const mediaInputRef = useRef<HTMLInputElement>(null);

  if (editando) return <FaixaDeFotos imovelId={editando.id} total={editando.photos_count ?? 0} aoGerenciar={aoGerenciarFotos} />;

  // Criação: fotos, vídeos e áudios escolhidos aqui sobem logo depois de criar.
  return (
    <div className="mt-4 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Image className="h-4 w-4" />
          Fotos, vídeos e áudios
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => mediaInputRef.current?.click()}
          disabled={enviando}
        >
          {enviando
            ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Enviando...</>
            : <><Upload className="mr-1 h-4 w-4" /> Adicionar</>}
        </Button>
      </div>
      <input
        ref={mediaInputRef}
        type="file"
        multiple
        accept={ACCEPTED_MIME_TYPES.join(',')}
        className="hidden"
        onChange={e => {
          const fs = Array.from(e.target.files ?? []);
          if (fs.length) aoMudarArquivos([...arquivos, ...fs]);
          e.target.value = '';
        }}
      />
      {arquivos.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Opcional. Envie agora ou depois. Áudio de explicação do imóvel também vale.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {arquivos.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-xs">
              {file.type.startsWith('video/')
                ? <Film className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                : file.type.startsWith('audio/')
                  ? <Megaphone className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  : <Image className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-muted-foreground">{numero(file.size / 1024 / 1024, 1)} MB</span>
              <button
                type="button"
                onClick={() => aoMudarArquivos(arquivos.filter((_, x) => x !== i))}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Links de vídeo e tour virtual, mais o envio de fotos e vídeos.
export default function SecaoMidia(props: Props) {
  const { form: f, setF } = props;
  // Do site só trava o link do vídeo; tour, fotos e book seguem livres.
  const videoTravado = useCampoTravado('video_url');
  return (
    <>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoTexto rotulo="Link do vídeo (YouTube)" type="url" valor={f.video_url} placeholder="https://www.youtube.com/watch?v=..."
          aoMudar={v => setF({ video_url: v || null })}
          desabilitado={videoTravado} />
        <CampoTexto rotulo="Link do tour virtual" type="url" valor={f.virtual_tour_url}
          aoMudar={v => setF({ virtual_tour_url: v || null })} />
      </div>
      <Arquivos {...props} />
      <BlocoDoBook
        kind={f.listing_kind ?? 'resale'}
        editando={props.editando}
        book={props.book}
        aoMudarBook={props.aoMudarBook}
        aoMudarImovel={props.aoMudarImovel}
        desabilitado={props.enviando}
      />
    </>
  );
}
