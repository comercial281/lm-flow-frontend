import { embedDoTour, embedDoVideo } from '@/features/siteBuilder/public/midiaDoImovel';
import type { FotoDaFicha } from '../ficha/useFichaDoImovel';

/* ────────────────────────────────────────────────────────────────────────────
   Galeria em mosaico da ficha do Moderno (spec 7; protótipo `.gal`), sem
   buraco com qualquer número de fotos:
   - 1 foto: uma foto larga;
   - 2: lado a lado; 3: a grande e 2 empilhadas; 4: a grande, uma larga e 2;
   - 5 ou mais: a grande e 4, a última com "+N fotos".
   No celular só a grande (o contador diz quantas são). Clicar em qualquer
   uma abre a galeria em tela cheia de hoje naquela foto. "Ver vídeo" e
   "Tour virtual" levam à seção de vídeo da ficha, quando existem.
──────────────────────────────────────────────────────────────────────────── */

const VIDRO = 'border border-[rgba(255,255,255,0.28)] bg-[rgba(8,10,22,0.42)] text-white backdrop-blur-[10px]';

/** Onde cada foto mora na grade (classes fixas: o Tailwind só gera o que está escrito). */
const GRADE: Record<number, { grade: string; fotos: string[] }> = {
  1: { grade: 'sm:grid-cols-1 sm:grid-rows-[440px]', fotos: [''] },
  2: { grade: 'sm:grid-cols-2 sm:grid-rows-[440px]', fotos: ['', ''] },
  3: { grade: 'sm:grid-cols-[2fr_1fr] sm:grid-rows-[215px_215px]', fotos: ['sm:row-span-2', '', ''] },
  4: { grade: 'sm:grid-cols-[2fr_1fr_1fr] sm:grid-rows-[215px_215px]', fotos: ['sm:row-span-2', 'sm:col-span-2', '', ''] },
  5: { grade: 'sm:grid-cols-[2fr_1fr_1fr] sm:grid-rows-[215px_215px]', fotos: ['sm:row-span-2', '', '', '', ''] },
};

export const ID_DA_MIDIA = 'video-e-tour';

export default function GaleriaModerna({ fotos, titulo, abrir, videoUrl, tourUrl }: {
  fotos: FotoDaFicha[]; titulo: string; abrir: (i: number) => void; videoUrl?: string | null; tourUrl?: string | null;
}) {
  if (fotos.length === 0) return null;
  const visiveis = fotos.slice(0, 5);
  const { grade, fotos: lugares } = GRADE[visiveis.length];
  const resto = fotos.length - visiveis.length;
  const video = !!embedDoVideo(videoUrl);
  const tour = !!embedDoTour(tourUrl);

  return (
    <div data-testid="mosaico" data-fotos={visiveis.length} className={`grid h-[280px] grid-cols-1 gap-2.5 sm:h-auto ${grade}`}>
      {visiveis.map((f, i) => (
        <div key={`${f.file_url}-${i}`} className={`relative min-w-0 overflow-hidden rounded-[20px] bg-[var(--m-brand-soft)] ${lugares[i]} ${i > 0 ? 'max-sm:hidden' : ''}`}>
          <button type="button" aria-label={`Ver foto ${i + 1} de ${fotos.length}`} onClick={() => abrir(i)} className="block h-full w-full cursor-zoom-in">
            <img
              src={f.file_url} alt={f.alt_text || titulo}
              {...(i === 0 ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })}
              className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.03]"
            />
            {i === visiveis.length - 1 && resto > 0 && (
              <span className="absolute inset-0 grid place-items-center bg-[rgba(8,10,22,0.55)] text-[15px] font-semibold text-white">+{resto} fotos</span>
            )}
          </button>
          {i === 0 && (
            <>
              <span className={`pointer-events-none absolute right-3.5 top-3.5 rounded-full px-3 py-1 text-[12px] font-semibold tabular-nums ${VIDRO}`}>1 / {fotos.length}</span>
              {(video || tour) && (
                <div className="absolute bottom-3.5 left-3.5 flex flex-wrap gap-2">
                  {video && <a href={`#${ID_DA_MIDIA}`} className={`rounded-full px-3.5 py-2 text-[13px] font-semibold ${VIDRO}`}>Ver vídeo</a>}
                  {tour && <a href={`#${ID_DA_MIDIA}`} className={`rounded-full px-3.5 py-2 text-[13px] font-semibold ${VIDRO}`}>Tour virtual</a>}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
