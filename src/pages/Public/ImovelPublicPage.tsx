import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  BlockRenderer,
  defaultPropertyBlocks,
  safeParsePageBlocks,
  type BlockInstance,
  type LandingProperty,
  type LandingTheme,
  type LeadSubmitPayload,
} from '@/features/landing/blocks';

interface ImovelPropertyDTO {
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
}

interface ImovelDTO {
  template: unknown[];
  theme?: Partial<LandingTheme> | null;
  site?: { name?: string; seo_title?: string; seo_description?: string } | null;
  property: ImovelPropertyDTO;
}

function toProperty(p: ImovelPropertyDTO): LandingProperty {
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

function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
  return el;
}

/** Página pública INDEXÁVEL de um imóvel do portal (Produto A). Renderiza o
 *  template único do site + os dados do imóvel. Ao contrário da landing de
 *  anúncio, esta página é feita para ranquear no Google. */
export default function ImovelPublicPage() {
  const { tenant, code } = useParams<{ tenant: string; code: string }>();
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [blocks, setBlocks] = useState<BlockInstance[]>([]);
  const [theme, setTheme] = useState<Partial<LandingTheme>>({});
  const [property, setProperty] = useState<LandingProperty | null>(null);
  const cookie = (name: string) =>
    document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.split('=')[1];

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

  // Lead de interesse no imóvel → mesmo endpoint público de lead do site.
  const onSubmitLead = async (payload: LeadSubmitPayload) => {
    if (!tenant || !code) return;
    const base = import.meta.env.VITE_API_URL as string;
    const params = new URLSearchParams(window.location.search);
    await fetch(`${base}/api/public/v1/site/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant': tenant },
      body: JSON.stringify({
        lead: {
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          source: 'portal',
          form_type: 'imovel',
          property_code: code,
          utm_source: params.get('utm_source') ?? undefined,
          utm_medium: params.get('utm_medium') ?? undefined,
          utm_campaign: params.get('utm_campaign') ?? undefined,
          message: `Interesse no imóvel ${code}`,
          form_data: {
            answers: payload.answers,
            fbp: cookie('_fbp') ?? null,
            fbc: cookie('_fbc') ?? null,
            referrer: document.referrer || null,
            page_url: window.location.href,
          },
        },
      }),
    });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      if (!tenant || !code) return;
      try {
        const base = import.meta.env.VITE_API_URL as string;
        const res = await fetch(`${base}/api/public/v1/site/imovel/${encodeURIComponent(code)}`, {
          headers: { 'X-Tenant': tenant },
        });
        if (!res.ok) {
          if (active) setState('notfound');
          return;
        }
        const json = (await res.json()) as { data: ImovelDTO };
        const dto = json.data;
        if (!active) return;
        // Site sem template customizado -> renderiza o template padrão do portal.
        const parsed = safeParsePageBlocks(dto.template);
        setBlocks(parsed.length ? parsed : defaultPropertyBlocks());
        setTheme(dto.theme ?? {});
        setProperty(toProperty(dto.property));

        // SEO: título/descrição por imóvel + canonical. Indexável.
        const siteName = dto.site?.name ?? 'Imóveis';
        document.title = `${dto.property.title} · ${siteName}`;
        const desc = (dto.property.description || dto.site?.seo_description || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160);
        if (desc) setMeta('description', desc);
        const robots = setMeta('robots', 'index,follow');
        setState('ok');
        return () => {
          robots.content = 'index,follow';
        };
      } catch {
        if (active) setState('notfound');
      }
    })();
    return () => {
      active = false;
    };
  }, [tenant, code]);

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400">Carregando…</div>;
  }
  if (state === 'notfound') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500">
        Imóvel não encontrado.
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen w-full justify-center"
      style={{ background: theme.bgEnd ?? '#FFFFFF' }}
      onClickCapture={onCtaClick}
    >
      <div className="relative w-full max-w-[460px] shadow-2xl">
        <BlockRenderer blocks={blocks} property={property} theme={theme} onSubmitLead={onSubmitLead} />
      </div>
    </div>
  );
}
