import { useEffect, type CSSProperties } from 'react';

/* 404 de lista do Moderno (`/imoveis/...` que não existe; spec 7): "404"
   grande, título, texto e os dois botões. Mora aqui, carregada pela busca
   (página preguiçosa), e não na `PaginaNaoEncontrada`: aquela entra no pacote
   inicial do domínio (landings inclusive) e precisa continuar sem dependência.
   Mesmo título da aba e `noindex` da 404 de sempre. */
export default function NaoEncontradaModerna({ inicio, imoveis, cssVars, fontHrefs, fundo }: {
  inicio: string; imoveis: string; cssVars: CSSProperties; fontHrefs: string[]; fundo?: string;
}) {
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

  return (
    <main data-pagina-moderna="404" style={cssVars} data-fundo={fundo}
      className="flex min-h-screen flex-col items-center justify-center bg-[var(--m-ground)] px-6 text-center text-[var(--m-text)] antialiased">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {fontHrefs.map(h => <link key={h} href={h} rel="stylesheet" />)}
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
