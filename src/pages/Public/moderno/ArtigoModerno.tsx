import { Link } from 'react-router-dom';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { caminhoDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { I, Ic, type PortalArticleFull, type PortalProperty } from '../portalShared';
import CartaoClaro from './CartaoClaro';
import { LinhaDoArtigo } from './BlogModerno';
import { MIOLO } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   Artigo do Moderno (spec 7): coluna de leitura de ~720px, capa arredondada,
   o mesmo corpo em HTML (escrito pelo dono do site), chamada "Gostou do
   conteúdo? Fale com a gente." em bloco da cor principal, "Imóveis em
   destaque" com o cartão claro e "Ver todos os artigos".
──────────────────────────────────────────────────────────────────────────── */

/** Corpo do artigo no tipo do Moderno (sem plugin de typography no projeto). */
export const ESTILO_DO_CORPO = `
.corpo-moderno h1,.corpo-moderno h2,.corpo-moderno h3{font-family:var(--display);font-weight:600;line-height:1.25;color:var(--m-head);margin:1.6em 0 .6em;letter-spacing:-.01em}
.corpo-moderno h1{font-size:1.6em}.corpo-moderno h2{font-size:1.35em}.corpo-moderno h3{font-size:1.15em}
.corpo-moderno p{margin:0 0 1.1em}
.corpo-moderno a{color:var(--m-head);text-decoration:underline;text-decoration-color:var(--accent);text-underline-offset:3px}
.corpo-moderno ul,.corpo-moderno ol{margin:0 0 1.1em;padding-left:1.4em}
.corpo-moderno ul{list-style:disc}.corpo-moderno ol{list-style:decimal}
.corpo-moderno li{margin:.3em 0}
.corpo-moderno img{max-width:100%;height:auto;border-radius:20px;margin:1.2em 0}
.corpo-moderno blockquote{margin:1.2em 0;padding-left:1em;border-left:3px solid var(--accent);color:var(--m-muted);font-style:italic}
.corpo-moderno strong{font-weight:600;color:var(--m-head)}
`;

const VER_TODOS = 'inline-flex items-center gap-1.5 rounded-full border border-[var(--m-line)] bg-[var(--m-surface)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--m-head)]';

export default function ArtigoModerno({ tenant, article, loading, featured, wa, waHref }: {
  tenant: string; article: PortalArticleFull | null; loading: boolean; featured: PortalProperty[]; wa?: string | null; waHref: string | null;
}) {
  const ctx = useCtxDoSite(tenant);
  const blog = caminhoDoSite(ctx, '/blog');

  return (
    <main className="px-4 pb-[clamp(56px,8vw,96px)]">
      <div className="mx-auto max-w-[720px] pt-[clamp(28px,4vw,48px)]">
        <Link to={blog} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--m-muted)] hover:text-[var(--m-head)]">
          <Ic d={I.arrow} s={15} cls="rotate-180" /> Voltar para o blog
        </Link>

        {loading ? (
          <div data-carregando className="flex items-center justify-center py-24 text-[var(--m-muted)]">Carregando artigo…</div>
        ) : !article ? (
          <div className="flex flex-col items-center justify-center py-24 text-center text-[var(--m-muted)]">
            <p className="text-[15px]">Artigo não encontrado.</p>
            <Link to={blog} className={`mt-4 ${VER_TODOS}`}>Ver todos os artigos</Link>
          </div>
        ) : (
          <article className="mt-6">
            <h1 className="font-[var(--display)] text-[clamp(30px,4vw,46px)] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--m-head)] [text-wrap:balance]">{article.title}</h1>
            <div className="mt-3"><LinhaDoArtigo a={article} /></div>
            {article.cover_image_url && (
              <img src={article.cover_image_url} alt="" className="mt-7 aspect-[16/9] w-full rounded-[28px] object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            {article.body_html && (
              <div
                className="corpo-moderno mt-8 text-[16.5px] leading-[1.75] text-[var(--m-text)]"
                // corpo autorado pelo dono do site (área autenticada), renderizado como rich text
                dangerouslySetInnerHTML={{ __html: article.body_html }}
              />
            )}
            {waHref && (
              <div data-testid="chamada-do-artigo" className="mt-12 flex flex-col items-start justify-between gap-4 rounded-[28px] bg-[var(--brand)] p-[clamp(22px,3.5vw,32px)] text-[var(--brand-ink)] sm:flex-row sm:items-center">
                <p className="font-[var(--display)] text-[20px] font-semibold">Gostou do conteúdo? Fale com a gente.</p>
                <a href={waHref} target="_blank" rel="noreferrer"
                  className="inline-flex flex-none items-center gap-2 rounded-full bg-[#1FAF5A] px-5 py-3 text-[14px] font-semibold text-white">
                  <Ic d={I.wa} s={16} /> Falar no WhatsApp
                </a>
              </div>
            )}
            <div className="mt-8"><Link to={blog} className={VER_TODOS}>Ver todos os artigos</Link></div>
          </article>
        )}
      </div>

      {article && featured.length > 0 && (
        <section className={`${MIOLO} pt-[clamp(56px,8vw,96px)]`}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-[var(--display)] text-[clamp(26px,3.4vw,40px)] font-semibold leading-[1.06] tracking-[-0.03em] text-[var(--m-head)]">Imóveis em destaque</h2>
            <Link to={caminhoDoSite(ctx, '/imoveis')} className={VER_TODOS}>Ver todos os imóveis <Ic d={I.arrow} s={15} /></Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map(p => <CartaoClaro key={p.id} tenant={tenant} p={p} wa={wa} />)}
          </div>
        </section>
      )}

      <style>{ESTILO_DO_CORPO}</style>
    </main>
  );
}
