import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { PortalFooter, PortalHeader, usePortalData } from './portalShared';
import { usePortalTracking } from './usePortalTracking';

/* Página criada no Meu site (Páginas), aberta em /portal/:tenant/p/:slug.
   O HTML (`content_html`) chega já sanitizado pelo servidor. */

const API = import.meta.env.VITE_API_URL as string;

interface CustomPage { title: string; slug: string; content_html: string }

export default function PortalCustomPage() {
  const { tenant, slug } = useParams<{ tenant: string; slug: string }>();
  const { state, site, fontHref, cssVars } = usePortalData(tenant);
  const { pathname } = useLocation();
  usePortalTracking(state === 'ok' ? site : null, tenant, { kind: 'page', path: pathname, pageSlug: slug });

  const [page, setPage] = useState<CustomPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!tenant || !slug) return;
    setLoading(true);
    setPage(null);
    fetch(`${API}/api/public/v1/site/pages/${encodeURIComponent(slug)}`, { headers: { 'X-Tenant': tenant } })
      .then(async res => (res.ok ? ((await res.json()).data as CustomPage) : null))
      .catch(() => null)
      .then(p => { if (active) setPage(p || null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenant, slug]);

  useEffect(() => {
    if (page) document.title = `${page.title} — ${site.name || 'Imóveis'}`;
  }, [page, site.name]);

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400" style={{ fontFamily: 'system-ui' }}>Carregando…</div>;
  }
  if (state === 'error') {
    return <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500" style={{ fontFamily: 'system-ui' }}>Portal indisponível.</div>;
  }

  return (
    <div style={cssVars as CSSProperties} className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={fontHref} rel="stylesheet" />

      <PortalHeader site={site} tenant={tenant!} />

      {loading ? (
        <div className="flex items-center justify-center py-24 text-neutral-400">Carregando página…</div>
      ) : !page ? (
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4 py-24 text-center text-neutral-500">
          <p className="text-[15px]">Página não encontrada.</p>
          <Link to={`/portal/${tenant}`} className="mt-4 text-[14px] font-semibold text-[var(--brand)]">Voltar para o início</Link>
        </div>
      ) : (
        <article className="prose custom-page mx-auto max-w-3xl px-4 py-10">
          <h1>{page.title}</h1>
          {/* HTML já sanitizado no servidor */}
          <div dangerouslySetInnerHTML={{ __html: page.content_html }} />
        </article>
      )}

      <PortalFooter site={site} tenant={tenant!} />

      {/* Sem plugin de typography no projeto: estilos básicos do corpo. */}
      <style>{`
        .custom-page h1{font-size:2rem;font-weight:600;line-height:1.2;margin:0 0 1em}
        .custom-page h2{font-size:1.4em;font-weight:600;margin:1.6em 0 .6em}
        .custom-page h3{font-size:1.15em;font-weight:600;margin:1.4em 0 .5em}
        .custom-page p{margin:0 0 1.1em;line-height:1.7}
        .custom-page a{color:var(--brand);text-decoration:underline}
        .custom-page ul,.custom-page ol{margin:0 0 1.1em;padding-left:1.4em}
        .custom-page ul{list-style:disc}.custom-page ol{list-style:decimal}
        .custom-page img{max-width:100%;height:auto;border-radius:12px;margin:1.2em 0}
      `}</style>
    </div>
  );
}
