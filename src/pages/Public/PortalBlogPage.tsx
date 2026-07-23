import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Ic, I, PortalFooter, PortalHeader, fetchArticles, usePortalData,
  type PortalArticleSummary,
} from './portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — BLOG (listagem de artigos publicados) (Produto A).
   Consome o endpoint público `/api/public/v1/site/articles` (só publicados),
   reutilizando a casca visual (header/footer/tokens de marca) das demais
   páginas do portal. Paginação via "Carregar mais".
──────────────────────────────────────────────────────────────────────────── */

const PER_PAGE = 12;

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function ArticleCard({ tenant, a }: { tenant: string; a: PortalArticleSummary }) {
  return (
    <Link
      to={`/portal/${tenant}/blog/${a.slug}`}
      className="group flex flex-col overflow-hidden rounded-[20px] bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-16px_rgba(0,0,0,0.25)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-neutral-100">
        {a.cover_image_url ? (
          <img
            src={a.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <Ic d={I.arrow} s={28} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[17px] font-semibold leading-snug text-[var(--ink)] transition-colors group-hover:text-[var(--brand)]">
          {a.title}
        </h3>
        {a.excerpt && (
          <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-neutral-600">{a.excerpt}</p>
        )}
        <div className="mt-4 flex items-center gap-2 text-[12px] text-neutral-400">
          {a.published_at && <span>{formatDate(a.published_at)}</span>}
          {a.published_at && a.reading_time_minutes ? <span aria-hidden>·</span> : null}
          {a.reading_time_minutes ? <span>{a.reading_time_minutes} min de leitura</span> : null}
        </div>
      </div>
    </Link>
  );
}

export default function PortalBlogPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const { state, site, fontHref, cssVars } = usePortalData(tenant);

  const [articles, setArticles] = useState<PortalArticleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!tenant) return;
    setLoading(true);
    fetchArticles(tenant, page, PER_PAGE)
      .then(r => {
        if (!active) return;
        setArticles(prev => (page === 1 ? r.data : [...prev, ...r.data]));
        setTotal(r.total);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenant, page]);

  useEffect(() => {
    document.title = `Blog — ${site.name || 'Portal'}`;
  }, [site.name]);

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400" style={{ fontFamily: 'system-ui' }}>Carregando…</div>;
  }
  if (state === 'error') {
    return <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500" style={{ fontFamily: 'system-ui' }}>Portal indisponível.</div>;
  }

  const hasMore = articles.length < total;

  return (
    <div style={cssVars as CSSProperties} className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={fontHref} rel="stylesheet" />

      <PortalHeader site={site} tenant={tenant!} />

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-10">
          <h1 className="font-[var(--display)] text-3xl font-semibold tracking-tight sm:text-4xl">Blog</h1>
          <p className="mt-2 text-[15px] text-neutral-500">Novidades, dicas e conteúdo sobre o mercado imobiliário.</p>
        </header>

        {loading && articles.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-neutral-400">Carregando artigos…</div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 py-20 text-center text-neutral-500">
            <Ic d={I.arrow} s={28} cls="mb-3 opacity-40" />
            <p className="text-[15px]">Nenhum artigo publicado ainda.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map(a => <ArticleCard key={a.id} tenant={tenant!} a={a} />)}
            </div>
            {hasMore && (
              <div className="mt-12 flex justify-center">
                <button
                  type="button"
                  onClick={() => setPage(p => p + 1)}
                  disabled={loading}
                  className="rounded-full border border-black/10 bg-white px-6 py-3 text-[14px] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-50"
                >
                  {loading ? 'Carregando…' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <PortalFooter site={site} tenant={tenant!} />
    </div>
  );
}
