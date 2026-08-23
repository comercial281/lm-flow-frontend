import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { DEFAULT_LANDING_THEME, themeToCssVars, type LandingTheme } from '@/features/landing/blocks';

interface LeadFormCfg {
  specialistName?: string;
  disqualifiedTitle?: string;
  disqualifiedMessage?: string;
  thankyouTitle?: string;
  thankyouMessage?: string;
}
interface Block { type: string; config?: Record<string, unknown> }
interface Pixel { pixel_id?: string | null; events?: { page_view?: boolean } }

/**
 * Página de resultado da landing (Fatia 4b): /lp/:tenant/:slug/obrigado |
 * /desqualificado. URL própria pra o Pixel disparar um PageView dedicado
 * (otimização de anúncio). NOINDEX. Conteúdo vem do bloco lead_form da landing.
 */
export default function LandingResultPage() {
  const { tenant, slug, result } = useParams<{ tenant: string; slug: string; result: string }>();
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
      try {
        const base = import.meta.env.VITE_API_URL as string;
        const res = await fetch(`${base}/api/public/v1/landing/${encodeURIComponent(slug)}`, {
          headers: { 'X-Tenant': tenant },
        });
        if (!res.ok) {
          if (active) setState('notfound');
          return;
        }
        const json = (await res.json()) as {
          data: { title?: string; theme?: Partial<LandingTheme>; content_blocks?: Block[]; pixel?: Pixel | null };
        };
        if (!active) return;
        const blocks = json.data.content_blocks ?? [];
        const lead = blocks.find((b) => b.type === 'lead_form');
        setCfg((lead?.config ?? {}) as LeadFormCfg);
        setTheme(json.data.theme ?? {});
        setPixel(json.data.pixel ?? null);
        // Acha um WhatsApp em algum bloco (sticky_cta / consultant) pro CTA.
        const wa = blocks
          .map((b) => (b.config?.whatsappPhone as string) || (b.config?.phone as string))
          .find((p) => typeof p === 'string' && p.replace(/\D/g, '').length >= 10);
        setWhatsapp(wa ? wa.replace(/\D/g, '') : null);
        document.title = json.data.title || 'Obrigado';
        setState('ok');
      } catch {
        if (active) setState('notfound');
      }
    })();
    return () => {
      active = false;
    };
  }, [tenant, slug]);

  // Pixel: PageView dedicado desta página de resultado.
  useEffect(() => {
    const id = pixel?.pixel_id;
    if (!id) return;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any;
    if (!w.fbq) {
      const n: any = (w.fbq = function (...args: unknown[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
      });
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      const t = document.createElement('script');
      t.async = true;
      t.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(t);
    }
    w.fbq('init', id);
    if (pixel?.events?.page_view !== false) w.fbq('track', 'PageView');
    /* eslint-enable @typescript-eslint/no-explicit-any */
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
  const message = disqualified
    ? cfg.disqualifiedMessage || 'Recebemos seus dados. Vamos te avisar sobre outras oportunidades.'
    : cfg.thankyouMessage || `O corretor ${specialist} entrará em contato em breve.`;

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
            Fura a fila e fale no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
