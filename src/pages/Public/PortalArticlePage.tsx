import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Ic, I, PortalFooter, PortalHeader, PropertyCard, fetchArticle, onlyDigits, usePortalData,
  type PortalArticleFull,
} from './portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — ARTIGO (detalhe de um post do blog) (Produto A).
   Consome `/api/public/v1/site/articles/:slug` (incrementa views no servidor).
   O corpo vem em HTML já renderizado (`body_html`) — autorado pelo dono do
   site na área do Site Builder — e é injetado como rich text.
──────────────────────────────────────────────────────────────────────────── */

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function setMetaDescription(content: string) {
  const el = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
    || (() => { const m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); return m; })();
  el.content = content;
}

export default function PortalArticlePage() {
  const { tenant, slug } = useParams<{ tenant: string; slug: string }>();
  const { state, site, items, fontHref, cssVars } = usePortalData(tenant);

  // Vitrine de imóveis ao fim do artigo (destaques, com fallback pros primeiros).
  const featured = useMemo(() => {
    const f = items.filter(p => p.featured || p.exclusive);
    return (f.length ? f : items).slice(0, 3);
  }, [items]);

  const [article, setArticle] = useState<PortalArticleFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!tenant || !slug) return;
    setLoading(true);
    fetchArticle(tenant, slug)
      .then(a => { if (active) setArticle(a); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenant, slug]);

  useEffect(() => {
    if (!article) return;
    document.title = `${article.title} — ${site.name || 'Blog'}`;
    if (article.excerpt) setMetaDescription(article.excerpt);
  }, [article, site.name]);

  const wa = site.contact?.whatsapp;
  const waHref = wa ? `https://wa.me/${onlyDigits(wa)}` : null;

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

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link to={`/portal/${tenant}/blog`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:text-[var(--brand)]">
          <Ic d={I.arrow} s={15} cls="rotate-180" /> Voltar para o blog
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-neutral-400">Carregando artigo…</div>
        ) : !article ? (
          <div className="flex flex-col items-center justify-center py-24 text-center text-neutral-500">
            <p className="text-[15px]">Artigo não encontrado.</p>
            <Link to={`/portal/${tenant}/blog`} className="mt-4 text-[14px] font-semibold text-[var(--brand)]">Ver todos os artigos</Link>
          </div>
        ) : (
          <article className="mt-6">
            <h1 className="font-[var(--display)] text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{article.title}</h1>
            <div className="mt-3 flex items-center gap-2 text-[13px] text-neutral-400">
              {article.published_at && <span>{formatDate(article.published_at)}</span>}
              {article.published_at && article.reading_time_minutes ? <span aria-hidden>·</span> : null}
              {article.reading_time_minutes ? <span>{article.reading_time_minutes} min de leitura</span> : null}
            </div>

            {article.cover_image_url && (
              <img
                src={article.cover_image_url}
                alt=""
                className="mt-6 aspect-[16/9] w-full rounded-2xl object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}

            {article.body_html && (
              <div
                className="article-body mt-8 text-[16px] leading-relaxed text-neutral-800"
                // corpo autorado pelo dono do site (área autenticada), renderizado como rich text
                dangerouslySetInnerHTML={{ __html: article.body_html }}
              />
            )}

            {waHref && (
              <div className="mt-12 rounded-2xl border border-black/[0.06] bg-white p-6 text-center">
                <p className="text-[15px] font-medium text-[var(--ink)]">Gostou do conteúdo? Fale com a gente.</p>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white"
                  style={{ background: '#25D366' }}
                >
                  <Ic d={I.wa} s={16} /> Falar no WhatsApp
                </a>
              </div>
            )}
          </article>
        )}
      </main>

      {/* ── Imóveis em destaque (só quando o artigo abriu e há imóveis) ──── */}
      {article && featured.length > 0 && (
        <section className="border-t border-black/[0.06] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Selecionados a dedo</span>
                <h2 className="mt-1 font-[var(--display)] text-3xl font-semibold sm:text-4xl">Imóveis em destaque</h2>
              </div>
              <Link to={`/portal/${tenant}/imoveis`} className="hidden shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 sm:inline-flex" style={{ background: 'var(--ink)' }}>
                Ver todos os imóveis <Ic d={I.arrow} s={16} />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map(p => <PropertyCard key={p.id} tenant={tenant!} p={p} wa={wa} />)}
            </div>

            <div className="mt-8 text-center sm:hidden">
              <Link to={`/portal/${tenant}/imoveis`} className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white" style={{ background: 'var(--ink)' }}>
                Ver todos os imóveis <Ic d={I.arrow} s={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      <PortalFooter site={site} tenant={tenant!} />

      {/* Estilos do corpo do artigo (sem plugin de typography no projeto). */}
      <style>{`
        .article-body h1,.article-body h2,.article-body h3{font-weight:600;line-height:1.3;color:var(--ink);margin:1.6em 0 .6em}
        .article-body h1{font-size:1.6em}.article-body h2{font-size:1.35em}.article-body h3{font-size:1.15em}
        .article-body p{margin:0 0 1.1em}
        .article-body a{color:var(--brand);text-decoration:underline}
        .article-body ul,.article-body ol{margin:0 0 1.1em;padding-left:1.4em}
        .article-body ul{list-style:disc}.article-body ol{list-style:decimal}
        .article-body li{margin:.3em 0}
        .article-body img{max-width:100%;height:auto;border-radius:12px;margin:1.2em 0}
        .article-body blockquote{margin:1.2em 0;padding-left:1em;border-left:3px solid var(--brand);color:#555;font-style:italic}
        .article-body strong{font-weight:600}
      `}</style>
    </div>
  );
}
