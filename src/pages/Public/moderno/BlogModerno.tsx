import { Link } from 'react-router-dom';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { caminhoDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { I, Ic, type PortalArticleSummary } from '../portalShared';
import { MIOLO } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   Blog do Moderno (spec 7): o primeiro artigo em destaque (foto grande ao lado
   do texto; no celular, empilha), os outros em grade de 3 e "Carregar mais".
   Os artigos e a paginação são os da página (`PortalBlogPage`).
──────────────────────────────────────────────────────────────────────────── */

export function dataDoArtigo(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function LinhaDoArtigo({ a }: { a: { published_at?: string | null; reading_time_minutes?: number | null } }) {
  const data = dataDoArtigo(a.published_at);
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-[var(--m-muted)]">
      {data && <span>{data}</span>}
      {data && a.reading_time_minutes ? <span aria-hidden>·</span> : null}
      {a.reading_time_minutes ? <span>{a.reading_time_minutes} min de leitura</span> : null}
    </div>
  );
}

function Capa({ url, className }: { url?: string | null; className: string }) {
  return (
    <div className={`relative overflow-hidden bg-[var(--m-brand-soft)] ${className}`}>
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-[var(--m-head)] opacity-40"><Ic d={I.page} s={32} /></span>
      )}
    </div>
  );
}

export default function BlogModerno({ tenant, articles, loading, hasMore, carregarMais }: {
  tenant: string; articles: PortalArticleSummary[]; loading: boolean; hasMore: boolean; carregarMais: () => void;
}) {
  const ctx = useCtxDoSite(tenant);
  const href = (a: PortalArticleSummary) => caminhoDoSite(ctx, `/blog/${a.slug}`);
  const [primeiro, ...resto] = articles;

  return (
    <main className="px-4 pb-[clamp(56px,8vw,96px)]">
      <div className={MIOLO}>
        <header className="pb-7 pt-[clamp(36px,5vw,64px)]">
          <h1 className="font-[var(--display)] text-[clamp(32px,4.4vw,54px)] font-semibold leading-[1.06] tracking-[-0.03em] text-[var(--m-head)]">Blog</h1>
          <p className="mt-3 text-[15.5px] text-[var(--m-text)]">Novidades, dicas e conteúdo sobre o mercado imobiliário.</p>
        </header>

        {loading && articles.length === 0 ? (
          <div data-carregando className="flex items-center justify-center py-20 text-[var(--m-muted)]">Carregando artigos…</div>
        ) : !primeiro ? (
          <div className="rounded-[20px] border border-dashed border-[var(--m-line)] py-20 text-center text-[15px] text-[var(--m-muted)]">Nenhum artigo publicado ainda.</div>
        ) : (
          <>
            <Link data-testid="artigo-em-destaque" to={href(primeiro)}
              className="group grid overflow-hidden rounded-[28px] border border-[var(--m-line)] bg-[var(--m-surface)] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Capa url={primeiro.cover_image_url} className="aspect-[16/10] md:aspect-auto md:min-h-[340px]" />
              <div className="flex flex-col justify-center gap-3 p-[clamp(20px,3.5vw,40px)]">
                <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--m-muted)]">Em destaque</span>
                <h2 className="font-[var(--display)] text-[clamp(24px,3vw,34px)] font-semibold leading-[1.12] tracking-[-0.02em] text-[var(--m-head)]">{primeiro.title}</h2>
                {primeiro.excerpt && <p className="line-clamp-4 text-[15px] leading-relaxed text-[var(--m-text)]">{primeiro.excerpt}</p>}
                <LinhaDoArtigo a={primeiro} />
                <span className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--m-head)]">Ler artigo <Ic d={I.arrow} s={15} /></span>
              </div>
            </Link>

            {resto.length > 0 && (
              <div data-testid="artigos-em-grade" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {resto.map(a => (
                  <Link key={a.id} to={href(a)} className="group flex flex-col overflow-hidden rounded-[20px] border border-[var(--m-line)] bg-[var(--m-surface)]">
                    <Capa url={a.cover_image_url} className="aspect-[16/9]" />
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      <h3 className="font-[var(--display)] text-[17px] font-semibold leading-snug text-[var(--m-head)]">{a.title}</h3>
                      {a.excerpt && <p className="line-clamp-3 text-[14px] leading-relaxed text-[var(--m-text)]">{a.excerpt}</p>}
                      <div className="mt-auto pt-2"><LinhaDoArtigo a={a} /></div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {hasMore && (
              <div className="mt-10 flex justify-center">
                <button type="button" onClick={carregarMais} disabled={loading}
                  className="rounded-full bg-[var(--brand)] px-6 py-3 text-[14px] font-semibold text-[var(--brand-ink)] transition-transform hover:-translate-y-px disabled:opacity-50">
                  {loading ? 'Carregando…' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
