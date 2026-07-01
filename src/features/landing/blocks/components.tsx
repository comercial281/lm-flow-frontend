import { useMemo, useState } from 'react';
import {
  Bath,
  BedDouble,
  BadgeCheck,
  Building2,
  Car,
  Check,
  MapPin,
  Mic,
  Ruler,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import type { BlockType } from './contract';
import {
  type BlockComponentProps,
  type LandingProperty,
  STAGE_LABELS,
  formatBRL,
} from './render-types';

/* ------------------------------------------------------------------ */
/* Shared bits                                                        */
/* ------------------------------------------------------------------ */

function Section({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`w-full px-5 py-7 ${className}`}
      style={{ background: 'var(--lp-block-bg)', color: 'var(--lp-text)' }}
    >
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-lg font-semibold tracking-tight" style={{ color: 'var(--lp-text)' }}>
      {children}
    </h2>
  );
}

const empty = (v: unknown) => v == null || v === '';

/* ------------------------------------------------------------------ */
/* Blocks                                                             */
/* ------------------------------------------------------------------ */

function HeroBlock({ config, property }: BlockComponentProps<'hero'>) {
  const cover = property?.photos?.find((p) => p.isCover) ?? property?.photos?.[0];
  const img = config.imageUrl ?? cover?.url;
  const badge =
    config.badge ?? (property?.stage ? STAGE_LABELS[property.stage] : undefined);
  const headline = config.headline ?? property?.title ?? 'Empreendimento';
  const location =
    config.subheadline ??
    property?.fullAddress ??
    [property?.neighborhood, property?.city, property?.state].filter(Boolean).join(' · ');

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: 260 }}>
      {img ? (
        <img src={img} alt={headline} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: 'var(--lp-bg-end)' }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
      <div className="relative flex h-full min-h-[260px] flex-col justify-end p-5">
        {badge && (
          <span
            className="mb-2 w-fit rounded-full px-3 py-1 text-[11px] font-bold tracking-wide text-white"
            style={{ background: 'var(--lp-primary)' }}
          >
            {badge}
          </span>
        )}
        <h1 className="text-2xl font-bold leading-tight text-white">{headline}</h1>
        {location && (
          <p className="mt-1 flex items-center gap-1 text-sm text-white/80">
            <MapPin size={14} /> {location}
          </p>
        )}
      </div>
    </div>
  );
}

function PriceBandBlock({ config, property }: BlockComponentProps<'price_band'>) {
  const text = config.text ?? (property?.salePrice ? formatBRL(property.salePrice) : property?.displayPrice);
  if (empty(text)) return null;
  return (
    <div
      className="w-full px-5 py-4 text-center text-base font-bold text-white"
      style={{ background: 'var(--lp-primary)' }}
    >
      {text}
    </div>
  );
}

const TECH_META: Record<string, { label: string; icon: React.ReactNode }> = {
  bedrooms: { label: 'Dormitórios', icon: <BedDouble size={18} /> },
  bathrooms: { label: 'Banheiros', icon: <Bath size={18} /> },
  suites: { label: 'Suítes', icon: <BedDouble size={18} /> },
  parking_spaces: { label: 'Vagas', icon: <Car size={18} /> },
  useful_area_m2: { label: 'Área útil', icon: <Ruler size={18} /> },
  total_area_m2: { label: 'Área total', icon: <Ruler size={18} /> },
  delivery: { label: 'Entrega', icon: <Check size={18} /> },
  units: { label: 'Unidades', icon: <Building2 size={18} /> },
  stage: { label: 'Status', icon: <Check size={18} /> },
};

function techValue(field: string, property?: LandingProperty | null): string | undefined {
  if (!property) return undefined;
  switch (field) {
    case 'bedrooms':
      return property.bedrooms != null ? String(property.bedrooms) : undefined;
    case 'bathrooms':
      return property.bathrooms != null ? String(property.bathrooms) : undefined;
    case 'suites':
      return property.suites != null ? String(property.suites) : undefined;
    case 'parking_spaces':
      return property.parkingSpaces != null ? String(property.parkingSpaces) : undefined;
    case 'useful_area_m2':
      return property.usefulAreaM2 != null ? `${property.usefulAreaM2} m²` : undefined;
    case 'total_area_m2':
      return property.totalAreaM2 != null ? `${property.totalAreaM2} m²` : undefined;
    case 'stage':
      return property.stage ? STAGE_LABELS[property.stage] : undefined;
    default:
      return undefined;
  }
}

