import { embedDoTour, embedDoVideo, type MidiaDoImovel as Midia } from '@/features/siteBuilder/public/midiaDoImovel';

/*
  Vídeo e tour virtual, logo depois da galeria. Aparecem sozinhos quando o
  cadastro tem o endereço (sem chave no Personalizar). Só YouTube, Vimeo e
  Matterport viram player na página; qualquer outro endereço vira um botão que
  abre em outra aba. O iframe é sempre montado a partir do id (midiaDoImovel).
*/

interface Item { midia: NonNullable<Midia>; titulo: string; botao: string; allow: string }

export default function MidiaDoImovel({ videoUrl, tourUrl }: { videoUrl?: string | null; tourUrl?: string | null }) {
  const video = embedDoVideo(videoUrl);
  const tour = embedDoTour(tourUrl);
  const itens: Item[] = [];
  if (video) itens.push({ midia: video, titulo: 'Vídeo do imóvel', botao: 'Ver vídeo', allow: 'encrypted-media; fullscreen; picture-in-picture' });
  if (tour) itens.push({ midia: tour, titulo: 'Tour virtual do imóvel', botao: 'Fazer o tour virtual', allow: 'fullscreen; xr-spatial-tracking' });
  if (itens.length === 0) return null;

  const players = itens.flatMap(i => (i.midia.tipo === 'embed' ? [{ ...i, src: i.midia.src }] : []));
  const botoes = itens.flatMap(i => (i.midia.tipo === 'link' ? [{ ...i, href: i.midia.href }] : []));

  return (
    <div className="mt-4 space-y-3">
      {players.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {players.map(i => (
            <div key={i.titulo} className="aspect-video overflow-hidden rounded-[20px] bg-neutral-100 ring-1 ring-black/[0.06]">
              <iframe
                title={i.titulo}
                src={i.src}
                loading="lazy"
                allow={i.allow}
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-full w-full"
                style={{ border: 0 }}
              />
            </div>
          ))}
        </div>
      )}
      {botoes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {botoes.map(i => (
            <a
              key={i.titulo}
              href={i.href}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-[var(--ink)] ring-1 ring-black/[0.08] transition hover:text-[var(--brand)]"
            >
              {i.botao}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
