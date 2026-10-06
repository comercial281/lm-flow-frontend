import { useEffect } from 'react';
import { I, Ic, linkDoWhatsApp, onlyDigits, tokensDoSite, type SiteInfo } from './portalShared';
import { logoNaSuperficie } from '@/features/siteBuilder/public/aparenciaConfig';

/* ────────────────────────────────────────────────────────────────────────────
   Página "Em manutenção" do site público (desde 04/10/2026).

   O site entra em manutenção quando, em Meu site › Endereço do site, a caixa
   Ativo OU a Publicado está desmarcada (o servidor manda `maintenance: true`).
   Esta página entra no lugar da página inicial, da busca, das páginas criadas,
   do blog, do artigo, do Financiamento e do Anuncie. A ficha do imóvel aberta
   por link continua funcionando, com topo e rodapé enxutos.

   Enquanto ela está aberta: a aba mostra "<Nome> — Em manutenção" e o Google é
   avisado pra não guardar a página (robots noindex). Ao sair, título e robots
   voltam como estavam. O ícone da aba é trocado pela página que a mostra
   (`useIconeDaAba`), nunca aqui: duas trocas do mesmo ícone se desfazem fora
   de ordem. Rastreamento (GA4, Pixel, GTM) e visita também não: a página que a
   mostra passa `null` pro `usePortalTracking` em manutenção.
──────────────────────────────────────────────────────────────────────────── */

export const TEXTO_MANUTENCAO = 'Estamos atualizando nosso site. Volte em breve.';

export function tituloEmManutencao(nome?: string | null): string {
  return `${nome || 'Imóveis'} — Em manutenção`;
}

/** Título da aba e `robots noindex` enquanto a página está aberta; devolve os dois ao sair. */
function useAbaEmManutencao(titulo: string) {
  useEffect(() => {
    const tituloAntes = document.title;
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const criada = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    const robotsAntes = meta.getAttribute('content');
    document.title = titulo;
    meta.setAttribute('content', 'noindex');
    const tag = meta;
    return () => {
      document.title = tituloAntes;
      if (criada) tag.remove();
      else if (robotsAntes === null) tag.removeAttribute('content');
      else tag.setAttribute('content', robotsAntes);
    };
  }, [titulo]);
}

export default function PaginaManutencao({ site }: { site: SiteInfo }) {
  const { fontHrefs, cssVars, fundo, aparencia } = tokensDoSite(site);
  useAbaEmManutencao(tituloEmManutencao(site.name));

  const waHref = linkDoWhatsApp(site.contact?.whatsapp);
  const phone = site.contact?.phone?.trim();
  const email = site.contact?.email?.trim();
  const temContato = !!(waHref || phone || email);
  // A caixa é o `--card`: no fundo escuro, a logo clara (se houver).
  const logo = logoNaSuperficie(site.branding?.logo_url, aparencia, 'fundo').url;

  return (
    <div style={cssVars} data-fundo={fundo} className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] px-4 py-16 text-[var(--ink)] antialiased">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {fontHrefs.map(h => <link key={h} href={h} rel="stylesheet" />)}

      <main className="w-full max-w-xl rounded-[28px] bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06] sm:px-12">
        {logo ? (
          <img src={logo} alt={site.name || 'Logo'} className="mx-auto h-16 w-auto max-w-[260px] object-contain" />
        ) : (
          <p className="font-[var(--display)] text-2xl font-semibold tracking-tight text-[var(--brand)]">{site.name || 'Imóveis'}</p>
        )}

        <div className="mx-auto mt-8 h-1 w-12 rounded-full" style={{ background: 'var(--brand)' }} aria-hidden />

        <h1 className="mt-8 font-[var(--display)] text-2xl font-semibold leading-snug sm:text-3xl">
          {TEXTO_MANUTENCAO}
        </h1>

        {temContato && (
          <section className="mt-10 border-t border-black/[0.06] pt-8">
            <p className="text-[15px] text-neutral-600">Enquanto isso, fale com a gente:</p>
            <div className="mt-5 flex flex-col items-center gap-3">
              {waHref && (
                <a
                  href={waHref} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#25D366' }}
                >
                  <Ic d={I.wa} s={18} /> Falar no WhatsApp
                </a>
              )}
              {phone && (
                <a href={`tel:${onlyDigits(phone)}`} className="inline-flex items-center gap-2 text-[15px] font-medium text-neutral-700 transition-colors hover:text-[var(--brand)]">
                  <Ic d={I.phone} s={16} /> {phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="inline-flex items-center gap-2 break-all text-[15px] font-medium text-neutral-700 transition-colors hover:text-[var(--brand)]">
                  <Ic d={I.mail} s={16} /> {email}
                </a>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