function TechSheetBlock({ config, property }: BlockComponentProps<'tech_sheet'>) {
  const items = config.fields
    .map((f) => ({ field: f, meta: TECH_META[f], value: techValue(f, property) }))
    .filter((i) => i.meta && !empty(i.value));
  if (!items.length) return null;
  return (
    <Section>
      <SectionTitle>Ficha Técnica</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {items.map((i) => (
          <div
            key={i.field}
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: 'var(--lp-card)' }}
          >
            <span style={{ color: 'var(--lp-icon)' }}>{i.meta.icon}</span>
            <div>
              <div className="text-xs opacity-70">{i.meta.label}</div>
              <div className="text-sm font-semibold">{i.value}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function DescriptionBlock({ config, property }: BlockComponentProps<'description'>) {
  const html = config.html ?? property?.description;
  if (empty(html)) return null;
  return (
    <Section>
      <SectionTitle>{config.title}</SectionTitle>
      <div
        className="text-sm leading-relaxed opacity-90"
        // content is authored by the client/team, rendered as rich text
        dangerouslySetInnerHTML={{ __html: html as string }}
      />
    </Section>
  );
}

function AmenitiesBlock({ config }: BlockComponentProps<'amenities'>) {
  if (!config.items.length) return null;
  return (
    <Section>
      <SectionTitle>{config.title}</SectionTitle>
      <ul className="grid grid-cols-2 gap-y-2 text-sm">
        {config.items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <Check size={16} style={{ color: 'var(--lp-icon)' }} /> {item}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function GalleryBlock({ config, property }: BlockComponentProps<'gallery'>) {
  const photos = useMemo(() => {
    const all = property?.photos ?? [];
    if (!config.photoIds.length) return all;
    const byId = new Map(all.map((p, i) => [String(i), p] as const));
    return config.photoIds.map((id) => byId.get(id)).filter(Boolean) as typeof all;
  }, [property?.photos, config.photoIds]);
  if (!photos.length) return null;
  return (
    <Section>
      <SectionTitle>Galeria</SectionTitle>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2">
        {photos.map((p, i) => (
          <img
            key={i}
            src={p.thumbnailUrl ?? p.url}
            alt={p.alt ?? `Foto ${i + 1}`}
            className="h-40 w-60 flex-none snap-start rounded-xl object-cover"
          />
        ))}
      </div>
    </Section>
  );
}

function MapBlock({ config, property }: BlockComponentProps<'map'>) {
  const address = property?.fullAddress ?? [property?.neighborhood, property?.city].filter(Boolean).join(', ');
  return (
    <Section>
      <SectionTitle>{config.title}</SectionTitle>
      {address && (
        <p className="mb-3 flex items-center gap-1 text-sm opacity-80">
          <MapPin size={14} style={{ color: 'var(--lp-icon)' }} /> {address}
        </p>
      )}
      {config.pois.length > 0 && (
        <ul className="space-y-2 text-sm">
          {config.pois.map((poi, i) => (
            <li key={i} className="flex items-center justify-between border-b border-[color:var(--lp-border)] pb-2">
              <span>{poi.label}</span>
              <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--lp-primary)', color: '#fff' }}>
                {poi.minutes} min
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function VideoBlock({ config }: BlockComponentProps<'video'>) {
  if (empty(config.url)) return null;
  return (
    <Section>
      {config.title && <SectionTitle>{config.title}</SectionTitle>}
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={config.url}
          title={config.title ?? 'Vídeo'}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </Section>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex justify-between text-sm">
        <span className="opacity-80">{label}</span>
        <span className="font-semibold">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-current"
        style={{ accentColor: 'var(--lp-accent)' }}
      />
    </div>
  );
}

function FinanceSimulatorBlock({ config, property }: BlockComponentProps<'finance_simulator'>) {
  const base = config.basePrice ?? property?.salePrice ?? 0;
  const [entradaPct, setEntradaPct] = useState(config.entradaPct);
  const [reforcoPct, setReforcoPct] = useState(config.reforcoPct);
  const [prazo, setPrazo] = useState(config.prazoMeses);

  const calc = useMemo(() => {
    const entrada = base * (entradaPct / 100);
    const reforcoTotal = base * (reforcoPct / 100);
    const reforco = config.reforcoQty > 0 ? reforcoTotal / config.reforcoQty : 0;
    const restante = base - entrada - reforcoTotal;
    const mensal = prazo > 0 ? restante / prazo : 0;
    return { entrada, reforco, mensal };
  }, [base, entradaPct, reforcoPct, prazo, config.reforcoQty]);

  return (
    <Section>
      <SectionTitle>Simulador de Financiamento</SectionTitle>
      <SliderRow label="Entrada" value={entradaPct} min={0} max={50} onChange={setEntradaPct} suffix="%" />
      <SliderRow label="Reforços" value={reforcoPct} min={0} max={50} onChange={setReforcoPct} suffix="%" />
      <SliderRow label="Prazo" value={prazo} min={12} max={240} onChange={setPrazo} suffix=" meses" />
      <div className="mt-4 space-y-2 rounded-xl p-4" style={{ background: 'var(--lp-card)' }}>
        <div className="flex justify-between text-sm">
          <span className="opacity-70">Entrada</span>
          <span className="font-semibold">{formatBRL(calc.entrada)}</span>
        </div>
        {config.reforcoQty > 0 && (
          <div className="flex justify-between text-sm">
            <span className="opacity-70">Reforços ({config.reforcoQty}x)</span>
            <span className="font-semibold">{formatBRL(calc.reforco)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-[color:var(--lp-border)] pt-2">
          <span className="opacity-70">Mensais ({prazo}x)</span>
          <span className="text-lg font-bold" style={{ color: 'var(--lp-accent)' }}>
            {formatBRL(calc.mensal)}
          </span>
        </div>
      </div>
    </Section>
  );
}

function ConstructionProgressBlock({ config }: BlockComponentProps<'construction_progress'>) {
  return (
    <Section>
      <SectionTitle>Progresso de Obra</SectionTitle>
      <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-[color:var(--lp-card)]">
        <div className="h-full rounded-full" style={{ width: `${config.percent}%`, background: 'var(--lp-primary)' }} />
      </div>
      <p className="mb-3 text-sm font-semibold">{config.percent}% concluído</p>
      {config.milestones.length > 0 && (
        <ul className="space-y-1 text-sm opacity-80">
          {config.milestones.map((m, i) => (
            <li key={i} className="flex justify-between">
              <span>{m.label}</span>
              {m.date && <span className="opacity-60">{m.date}</span>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ConsultantBlock({ config, property }: BlockComponentProps<'consultant'>) {
  const name = config.name ?? property?.responsibleName;
  if (empty(name)) return null;
  return (
    <Section>
      <div className="flex items-center gap-4">
        {config.photoUrl ? (
          <img src={config.photoUrl} alt={name} className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--lp-primary)' }}>
            <UserRound size={26} className="text-white" />
          </div>
        )}
        <div>
          <div className="font-semibold">{name}</div>
          {config.creci && <div className="text-xs opacity-70">CRECI {config.creci}</div>}
          {config.phone && <div className="text-sm opacity-90">{config.phone}</div>}
        </div>
      </div>
    </Section>
  );
}

function BrokerAudioBlock({ config }: BlockComponentProps<'broker_audio'>) {
  if (empty(config.audioUrl)) return null;
  return (
    <Section>
      <div className="flex items-center gap-3">
        <Mic size={20} style={{ color: 'var(--lp-icon)' }} />
        <div className="flex-1">
          {config.label && <div className="mb-1 text-sm opacity-80">{config.label}</div>}
          <audio controls src={config.audioUrl} className="w-full" />
        </div>
      </div>
    </Section>
  );
}

function ValuationHistoryBlock({ config }: BlockComponentProps<'valuation_history'>) {
  if (!config.points.length) return null;
  const max = Math.max(...config.points.map((p) => p.value));
  return (
    <Section>
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <TrendingUp size={18} style={{ color: 'var(--lp-icon)' }} /> {config.title}
        </span>
      </SectionTitle>
      <div className="flex items-end gap-2" style={{ height: 120 }}>
        {config.points.map((p, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <div
              className="w-full rounded-t"
              style={{ height: `${max ? (p.value / max) * 100 : 0}%`, background: 'var(--lp-primary)' }}
            />
            <span className="text-[10px] opacity-70">{p.label}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TrustBadgesBlock({ config }: BlockComponentProps<'trust_badges'>) {
  if (!config.items.length) return null;
  return (
    <Section>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {config.items.map((b, i) =>
          b.imageUrl ? (
            <img key={i} src={b.imageUrl} alt={b.label ?? 'Selo'} className="h-12 object-contain" />
          ) : (
            <span key={i} className="inline-flex items-center gap-1 text-sm">
              <BadgeCheck size={16} style={{ color: 'var(--lp-icon)' }} /> {b.label}
            </span>
          ),
        )}
      </div>
    </Section>
  );
}

function TrackRecordBlock({ config }: BlockComponentProps<'track_record'>) {
  if (!config.items.length) return null;
  return (
    <Section>
      <SectionTitle>{config.title}</SectionTitle>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {config.items.map((it, i) => (
          <div key={i} className="w-44 flex-none">
            {it.imageUrl && <img src={it.imageUrl} alt={it.title} className="mb-2 h-28 w-full rounded-lg object-cover" />}
            <div className="text-sm font-semibold">{it.title}</div>
            {it.year && <div className="text-xs opacity-60">{it.year}</div>}
          </div>
        ))}
      </div>
    </Section>
  );
}

function ApartmentTypesBlock({ config }: BlockComponentProps<'apartment_types'>) {
  if (!config.items.length) return null;
  return (
    <Section>
      <SectionTitle>{config.title}</SectionTitle>
      <div className="space-y-3">
        {config.items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--lp-card)' }}>
            {it.planUrl && <img src={it.planUrl} alt={it.name} className="h-16 w-16 rounded object-cover" />}
            <div className="flex-1">
              <div className="text-sm font-semibold">{it.name}</div>
              {it.areaM2 != null && <div className="text-xs opacity-70">{it.areaM2} m²</div>}
            </div>
            {it.price != null && <div className="text-sm font-bold" style={{ color: 'var(--lp-accent)' }}>{formatBRL(it.price)}</div>}
          </div>
        ))}
      </div>
    </Section>
  );
}

function LeadFormBlock({ config }: BlockComponentProps<'lead_form'>) {
  // Full multi-step quiz lands in LB-S6. Here: the entry card + CTA.
  return (
    <Section>
      <div className="rounded-2xl p-5 text-center" style={{ background: 'var(--lp-card)' }}>
        <h2 className="mb-3 text-lg font-bold">{config.title}</h2>
        <button
          type="button"
          data-lp-action="open_form"
          data-dynamic-form-id={config.dynamicFormId ?? ''}
          className="w-full rounded-xl px-5 py-3 font-semibold text-white"
          style={{ background: 'var(--lp-primary)' }}
        >
          {config.ctaLabel}
        </button>
      </div>
    </Section>
  );
}

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function StickyCtaBlock({ config }: BlockComponentProps<'sticky_cta'>) {
  return (
    <div className="pointer-events-none sticky bottom-0 z-20 w-full p-3">
      <button
        type="button"
        data-lp-action={config.action}
        data-whatsapp-phone={config.whatsappPhone ?? ''}
        className="pointer-events-auto flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 font-semibold text-white shadow-[0_8px_30px_rgba(22,163,74,0.5)]"
        style={{ background: '#16a34a' }}
      >
        <WhatsAppIcon size={20} /> {config.label}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Registry of components                                             */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BLOCK_COMPONENTS: Record<BlockType, React.ComponentType<BlockComponentProps<any>>> = {
  hero: HeroBlock,
  price_band: PriceBandBlock,
  tech_sheet: TechSheetBlock,
  description: DescriptionBlock,
  amenities: AmenitiesBlock,
  gallery: GalleryBlock,
  map: MapBlock,
  video: VideoBlock,
  finance_simulator: FinanceSimulatorBlock,
  construction_progress: ConstructionProgressBlock,
  consultant: ConsultantBlock,
  broker_audio: BrokerAudioBlock,
  valuation_history: ValuationHistoryBlock,
  trust_badges: TrustBadgesBlock,
  track_record: TrackRecordBlock,
  apartment_types: ApartmentTypesBlock,
  lead_form: LeadFormBlock,
  sticky_cta: StickyCtaBlock,
};
