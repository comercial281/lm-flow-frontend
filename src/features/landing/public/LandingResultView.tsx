import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import {
  DEFAULT_LANDING_THEME,
  fillTemplate,
  themeToCssVars,
  type LandingTheme,
} from '@/features/landing/blocks';
import { loadLanding } from './landingLoader';
import { installPixel } from './metaPixel';

interface LeadFormCfg {
  specialistName?: string;
  disqualifiedTitle?: string;
  disqualifiedMessage?: string;
  thankyouTitle?: string;
  thankyouMessage?: string;
  whatsappLabel?: string;
}
interface Block { type: string; config?: Record<string, unknown> }
interface Pixel { pixel_id?: string | null; events?: { page_view?: boolean } }

export interface LandingResultViewProps {
  tenant: string;
  slug: string;
  /** `obrigado` | `desqualificado`. */
  result?: string;
}

/**
 * Página de resultado da landing (Fatia 4b): /lp/:tenant/:slug/obrigado |
 * /desqualificado. URL própria pra o Pixel disparar um PageView dedicado
 * (otimização de anúncio). NOINDEX. Conteúdo vem do bloco lead_form da landing.
 * Sem roteador: tenant/slug/result chegam por props (ver LandingPublicView).
 */
export function LandingResultView({ tenant, slug, result }: LandingResultViewProps) {
  const disqualified = result === 'desqualificado';
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [cfg, setCfg] = useState<LeadFormCfg>({});
  const [theme, setTheme] = useState<Partial<LandingTheme>>({});
  const [pixel, setPixel] = useState<Pixel | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!tenant || !slug) return;
      const dto = await loadLanding({ tenant, slug, base: import.meta.env.VITE_API_URL as string });
      if (!active) return;
      if (!dto) {
        setState('notfound');
        return;
      }
      const blocks = (dto.content_blocks ?? []) as Block[];
      const lead = blocks.find((b) => b.type === 'lead_form');
      setCfg((lead?.config ?? {}) as LeadFormCfg);
      setTheme((dto.theme ?? {}) as Partial<LandingTheme>);
      setPixel(dto.pixel ?? null);
      // Acha um WhatsApp em algum bloco (sticky_cta / consultant) pro CTA.
      const wa = blocks
        .map((b) => (b.config?.whatsappPhone as string) || (b.config?.phone as string))
        .find((p) => typeof p === 'string' && p.replace(/\D/g, '').length >= 10);
      setWhatsapp(wa ? wa.replace(/\D/g, '') : null);
      document.title = dto.title || 'Obrigado';
      setState('ok');
    })();
    return () => {
      active = false;
    };
  }, [tenant, slug]);

  // Pixel: PageView dedicado desta página de resultado (script depois da
  // página carregar — ver metaPixel.ts).
  useEffect(() => {
    const id = pixel?.pixel_id;
    if (!id) return;
    installPixel(id, { pageView: pixel?.events?.page_view !== false });
  }, [pixel?.pixel_id, pixel?.events?.page_view]);

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-[#0F0520] text-neutral-400">Carregando…</div>;
  }
  if (state === 'notfound') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F0520] px-6 text-center text-neutral-400">
        Esta página não está disponível.
      </div>
    );
  }

  const specialist = cfg.specialistName || 'nosso especialista';
  const title = disqualified
    ? cfg.disqualifiedTitle || 'Obrigado pelo seu interesse!'
    : cfg.thankyouTitle || 'Recebemos suas informações!';
  // Os mesmos textos da tela que aparece dentro da própria página, inclusive o
  // marcador do nome do corretor: são a mesma mensagem em dois endereços, e
  // divergir aqui já custou uma landing mostrando duas despedidas diferentes.
  const message = fillTemplate(
    disqualified
      ? cfg.disqualifiedMessage || 'Recebemos seus dados. Vamos te avisar sobre outras oportunidades.'
      : cfg.thankyouMessage || `O corretor {especialista} entrará em contato em breve.`,
    { especialista: specialist },
  );

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-4"
      style={{ ...themeToCssVars({ ...DEFAULT_LANDING_THEME, ...theme }), background: theme.bgEnd ?? '#0A0A0B', color: 'var(--lp-text)', fontFamily: 'var(--lp-font)' }}
    >
      <div className="w-full max-w-sm rounded-2xl border p-6 text-center" style={{ background: 'var(--lp-block-bg)', borderColor: 'var(--lp-border)' }}>
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#16A34A' }}>
          <Check size={30} className="text-white" />
        </div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm opacity-70">{message}</p>
        {!disqualified && whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold text-white"
            style={{ background: '#16A34A' }}
          >
            {cfg.whatsappLabel || 'Fura a fila e fale direto no WhatsApp'}
          </a>
        )}
      </div>
    </div>
  );
}

export default LandingResultView;
