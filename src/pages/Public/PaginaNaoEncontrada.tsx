import { useEffect } from 'react';
import { tokensDoSite, type SiteInfo } from './portalShared';

/**
 * Caminho que não existe no site do domínio (/xyz, imóvel apagado, link velho
 * quebrado). O servidor já respondeu 404 pro Google; esta é a tela pra pessoa:
 * avisa e leva pro início e pros imóveis. Antes, todo caminho desconhecido
 * caía no início com 200 — o Google lia isso como página repetida.
 */
export default function PaginaNaoEncontrada({ inicio = '/', imoveis = '/imoveis', site }: { inicio?: string; imoveis?: string; site?: SiteInfo }) {
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
    document.title = 'Página não encontrada';
    meta.setAttribute('content', 'noindex');
    const tag = meta;
    return () => {
      document.title = tituloAntes;
      if (criada) tag.remove();
      else if (robotsAntes === null) tag.removeAttribute('content');
      else tag.setAttribute('content', robotsAntes);
    };
  }, []);

  // Moderno (só quando a página sabe o site; a 404 do domínio não sabe): "404" grande e o tipo do Moderno.
  const tokens = site ? tokensDoSite(site) : null;
  if (tokens && tokens.aparencia.style === 'modern') {
    return (
      <main data-pagina-moderna="404" style={tokens.cssVars} data-fundo={tokens.fundo}
        className="flex min-h-screen flex-col items-center justify-center bg-[var(--m-ground)] px-6 text-center text-[var(--m-text)] antialiased">
        {tokens.fontHrefs.map(h => <link key={h} href={h} rel="stylesheet" />)}
        <p aria-hidden className="font-[var(--display)] text-[clamp(96px,18vw,180px)] font-semibold leading-none tracking-[-0.05em] text-[var(--m-head)]">404</p>
        <h1 className="mt-4 font-[var(--display)] text-[clamp(24px,3vw,32px)] font-semibold text-[var(--m-head)]">Página não encontrada</h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed">O endereço que você abriu não existe mais ou foi digitado errado.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href={imoveis} className="rounded-full bg-[var(--brand)] px-5 py-3 text-[14px] font-semibold text-[var(--brand-ink)]">Ver imóveis</a>
          <a href={inicio} className="rounded-full border border-[var(--m-line)] bg-[var(--m-surface)] px-5 py-3 text-[14px] font-semibold text-[var(--m-head)]">Ir para o início</a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F2] px-6 text-center" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 className="text-2xl font-semibold text-[#17140F]">Página não encontrada</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-neutral-600">
        O endereço que você abriu não existe mais ou foi digitado errado.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href={imoveis} className="rounded-full bg-[#17140F] px-5 py-2.5 text-[14px] font-semibold text-white">Ver imóveis</a>
        <a href={inicio} className="rounded-full px-5 py-2.5 text-[14px] font-semibold text-[#17140F] ring-1 ring-[#17140F]/15">Ir para o início</a>
      </div>
    </main>
  );
}
