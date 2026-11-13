import { Link } from 'react-router-dom';
import { I, Ic } from '../portalShared';
import { ESTILO_DO_CORPO } from './ArtigoModerno';

/* Página própria do Moderno (Meu site › Páginas; spec 7): coluna de leitura com
   o HTML que o cliente escreveu (já sanitizado no servidor), no tipo e no
   espaçamento do Moderno, e "Voltar para o início". */
export default function PaginaPropriaModerna({ page, loading, inicio }: {
  page: { title: string; content_html: string } | null; loading: boolean; inicio: string;
}) {
  return (
    <main className="px-4 pb-[clamp(56px,8vw,96px)]">
      <div className="mx-auto max-w-[720px] pt-[clamp(28px,4vw,48px)]">
        <Link to={inicio} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--m-muted)] hover:text-[var(--m-head)]">
          <Ic d={I.arrow} s={15} cls="rotate-180" /> Voltar para o início
        </Link>
        {loading ? (
          <div data-carregando className="flex items-center justify-center py-24 text-[var(--m-muted)]">Carregando página…</div>
        ) : !page ? (
          <p className="py-24 text-center text-[15px] text-[var(--m-muted)]">Página não encontrada.</p>
        ) : (
          <article className="mt-6">
            <h1 className="font-[var(--display)] text-[clamp(30px,4vw,46px)] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--m-head)] [text-wrap:balance]">{page.title}</h1>
            {/* HTML já sanitizado no servidor */}
            <div className="corpo-moderno mt-8 text-[16.5px] leading-[1.75] text-[var(--m-text)]" dangerouslySetInnerHTML={{ __html: page.content_html }} />
          </article>
        )}
      </div>
      <style>{ESTILO_DO_CORPO}</style>
    </main>
  );
}
