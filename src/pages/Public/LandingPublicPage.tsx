import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  BlockRenderer,
  safeParsePageBlocks,
  type BlockInstance,
  type LandingProperty,
  type LandingTheme,
  type LeadSubmitPayload,
} from '@/features/landing/blocks';

interface LandingPixel {
  pixel_id?: string | null;
  events?: { page_view?: boolean; lead?: boolean; qualified?: boolean; disqualified?: boolean };
}

interface PublicLandingDTO {
  title: string;
  theme?: Partial<LandingTheme> | null;
  content_blocks: unknown[];
  pixel?: LandingPixel | null;
  property?: {
    code: string;
    title: string;
    description?: string;
    stage?: LandingProperty['stage'];
    sale_price?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    suites?: number | null;
    parking_spaces?: number | null;
    useful_area_m2?: number | null;
    total_area_m2?: number | null;
    address_neighborhood?: string;
    address_city?: string;
    address_state?: string;
    latitude?: number | null;
    longitude?: number | null;
    responsible_name?: string;
    photos?: Array<{ file_url: string; thumbnail_url?: string | null; caption?: string | null; alt_text?: string | null; is_cover?: boolean }>;
  } | null;
}

function toProperty(p: PublicLandingDTO['property']): LandingProperty | null {
  if (!p) return null;
  return {
    code: p.code,
    title: p.title,
    description: p.description,
    stage: p.stage,
    salePrice: p.sale_price ?? null,
    bedrooms: p.bedrooms ?? null,
    bathrooms: p.bathrooms ?? null,
    suites: p.suites ?? null,
    parkingSpaces: p.parking_spaces ?? null,
    usefulAreaM2: p.useful_area_m2 ?? null,
    totalAreaM2: p.total_area_m2 ?? null,
    neighborhood: p.address_neighborhood,
    city: p.address_city,
    state: p.address_state,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    responsibleName: p.responsible_name,
    photos: (p.photos ?? []).map((ph) => ({
      url: ph.file_url,
      thumbnailUrl: ph.thumbnail_url ?? undefined,
      caption: ph.caption ?? undefined,
      alt: ph.alt_text ?? undefined,
      isCover: ph.is_cover,
    })),
  };
}

/** Public, no-auth view of a published ad landing. Hosted by Leal Mídia
 *  (no client domain needed). NOINDEX. Tenant comes from the URL. */
export default function LandingPublicPage() {
  const { tenant, slug } = useParams<{ tenant: string; slug: string }>();
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [blocks, setBlocks] = useState<BlockInstance[]>([]);
  const [theme, setTheme] = useState<Partial<LandingTheme>>({});
  const [property, setProperty] = useState<LandingProperty | null>(null);
  const [pixel, setPixel] = useState<LandingPixel | null>(null);

  // Dispara um evento no Pixel Meta (se carregado). standard = track, custom = trackCustom.
  const trackPixel = (event: string, custom = false) => {
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (fbq) fbq(custom ? 'trackCustom' : 'track', event);
  };

  const cookie = (name: string) =>
    document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.split('=')[1];

  // Clique num CTA fixo: whatsapp abre wa.me; senão rola até o formulário.
  const onCtaClick = (e: ReactMouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-lp-action]') as HTMLElement | null;
    if (!el) return;
    const action = el.getAttribute('data-lp-action');
    const wa = el.getAttribute('data-whatsapp-phone');
    if (action === 'whatsapp' && wa) {
      e.preventDefault();
      window.open(`https://wa.me/${wa.replace(/\D/g, '')}`, '_blank');
      return;
    }
    if (action === 'open_form') {
      e.preventDefault();
      document.getElementById('lp-lead-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Grava o lead do formulário multi-step no CRM (com respostas + tracking).
  const onSubmitLead = async (payload: LeadSubmitPayload) => {
    if (!tenant || !slug) return;
    const base = import.meta.env.VITE_API_URL as string;
    const params = new URLSearchParams(window.location.search);
    const res = await fetch(`${base}/api/public/v1/landing/${encodeURIComponent(slug)}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant': tenant },
      body: JSON.stringify({
        lead: {
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          source: 'landing',
          utm_source: params.get('utm_source') ?? undefined,
          utm_medium: params.get('utm_medium') ?? undefined,
          utm_campaign: params.get('utm_campaign') ?? undefined,
          utm_term: params.get('utm_term') ?? undefined,
          utm_content: params.get('utm_content') ?? undefined,
          form_data: {
            answers: payload.answers,
            fbp: cookie('_fbp') ?? null,
            fbc: cookie('_fbc') ?? null,
            referrer: document.referrer || null,
            landing_url: window.location.href,
          },
        },
      }),
    });
    // Retorna a qualificação computada no backend pra a tela final ramificar.
    try {
      const json = (await res.json()) as { data?: { qualification?: 'qualified' | 'disqualified' } };
      const qualification = json?.data?.qualification;
      // Eventos de conversão no Pixel.
      const ev = pixel?.events ?? {};
      if (pixel?.pixel_id) {
        if (ev.lead !== false) trackPixel('Lead');
        if (qualification === 'qualified' && ev.qualified !== false) trackPixel('LeadQualificado', true);
        if (qualification === 'disqualified' && ev.disqualified) trackPixel('LeadDesqualificado', true);
      }
      // Fatia 4b: se a landing usa páginas de resultado com URL própria,
      // redireciona (PageView próprio no Pixel) em vez da tela in-page.
      const leadForm = blocks.find((b) => b.type === 'lead_form');
      const resultMode = (leadForm?.config as { resultMode?: string } | undefined)?.resultMode;
      if (resultMode === 'url') {
        const path = qualification === 'disqualified' ? 'desqualificado' : 'obrigado';
        window.location.assign(`/lp/${encodeURIComponent(tenant)}/${encodeURIComponent(slug)}/${path}`);
      }
      return { qualification };
    } catch {
      return {};
    }
  };

  // noindex — nunca indexar landing de anúncio.
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
        const json = (await res.json()) as { data: PublicLandingDTO };
        const dto = json.data;
        if (!active) return;
        setBlocks(safeParsePageBlocks(dto.content_blocks));
        setTheme(dto.theme ?? {});
        setProperty(toProperty(dto.property));
        setPixel(dto.pixel ?? null);
        document.title = dto.title || 'Landing';
        setState('ok');
      } catch {
        if (active) setState('notfound');
      }
    })();
    return () => {
      active = false;
    };
  }, [tenant, slug]);

  // Injeta o Pixel Meta e dispara PageView (client-side). Só se a landing tem pixel.
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

  return (
    <div
      className="flex min-h-screen w-full justify-center"
      style={{ background: theme.bgEnd ?? '#0A0A0B' }}
      onClickCapture={onCtaClick}
    >
      <div className="relative w-full max-w-[460px] shadow-2xl">
        <BlockRenderer blocks={blocks} property={property} theme={theme} onSubmitLead={onSubmitLead} />
      </div>
    </div>
  );
}
