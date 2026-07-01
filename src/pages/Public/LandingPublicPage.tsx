import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  BlockRenderer,
  safeParsePageBlocks,
  type BlockInstance,
  type LandingProperty,
  type LandingTheme,
} from '@/features/landing/blocks';

interface PublicLandingDTO {
  title: string;
  theme?: Partial<LandingTheme> | null;
  content_blocks: unknown[];
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
  const [modalOpen, setModalOpen] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const cookie = (name: string) =>
    document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.split('=')[1];

  const onCtaClick = (e: ReactMouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-lp-action]') as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    const action = el.getAttribute('data-lp-action');
    const wa = el.getAttribute('data-whatsapp-phone');
    if (action === 'whatsapp' && wa) {
      window.open(`https://wa.me/${wa.replace(/\D/g, '')}`, '_blank');
      return;
    }
    setModalOpen(true);
  };

  const submitLead = async () => {
    if (!tenant || !slug || !leadName.trim() || !leadPhone.trim()) return;
    setSending(true);
    try {
      const base = import.meta.env.VITE_API_URL as string;
      const params = new URLSearchParams(window.location.search);
      const res = await fetch(`${base}/api/public/v1/landing/${encodeURIComponent(slug)}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant': tenant },
        body: JSON.stringify({
          lead: {
            name: leadName.trim(),
            phone: leadPhone.trim(),
            source: 'landing',
            utm_source: params.get('utm_source') ?? undefined,
            utm_medium: params.get('utm_medium') ?? undefined,
            utm_campaign: params.get('utm_campaign') ?? undefined,
            utm_term: params.get('utm_term') ?? undefined,
            utm_content: params.get('utm_content') ?? undefined,
            form_data: {
              fbp: cookie('_fbp') ?? null,
              fbc: cookie('_fbc') ?? null,
              referrer: document.referrer || null,
              landing_url: window.location.href,
            },
          },
        }),
      });
      if (res.ok) setSent(true);
    } finally {
      setSending(false);
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
        <BlockRenderer blocks={blocks} property={property} theme={theme} />
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-neutral-900 p-5 text-neutral-100">
            {sent ? (
              <div className="space-y-3 text-center">
                <p className="text-lg font-bold">Recebemos seus dados! ✅</p>
                <p className="text-sm text-neutral-400">Um especialista vai te chamar em breve.</p>
                <button type="button" onClick={() => setModalOpen(false)}
                  className="w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white">Fechar</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-bold">Fale com um especialista</h2>
                  <button type="button" aria-label="Fechar" onClick={() => setModalOpen(false)} className="text-neutral-400">✕</button>
                </div>
                <input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Seu nome"
                  className="w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
                <input value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="Seu WhatsApp" inputMode="tel"
                  className="w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
                <button type="button" onClick={submitLead} disabled={sending || !leadName.trim() || !leadPhone.trim()}
                  className="w-full rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white disabled:opacity-40">
                  {sending ? 'Enviando…' : 'Quero falar com especialista'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
