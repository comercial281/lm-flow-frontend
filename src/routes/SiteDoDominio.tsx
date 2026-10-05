/**
 * O site do cliente aberto no DOMÍNIO dele (www.imobiliaria.com.br).
 *
 * Só as páginas do site, em caminhos limpos:
 *   /  ·  /imoveis  ·  /imovel/:code  ·  /blog  ·  /blog/:slug  ·  /p/:slug
 *   /financiamento  ·  /anuncie  ·  /lp/:slug
 * Qualquer outro caminho (o /login, /conversas, /settings… do CRM) cai no
 * início do site. Endereço antigo colado no domínio (/portal/<cliente>/imoveis,
 * /imovel/<cliente>/<código>) vai para o limpo.
 *
 * ARMADILHA: nada do CRM entra aqui. Sem AuthProvider, sem store de sessão, sem
 * websocket, sem contextos do app: quem monta isto é `src/mainDoSite.tsx`, e o
 * app do CRM (`src/App.tsx`) nem chega a ser baixado. O spec
 * `SiteDoDominio.spec.tsx` falha se o módulo de sessão for importado.
 */
import { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { lazyWithRetry } from '@/utils/chunkReload';
import { dominioDoSite, rotaDaLandingNoDominio, type EstadoDoDominio, type SiteDoDominio } from '@/features/siteBuilder/public/dominioDoSite';
import { SiteDoDominioContext } from '@/features/siteBuilder/public/useTenantDoSite';
import SiteNaoEncontrado from '@/pages/Public/SiteNaoEncontrado';

const PortalHome = lazyWithRetry(() => import('@/pages/Public/PortalHomePage'));
const PortalSearch = lazyWithRetry(() => import('@/pages/Public/PortalSearchPage'));
const ImovelPublic = lazyWithRetry(() => import('@/pages/Public/ImovelPublicPage'));
const PortalBlog = lazyWithRetry(() => import('@/pages/Public/PortalBlogPage'));
const PortalArticle = lazyWithRetry(() => import('@/pages/Public/PortalArticlePage'));
const PortalCustomPage = lazyWithRetry(() => import('@/pages/Public/PortalCustomPage'));
const PortalFinanciamento = lazyWithRetry(() => import('@/pages/Public/PortalFinanciamentoPage'));
const PortalAnuncie = lazyWithRetry(() => import('@/pages/Public/PortalAnunciePage'));
const LandingPublicView = lazyWithRetry(() =>
  import('@/features/landing/public/LandingPublicView').then(m => ({ default: m.LandingPublicView })));
const LandingResultView = lazyWithRetry(() =>
  import('@/features/landing/public/LandingResultView').then(m => ({ default: m.LandingResultView })));

/** /portal/<cliente>/<resto> → /<resto>, com a busca e a âncora. */
function PortalAntigo() {
  const { pathname, search, hash } = useLocation();
  const resto = pathname.replace(/^\/portal\/[^/]*/, '') || '/';
  return <Navigate to={`${resto}${search}${hash}`} replace />;
}

/** /imovel/<cliente>/<código> → /imovel/<código>. */
function ImovelAntigo() {
  const { code = '' } = useParams<{ code: string }>();
  const { search, hash } = useLocation();
  return <Navigate to={`/imovel/${encodeURIComponent(code)}${search}${hash}`} replace />;
}

/**
 * Rede: em produção o /lp/* é servido pelo `lp.html` (vercel.json), que já
 * entende o domínio. Isto só roda se o app chegar a abrir um /lp/.
 */
function LandingDoDominio({ tenant }: { tenant: string }) {
  const { pathname, search } = useLocation();
  const rota = rotaDaLandingNoDominio(pathname);
  if (!rota) return <Navigate to="/" replace />;
  if ('redirecionar' in rota) return <Navigate to={`${rota.redirecionar}${search}`} replace />;
  return rota.result
    ? <LandingResultView tenant={tenant} slug={rota.slug} result={rota.result} />
    : <LandingPublicView tenant={tenant} slug={rota.slug} noDominio />;
}

/** As rotas do site no domínio. Exportado para o teste montar com MemoryRouter. */
export function RotasDoSite({ site }: { site: SiteDoDominio }) {
  return (
    <SiteDoDominioContext.Provider value={site}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<PortalHome />} />
          <Route path="/imoveis" element={<PortalSearch />} />
          <Route path="/imovel/:code" element={<ImovelPublic />} />
          <Route path="/imovel/:tenant/:code" element={<ImovelAntigo />} />
          <Route path="/blog" element={<PortalBlog />} />
          <Route path="/blog/:slug" element={<PortalArticle />} />
          <Route path="/p/:slug" element={<PortalCustomPage />} />
          <Route path="/financiamento" element={<PortalFinanciamento />} />
          <Route path="/anuncie" element={<PortalAnuncie />} />
          <Route path="/lp/*" element={<LandingDoDominio tenant={site.tenant} />} />
          <Route path="/portal/*" element={<PortalAntigo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SiteDoDominioContext.Provider>
  );
}

/** Pergunta qual site este domínio mostra e monta o site, ou "Site não encontrado". */
export default function SiteDoDominioApp() {
  const [estado, setEstado] = useState<EstadoDoDominio | null>(null);
  useEffect(() => {
    let vivo = true;
    void dominioDoSite().then(e => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, []);

  if (!estado) return null;
  if (estado.tipo !== 'site') return <SiteNaoEncontrado erro={estado.tipo === 'erro'} />;
  return (
    <BrowserRouter>
      <RotasDoSite site={estado.site} />
    </BrowserRouter>
  );
}
