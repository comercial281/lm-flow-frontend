// Banner da Dashboard (spec LM FLOW/specs/2026-10-12-banner-dashboard-design.md).
//
// Decisões do dono (12/10/2026, não reabrir sem ele pedir): só aqui na Dashboard;
// vários no ar viram carrossel; a arte é imagem pronta da Leal Mídia (uma pro
// computador, 5:1, outra pro celular, 2:1); nada abre sozinho.
//
// A arte NUNCA é cortada: a caixa tem a proporção da arte e a imagem só encolhe.
// O servidor recusa arte fora da medida, então `object-cover` aqui não corta nada.
//
// Sem banner (ou com falha na leitura) o componente não desenha nada e o espaço
// some (o `empty:hidden` de quem o embrulha).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import { bannersService } from '@/services/dashboard/bannersService';
import type { BannerDaDashboard as Banner } from '@/types/admin/dashboardBanners';

export const TROCA_MS = 7000;

const ehExterno = (url: string) => /^https?:\/\//i.test(url);

function menosMovimento(): boolean {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; }
}

export default function BannerDaDashboard() {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [atual, setAtual] = useState(0);
  const [parado, setParado] = useState(false);
  const [aberto, setAberto] = useState<Banner | null>(null);
  const trilho = useRef<HTMLDivElement>(null);
  const vistos = useRef(new Set<string>());

  useEffect(() => {
    let vivo = true;
    bannersService.meus()
      .then((lista) => { if (vivo) setBanners(Array.isArray(lista) ? lista : []); })
      .catch(() => { /* a Dashboard segue sem banner */ });
    return () => { vivo = false; };
  }, []);

  // "Apareceu para": registra o banner na primeira vez que ele fica à vista.
  useEffect(() => {
    const banner = banners[atual];
    if (!banner || vistos.current.has(banner.id)) return;
    vistos.current.add(banner.id);
    bannersService.vistos([banner.id]).catch(() => {});
  }, [banners, atual]);

  const irPara = useCallback((indice: number) => {
    const el = trilho.current;
    if (!el) return;
    el.scrollTo({ left: indice * el.clientWidth, behavior: menosMovimento() ? 'auto' : 'smooth' });
    setAtual(indice);
  }, []);

  // Passa sozinho; para com o mouse em cima, com o foco dentro, com o dedo e
  // pra quem pediu menos movimento ao sistema.
  useEffect(() => {
    if (banners.length < 2 || parado || aberto || menosMovimento()) return undefined;
    const t = window.setTimeout(() => irPara((atual + 1) % banners.length), TROCA_MS);
    return () => window.clearTimeout(t);
  }, [banners.length, atual, parado, aberto, irPara]);

  // Arrastar com o dedo: a posição do trilho diz qual está à vista.
  const aoRolar = () => {
    const el = trilho.current;
    if (!el || el.clientWidth === 0) return;
    const indice = Math.round(el.scrollLeft / el.clientWidth);
    if (indice !== atual && indice >= 0 && indice < banners.length) setAtual(indice);
  };

  const abrir = (banner: Banner) => {
    bannersService.clicou(banner.id).catch(() => {});
    if (banner.click_action === 'details') { setAberto(banner); return; }
    if (banner.click_action === 'link' && banner.link_url) {
      if (ehExterno(banner.link_url)) window.open(banner.link_url, '_blank', 'noopener,noreferrer');
      else navigate(banner.link_url);
    }
  };

  const verAgora = (caminho: string) => {
    setAberto(null);
    if (ehExterno(caminho)) window.open(caminho, '_blank', 'noopener,noreferrer');
    else navigate(caminho);
  };

  if (banners.length === 0) return null;

  return (
    <section
      aria-label="Novidades da Leal Mídia"
      aria-roledescription="carrossel"
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
      onFocus={() => setParado(true)}
      onBlur={() => setParado(false)}
      onTouchStart={() => setParado(true)}
    >
      <div
        ref={trilho}
        onScroll={aoRolar}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((banner, i) => {
          const clicavel = banner.click_action !== 'none';
          const nome = banner.details?.title || 'Novidade da Leal Mídia';
          const arte = (
            <picture>
              <source media="(max-width: 767px)" srcSet={banner.mobile_url} />
              <img
                src={banner.desktop_url}
                alt={nome}
                className="aspect-[2/1] w-full object-cover md:aspect-[5/1]"
                draggable={false}
              />
            </picture>
          );
          return (
            <div
              key={banner.id}
              className="w-full shrink-0 snap-center"
              role="group"
              aria-roledescription="banner"
              aria-label={`${i + 1} de ${banners.length}`}
              aria-hidden={i !== atual || undefined}
            >
              {clicavel ? (
                <button
                  type="button"
                  className="block w-full cursor-pointer overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  onClick={() => abrir(banner)}
                  tabIndex={i === atual ? 0 : -1}
                  aria-label={banner.click_action === 'details' ? `${nome}: ver detalhes` : `${nome}: abrir`}
                >
                  {arte}
                </button>
              ) : (
                <div className="overflow-hidden rounded-xl">{arte}</div>
              )}
            </div>
          );
        })}
      </div>

      {banners.length > 1 && (
        <div className="mt-1 flex justify-center">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              type="button"
              className="group grid h-8 w-8 place-items-center"
              aria-label={`Mostrar o banner ${i + 1} de ${banners.length}`}
              aria-current={i === atual || undefined}
              onClick={() => irPara(i)}
            >
              <span
                className={cn(
                  'block h-2 rounded-full transition-all motion-reduce:transition-none',
                  i === atual ? 'w-5 bg-primary' : 'w-2 bg-muted-foreground/40 group-hover:bg-muted-foreground/70',
                )}
              />
            </button>
          ))}
        </div>
      )}

      <Dialog open={aberto !== null} onOpenChange={(sim) => { if (!sim) setAberto(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{aberto?.details?.title}</DialogTitle></DialogHeader>
          {aberto?.details?.image_url && (
            <img src={aberto.details.image_url} alt="" className="w-full rounded-lg" />
          )}
          <p className="whitespace-pre-line text-sm leading-relaxed">{aberto?.details?.body}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(null)}>Fechar</Button>
            {aberto?.details?.button_path && (
              <Button onClick={() => verAgora(aberto.details!.button_path!)}>Ver agora</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
