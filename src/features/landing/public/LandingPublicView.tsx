import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  BlockRenderer,
  safeParsePageBlocks,
  type BlockInstance,
  type LandingProperty,
  type LandingTheme,
  type LeadSubmitPayload,
} from '@/features/landing/blocks';
import { loadLanding, type LandingPixel, type PublicLandingDTO } from './landingLoader';

/**
 * A landing de anúncio pública, já com tenant e slug resolvidos. Quem resolve
 * é quem monta: a entrada enxuta (`lp.html`, sem roteador) lê do caminho; a
 * rota antiga do CRM lê do `useParams`. A VIEW não conhece roteador nenhum —
 * é isso que permite o HTML enxuto não carregar o react-router.
 */
export interface LandingPublicViewProps {
  tenant: string;
  slug: string;
}

function toProperty(p: PublicLandingDTO['property']): LandingProperty | null {
  if (!p) return null;
  return {
    code: p.code,
    title: p.title,
    description: p.description,
    stage: p.stage as LandingProperty['stage'],
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
      heroUrl: ph.hero_url ?? undefined,
      caption: ph.caption ?? undefined,
      alt: ph.alt_text ?? undefined,
      isCover: ph.is_cover,
    })),
  };
}

/** Public, no-auth view of a published ad landing. Hosted by Leal Mídia
 *  (no client domain needed). NOINDEX. Tenant comes from the URL. */
export function LandingPublicView({ tenant, slug }: LandingPublicViewProps) {
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [blocks, setBlocks] = useState<BlockInstance[]>([]);
  const [theme, setTheme] = useState<Partial<LandingTheme>>({});
  const [property, setProperty] = useState<LandingProperty | null>(null);
  const [pixel, setPixel] = useState<LandingPixel | null>(null);

  // Eventos padrão da Meta vão em `track`; o resto é evento personalizado e vai
  // em `trackCustom` — mandar um pelo caminho do outro faz a Meta descartar.
  const META_STANDARD_EVENTS = [
    'PageView', 'Lead', 'Contact', 'Schedule', 'Purchase', 'CompleteRegistration',
    'SubmitApplication', 'ViewContent', 'Search', 'AddToCart', 'InitiateCheckout',
  ];

  // Dispara um evento no Pixel Meta (se carregado). O `eventID` é o MESMO que
  // vai para o servidor na captura: é ele que faz a Meta juntar os dois envios e
  // contar uma conversão só.
  const trackPixel = (event: string, eventId?: string) => {
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (!fbq || !event) return;
    const method = META_STANDARD_EVENTS.includes(event) ? 'track' : 'trackCustom';
    fbq(method, event, {}, eventId ? { eventID: eventId } : undefined);
  };

  // Identificador do envio, gerado uma vez e mandado junto do lead. `randomUUID`
  // não existe em contexto sem HTTPS nem em navegador antigo — e sem ele o
  // evento sairia sem par, que é o mesmo lead contado duas vezes.
  const newEventId = () => {
    const c = window.crypto as Crypto | undefined;
    if (c?.randomUUID) return `lp-${c.randomUUID()}`;
    return `lp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
    if (!tenant || !slug) return { failed: true };
    const base = import.meta.env.VITE_API_URL as string;
    const params = new URLSearchParams(window.location.search);
    const eventId = newEventId();
    let res: Response;
    try {
      res = await fetch(`${base}/api/public/v1/landing/${encodeURIComponent(slug)}/leads`, {
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
              // Quem chega pelo anúncio com cookie bloqueado ainda carrega o
              // clique no endereço — é a última chance de atribuição.
              fbclid: params.get('fbclid') ?? null,
              // O servidor manda a conversão com ESTE identificador, o mesmo dos
              // eventos abaixo: sem ele, o mesmo lead contaria duas vezes.
              event_id: eventId,
              referrer: document.referrer || null,
              landing_url: window.location.href,
            },
          },
        }),
      });
    } catch {
      // Rede caiu: o lead NÃO foi gravado. Devolver falha faz o formulário
      // mostrar erro e oferecer tentar de novo — antes ele agradecia igual, e
      // o lead pago sumia sem ninguém saber.
      return { failed: true };
    }
    if (!res.ok) return { failed: true };

    // Retorna a qualificação computada no backend pra a tela final ramificar.
    try {
      const json = (await res.json()) as { data?: { qualification?: 'qualified' | 'disqualified' } };
      const qualification = json?.data?.qualification;
      // Eventos de conversão no Pixel. Os nomes vêm do servidor — é ele quem
      // sabe o que o gestor escolheu, e é ele que manda os mesmos pela API de
      // Conversões com estes identificadores.
      const ev = pixel?.events ?? {};
      if (pixel?.pixel_id) {
        if (ev.submit) trackPixel(ev.submit, eventId);
        if (qualification === 'qualified' && ev.qualified) trackPixel(ev.qualified, `${eventId}-qualified`);
        if (qualification === 'disqualified' && ev.disqualified) {
          trackPixel(ev.disqualified, `${eventId}-disqualified`);
        }
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
      // O lead FOI gravado (a resposta veio ok); só não deu pra ler o corpo.
      // Segue pra tela de agradecimento — recusar aqui pediria um segundo
      // cadastro de quem já está no CRM.
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
      // Usa a resposta que o lp.html já pediu, quando ela existe (ver landingLoader).
      const dto = await loadLanding({ tenant, slug, base: import.meta.env.VITE_API_URL as string });
      if (!active) return;
      if (!dto) {
        setState('notfound');
        return;
      }
      setBlocks(safeParsePageBlocks(dto.content_blocks));
      setTheme((dto.theme ?? {}) as Partial<LandingTheme>);
      setProperty(toProperty(dto.property));
      setPixel(dto.pixel ?? null);
      document.title = dto.title || 'Landing';
      setState('ok');
    })();
    return () => {
      active = false;
    };
  }, [tenant, slug]);

  // Injeta o Pixel Meta e dispara PageView (client-side). Só se a landing tem pixel.
  useEffect(() => {
    const id = pixel?.pixel_id;
    if (!id) return;
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-expressions, prefer-spread -- trecho oficial do Pixel da Meta, mantido como ela publica */
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
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-expressions, prefer-spread */
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

export default LandingPublicView;
