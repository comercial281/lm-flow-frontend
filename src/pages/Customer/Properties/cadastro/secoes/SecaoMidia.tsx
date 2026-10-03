import { useRef, useState } from 'react';
import { Film, Image, Loader2, Megaphone, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { ACCEPTED_MIME_TYPES } from '@/services/propertyPhotos/propertyPhotosService';
import { numero, plural } from '@/lib/formato';
import PropertyPhotosDialog from '../../PropertyPhotosDialog';
import { CampoTexto } from './campos';
import type { PropsDaSecao } from './tipos';

interface Props extends PropsDaSecao {
  /** Criação: mídias escolhidas agora, que sobem depois de criar o imóvel. */
  arquivos: File[];
  aoMudarArquivos: (arquivos: File[]) => void;
  enviando: boolean;
  /** Edição: o gerenciador de fotos fechou (a página relê a contagem). */
  aoFecharFotos: () => void;
}

function Arquivos({ editando, arquivos, aoMudarArquivos, enviando, aoFecharFotos }: Props) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [fotosAbertas, setFotosAbertas] = useState(false);

  // Edição: o mesmo gerenciador que a lista abre em "Fotos e vídeos".
  if (editando) {
    const total = editando.photos_count ?? 0;
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total ? plural(total, 'foto ou vídeo', 'fotos e vídeos') : 'Nenhuma foto ainda'}
        </p>
        <Button type="button" variant="outline" onClick={() => setFotosAbertas(true)} className="gap-2">
          <Image className="h-4 w-4" />
          Gerenciar fotos
        </Button>
        {fotosAbertas && (
          <PropertyPhotosDialog
            property={editando}
            onClose={() => { setFotosAbertas(false); aoFecharFotos(); }}
          />
        )}
      </div>
    );
  }

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
  return (
    <>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoTexto rotulo="Link do vídeo (YouTube)" type="url" valor={f.video_url} placeholder="https://www.youtube.com/watch?v=..."
          aoMudar={v => setF({ video_url: v || null })} />
        <CampoTexto rotulo="Link do tour virtual" type="url" valor={f.virtual_tour_url}
          aoMudar={v => setF({ virtual_tour_url: v || null })} />
      </div>
      <Arquivos {...props} />
    </>
  );
}
