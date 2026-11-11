// Fotos das áreas comuns. Criação: escolher arquivos, que sobem depois de criar
// (igual ao imóvel). Edição: faixa com as primeiras e "Gerenciar fotos", que abre
// a página de fotos do condomínio.
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Image, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { EmptyState, IconActionButton } from '@/components/base';
import { numero, plural } from '@/lib/formato';
import { ACCEPTED_MIME_TYPES, type PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';
import { condominiumsService } from '@/services/condominiums/condominiumsService';
import { separar } from '@/features/properties/fotos/regrasDasFotos';

const NA_FAIXA = 6;

function FaixaDeFotos({ condominioId, total, aoGerenciar }: { condominioId: string; total: number; aoGerenciar?: () => void }) {
  const [fotos, setFotos] = useState<PropertyPhoto[] | null>(null);
  useEffect(() => {
    let vivo = true;
    condominiumsService.fotos.list(condominioId)
      .then(l => { if (vivo) setFotos(separar(l).imagens.filter(p => p.published)); })
      .catch(() => { if (vivo) setFotos([]); });
    return () => { vivo = false; };
  }, [condominioId]);
  const mostradas = (fotos ?? []).slice(0, NA_FAIXA);
  const resto = (fotos?.length ?? 0) - mostradas.length;
  return (
    <div className="mt-4 flex flex-col gap-3">
      {total
        ? <p className="text-sm text-muted-foreground">{plural(total, 'foto', 'fotos')}</p>
        : <EmptyState tamanho="compacto" title="Nenhuma foto ainda" />}
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
      {aoGerenciar && (
        <div>
          <Button type="button" variant="outline" onClick={aoGerenciar} className="gap-2">
            <Image className="h-4 w-4" />Gerenciar fotos<ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function EscolhaDeArquivos({ arquivos, aoMudar, enviando }: { arquivos: File[]; aoMudar: (a: File[]) => void; enviando: boolean }) {
  const campo = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-4 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Opcional. Envie agora ou depois.</p>
        <Button type="button" size="sm" variant="outline" disabled={enviando} onClick={() => campo.current?.click()}>
          <Upload className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>
      <input
        ref={campo}
        type="file"
        multiple
        accept={ACCEPTED_MIME_TYPES.join(',')}
        aria-label="Escolher fotos das áreas comuns"
        tabIndex={-1}
        className="sr-only"
        onChange={e => {
          const fs = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (fs.length) aoMudar([...arquivos, ...fs]);
        }}
      />
      {arquivos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {arquivos.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-xs">
              <Image className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-muted-foreground">{numero(file.size / 1024 / 1024, 1)} MB</span>
              <IconActionButton label={`Tirar ${file.name}`} icon={<X className="h-3.5 w-3.5" />} variant="ghost"
                onClick={() => aoMudar(arquivos.filter((_, x) => x !== i))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SecaoFotosDasAreasComuns({ condominioId, total, arquivos, aoMudarArquivos, enviando, aoGerenciar }: {
  /** Edição: o condomínio salvo. Criação: nulo. */
  condominioId: string | null;
  total: number;
  arquivos: File[];
  aoMudarArquivos: (a: File[]) => void;
  enviando: boolean;
  /** Sem a permissão, não vem: a faixa fica sem "Gerenciar fotos". */
  aoGerenciar?: () => void;
}) {
  if (condominioId) return <FaixaDeFotos condominioId={condominioId} total={total} aoGerenciar={aoGerenciar} />;
  return <EscolhaDeArquivos arquivos={arquivos} aoMudar={aoMudarArquivos} enviando={enviando} />;
}
