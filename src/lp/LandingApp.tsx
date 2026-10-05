// Peças da entrada da landing (src/lp/main.tsx), separadas para teste.
// Valem as mesmas regras de import da entrada: nada do CRM aqui.
import { useEffect, useState } from 'react';
import { parseLandingPath, type LandingRoute } from '@/features/landing/public/landingLoader';
import { LandingPublicView } from '@/features/landing/public/LandingPublicView';
import { LandingResultView } from '@/features/landing/public/LandingResultView';
import { dominioDoSite, ehEnderecoDoSistema, rotaDaLandingNoDominio } from '@/features/siteBuilder/public/dominioDoSite';

/**
 * Falha de rede ao perguntar de quem é o domínio: não afirma que a página não
 * existe e oferece tentar de novo (igual ao site, em SiteNaoEncontrado).
 */
function IndisponivelAgora() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F0520] px-6 text-center text-neutral-300">
      <p className="text-lg font-semibold text-white">Não deu para abrir a página agora</p>
      <p className="mt-2 text-[15px]">Tente de novo em alguns instantes.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-[#0F0520]"
      >
        Tentar de novo
      </button>
    </div>
  );
}

function Indisponivel() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F0520] px-6 text-center text-neutral-400">
      Esta página não está disponível.
    </div>
  );
}

function Landing({ route, noDominio = false }: { route: LandingRoute; noDominio?: boolean }) {
  if (route.result) {
    return <LandingResultView tenant={route.tenant} slug={route.slug} result={route.result} />;
  }
  return <LandingPublicView tenant={route.tenant} slug={route.slug} noDominio={noDominio} />;
}

/**
 * No domínio do cliente a landing é `/lp/<slug>` e o cliente vem do domínio
 * (`dominioDoSite`, sem nada do CRM). Domínio sem site ativo: indisponível.
 */
function LandingNoDominio() {
  // undefined = perguntando; null = domínio sem site ativo; 'erro' = falha de rede.
  const [route, setRoute] = useState<LandingRoute | null | 'erro' | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    const rota = rotaDaLandingNoDominio(window.location.pathname);
    if (rota && 'redirecionar' in rota) {
      window.location.replace(`${rota.redirecionar}${window.location.search}`);
      return;
    }
    void dominioDoSite().then(estado => {
      if (!vivo) return;
      if (estado.tipo === 'erro') { setRoute('erro'); return; }
      setRoute(rota && estado.tipo === 'site' ? { tenant: estado.site.tenant, slug: rota.slug, result: rota.result } : null);
    });
    return () => { vivo = false; };
  }, []);
  if (route === undefined) return null;
  if (route === 'erro') return <IndisponivelAgora />;
  if (!route) return <Indisponivel />;
  return <Landing route={route} noDominio />;
}

export function LandingApp() {
  if (!ehEnderecoDoSistema(window.location.hostname)) return <LandingNoDominio />;
  const route = parseLandingPath(window.location.pathname);
  if (!route) return <Indisponivel />;
  return <Landing route={route} />;
}
