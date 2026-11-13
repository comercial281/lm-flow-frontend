import type { Dispatch, SetStateAction } from 'react';
import { I, Ic } from './iconesDaFicha';
import type { FotoDaFicha } from './useFichaDoImovel';

/**
 * Foto em tela cheia (Clássico e Moderno): setas, contador e clique fora
 * fecham. O teclado (Esc e setas) e a trava da rolagem moram no
 * `useFichaDoImovel`, junto do estado `active`.
 */
export default function GaleriaEmTelaCheia({ photos, active, setActive, titulo, fechar }: {
  photos: FotoDaFicha[]; active: number; setActive: Dispatch<SetStateAction<number>>; titulo: string; fechar: () => void;
}) {
  const cover = photos[active] || photos[0];
  if (!cover) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={() => fechar()}
      role="dialog"
      aria-modal="true"
      aria-label="Galeria de fotos"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => fechar()}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
      >
        <Ic d={I.close} s={22} />
      </button>

      <img
        src={cover.file_url}
        alt={cover.alt_text || titulo}
        onClick={e => e.stopPropagation()}
        className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
      />

      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={e => { e.stopPropagation(); setActive(a => (a - 1 + photos.length) % photos.length); }}
            className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:left-6"
          >
            <Ic d={I.back} s={24} />
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={e => { e.stopPropagation(); setActive(a => (a + 1) % photos.length); }}
            className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:right-6"
          >
            <Ic d={I.next} s={24} />
          </button>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-medium text-white">
            {active + 1} / {photos.length}
          </span>
        </>
      )}
    </div>
  );
}
