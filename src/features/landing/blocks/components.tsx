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
import { BrPhoneInput } from '@/components/shared';
import { isValidBrPhone } from '@/lib/brPhone';
import type { BlockType } from './contract';
import {
  type BlockComponentProps,
  type LandingPhoto,
  type LandingProperty,
  STAGE_LABELS,
  fillTemplate as fill,
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
      className={`w-full ${className}`}
      style={{
        background: 'var(--lp-block-bg)',
        color: 'var(--lp-text)',
        // O espaçamento é escolhido seção a seção e chega como variável, posta
        // no envelope pelo BlockRenderer. Sem escolha, cai no padrão que a
        // página sempre usou (o antigo px-5 py-7).
        paddingTop: 'var(--lp-pad-top, 1.75rem)',
        paddingBottom: 'var(--lp-pad-bottom, 1.75rem)',
        paddingLeft: 'var(--lp-pad-x, 1.25rem)',
        paddingRight: 'var(--lp-pad-x, 1.25rem)',
      }}
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
    // A capa é sangrada de ponta a ponta, então o espaçamento escolhido para
    // ela vira MARGEM (e não recuo interno, como nas outras seções): recuo aqui
    // deixaria uma faixa de fundo por cima da foto. Sem escolha, zero — que é
    // exatamente como a capa sempre foi.
    <div
      className="relative w-full overflow-hidden"
      style={{
        minHeight: 260,
        marginTop: 'var(--lp-pad-top, 0px)',
        marginBottom: 'var(--lp-pad-bottom, 0px)',
      }}
    >
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
        {/* Só aparece com texto escrito. O campo já existia na configuração e
            não tinha botão nenhum atrás: quem preenchesse não via nada mudar.
            Vazio = a capa continua exatamente como sempre foi. */}
        {config.ctaLabel && (
          <button
            type="button"
            data-lp-action="open_form"
            className="mt-3 w-fit rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: 'var(--lp-primary)' }}
          >
            {config.ctaLabel}
          </button>
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
      <SectionTitle>{config.title}</SectionTitle>
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

/** Texto livre escrito pela equipe da imobiliária. Publica o HTML pelo mesmo
 *  caminho da seção de Descrição, que já faz isso desde a estreia: o conteúdo é
 *  escrito por quem administra a conta, nunca pelo visitante da landing.
 *
 *  A regra de lista vai inline porque o reset do Tailwind tira marcador e recuo
 *  de `ul`/`ol`: sem isto a lista que a pessoa monta no editor sai como um
 *  bloco de linhas soltas na página publicada. */
function RichTextBlock({ config }: BlockComponentProps<'rich_text'>) {
  const html = config.html?.trim();
  if (!config.title && !html) return null;
  return (
    <Section>
      {config.title && <SectionTitle>{config.title}</SectionTitle>}
      {html && (
        <>
          <style>{`.lp-rich-text ul,.lp-rich-text ol{padding-left:1.25rem;margin:.5rem 0}.lp-rich-text ul{list-style:disc}.lp-rich-text ol{list-style:decimal}.lp-rich-text p{margin:.5rem 0}.lp-rich-text a{text-decoration:underline;color:var(--lp-accent)}`}</style>
          <div
            className="lp-rich-text text-sm leading-relaxed opacity-90"
            style={{ textAlign: config.align }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </>
      )}
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
  // Duas origens: as fotos publicadas do imóvel (como sempre foi) e as fotos
  // enviadas aqui mesmo. A segunda existe porque landing de imóvel que não está
  // cadastrado não tem foto nenhuma pra puxar, e a seção sumia da página.
  const photos = useMemo<LandingPhoto[]>(() => {
    if (config.source === 'manual') {
      return (config.images ?? []).map((img) => ({ url: img.url, alt: img.caption, caption: img.caption }));
    }
    const all = property?.photos ?? [];
    if (!config.photoIds.length) return all;
    const byId = new Map(all.map((p, i) => [String(i), p] as const));
    return config.photoIds.map((id) => byId.get(id)).filter(Boolean) as typeof all;
  }, [property?.photos, config.photoIds, config.source, config.images]);
  if (!photos.length) return null;
  return (
    <Section>
      <SectionTitle>{config.title}</SectionTitle>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2">
        {photos.map((p, i) => (
          <figure key={i} className="flex-none snap-start">
            <img
              src={p.thumbnailUrl ?? p.url}
              alt={p.alt ?? `Foto ${i + 1}`}
              className="h-40 w-60 rounded-xl object-cover"
            />
            {p.caption && <figcaption className="mt-1 w-60 text-xs opacity-70">{p.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </Section>
  );
}

function MapBlock({ config, property }: BlockComponentProps<'map'>) {
  // O que o lead LÊ. Digitado no editor, ou o endereço do imóvel vinculado.
  const address =
    config.address?.trim() ||
    property?.fullAddress ||
    [property?.neighborhood, property?.city].filter(Boolean).join(', ');

  // O que o MAPA procura. É outra coisa, de propósito: a região, nunca a rua com
  // número — a página de imóvel do site também mostra só a região, para não
  // entregar o endereço exato a quem só viu o anúncio. Por isso o campo de cima
  // jamais é usado aqui, mesmo quando é o único preenchido.
  const region =
    config.region?.trim() ||
    [property?.neighborhood, property?.city, property?.state].filter(Boolean).join(', ');
  const mapQuery = region ? encodeURIComponent(region) : null;

  return (
    <Section>
      <SectionTitle>{config.title}</SectionTitle>
      {address && (
        <p className="mb-3 flex items-center gap-1 text-sm opacity-80">
          <MapPin size={14} style={{ color: 'var(--lp-icon)' }} /> {address}
        </p>
      )}
      {config.showMap && mapQuery && (
        <div className="mb-3 overflow-hidden rounded-xl" style={{ border: '1px solid var(--lp-border)' }}>
          <iframe
            title="Mapa da região"
            width="100%"
            height="220"
            loading="lazy"
            style={{ border: 0, display: 'block' }}
            src={`https://www.google.com/maps?q=${mapQuery}&z=14&output=embed`}
          />
        </div>
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

  const chavesPct = config.chavesPct;
  const mensaisPct = Math.max(0, 100 - entradaPct - reforcoPct - chavesPct);
  const segs = [
    { label: config.entradaLabel, pct: entradaPct, color: '#16A34A' },
    { label: config.mensaisLabel, pct: mensaisPct, color: '#0EA5E9' },
    { label: config.reforcosLabel, pct: reforcoPct, color: '#F59E0B' },
    { label: config.chavesLabel, pct: chavesPct, color: '#94A3B8' },
  ];

  return (
    <Section>
      <SectionTitle>{config.title}</SectionTitle>
      {config.subtitle && <p className="-mt-3 mb-3 text-xs opacity-60">{config.subtitle}</p>}

      {/* barra segmentada */}
      <div className="mb-2 flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--lp-card)' }}>
        {segs.map((s) => (s.pct > 0 ? <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} /> : null))}
      </div>
      <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {segs.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1 opacity-80">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label} ({Math.round(s.pct)}%)
          </span>
        ))}
      </div>

      <SliderRow label={config.entradaLabel} value={entradaPct} min={0} max={50} onChange={setEntradaPct} suffix="%" />
      <SliderRow label={config.reforcosLabel} value={reforcoPct} min={0} max={50} onChange={setReforcoPct} suffix="%" />
      <SliderRow label={config.prazoLabel} value={prazo} min={12} max={240} onChange={setPrazo} suffix=" meses" />
      <div className="mt-4 space-y-2 rounded-xl p-4" style={{ background: 'var(--lp-card)' }}>
        <div className="flex justify-between text-sm">
          <span className="opacity-70">{config.entradaLabel}</span>
          <span className="font-semibold">{formatBRL(calc.entrada)}</span>
        </div>
        {config.reforcoQty > 0 && (
          <div className="flex justify-between text-sm">
            <span className="opacity-70">{config.reforcosLabel} ({config.reforcoQty}x)</span>
            <span className="font-semibold">{formatBRL(calc.reforco)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-[color:var(--lp-border)] pt-2">
          <span className="opacity-70">{config.mensaisLabel} ({prazo}x)</span>
          <span className="text-lg font-bold" style={{ color: 'var(--lp-accent)' }}>
            {formatBRL(calc.mensal)}
          </span>
        </div>
      </div>
      {config.footnote && <p className="mt-2 text-[10px] opacity-50">{config.footnote}</p>}
    </Section>
  );
}

function ConstructionProgressBlock({ config }: BlockComponentProps<'construction_progress'>) {
  return (
    <Section>
      <SectionTitle>{config.title}</SectionTitle>
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
  // Waveform decorativa (alturas determinísticas por índice).
  const bars = Array.from({ length: 40 }, (_, i) => 20 + ((i * 37) % 80));
  return (
    <Section>
      <div className="rounded-2xl p-4" style={{ background: 'var(--lp-card)' }}>
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full" style={{ background: 'var(--lp-primary)' }}>
            <Mic size={16} className="text-white" />
          </div>
          <div className="text-sm font-semibold">{config.label || 'Explicação do Plano de Pagamento'}</div>
        </div>
        <div className="mb-2 flex h-8 items-center gap-[2px]">
          {bars.map((h, i) => (
            <span key={i} className="flex-1 rounded-full" style={{ height: `${h}%`, background: 'var(--lp-icon)', opacity: 0.55 }} />
          ))}
        </div>
        <audio controls src={config.audioUrl} className="w-full" />
      </div>
    </Section>
  );
}

function ValuationHistoryBlock({ config }: BlockComponentProps<'valuation_history'>) {
  if (config.points.length < 2) return null;
  const W = 300;
  const H = 110;
  const pad = 10;
  const values = config.points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const n = config.points.length;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (n - 1);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const line = config.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  return (
    <Section>
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <TrendingUp size={18} style={{ color: 'var(--lp-icon)' }} /> {config.title}
        </span>
      </SectionTitle>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }}>
        <path d={area} fill="var(--lp-accent)" opacity={0.12} />
        <path d={line} fill="none" stroke="var(--lp-accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {config.points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={3} fill="var(--lp-accent)" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] opacity-60">
        {config.points.map((p, i) => <span key={i}>{p.label}</span>)}
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

function Confetti() {
  const pieces = Array.from({ length: 26 }, (_, i) => i);
  const colors = ['#16A34A', '#22C55E', '#EAB308', '#3B82F6', '#EF4444'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`@keyframes lpfall{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(360px) rotate(360deg);opacity:0}}`}</style>
      {pieces.map((i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${(i * 37) % 100}%`,
            top: '-10px',
            width: 8,
            height: 8,
            background: colors[i % colors.length],
            borderRadius: i % 2 ? '50%' : '2px',
            animation: `lpfall ${1.6 + (i % 5) * 0.25}s ease-in ${(i % 7) * 0.12}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

function LeadFormBlock({ config, property, onSubmitLead }: BlockComponentProps<'lead_form'>) {
  const specialist = config.specialistName || property?.responsibleName || 'nosso especialista';
  const steps = config.steps;
  // `path` é o caminho REALMENTE percorrido (índices das perguntas), não um
  // contador: com desvio, a pergunta 1 pode levar direto à 4. Voltar é
  // desempilhar daqui — só assim o "← Voltar" devolve a pergunta que a pessoa
  // viu, e não a de cima na lista.
  const [path, setPath] = useState<number[]>(steps.length ? [0] : []);
  const [onContact, setOnContact] = useState(steps.length === 0);
  const [forcedScreen, setForcedScreen] = useState<'thankyou' | 'disqualified' | null>(null);
  const [answers, setAnswers] = useState<
    { question: string; answer: string; questionId: string; optionId: string }[]
  >([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState(false);
  const [done, setDone] = useState(false);
  const [resultQual, setResultQual] = useState<string | undefined>();

  const currentIndex = path.length ? path[path.length - 1] : -1;
  const currentStep = !onContact && currentIndex >= 0 ? steps[currentIndex] : undefined;

  // Com desvio configurado, "Passo 3 de 5" seria mentira: caminhos diferentes
  // têm tamanhos diferentes. Sem desvio nenhum, o contador continua como era.
  const hasBranching = useMemo(
    () => steps.some((s) => s.options.some((o) => o.next && o.next.kind !== 'next')),
    [steps],
  );
  const totalSteps = steps.length + 1; // quiz + contato
  const progress = done || onContact ? 100 : (path.length / totalSteps) * 100;

  const finish = (screen: 'thankyou' | 'disqualified') => {
    setForcedScreen(screen);
    setOnContact(true);
  };

  const pickOption = (
    step: (typeof steps)[number],
    option: (typeof steps)[number]['options'][number],
  ) => {
    setAnswers((prev) => [
      ...prev.filter((a) => a.questionId !== step.id),
      { question: step.question, answer: option.text, questionId: step.id, optionId: option.id },
    ]);

    const next = option.next ?? { kind: 'next' as const };
    if (next.kind === 'contact') return setOnContact(true);
    if (next.kind === 'finish') return finish(next.screen);

    let targetIndex = currentIndex + 1;
    if (next.kind === 'question') {
      const found = steps.findIndex((s) => s.id === next.id);
      // Só desvio PARA FRENTE. Salto pra pergunta anterior (ou pra uma que foi
      // apagada) prenderia o lead num laço — cai no "próxima".
      targetIndex = found > currentIndex ? found : currentIndex + 1;
    }
    if (targetIndex >= steps.length) return setOnContact(true);
    setPath((prev) => [...prev, targetIndex]);
  };

  const back = () => {
    if (onContact) {
      setOnContact(false);
      setForcedScreen(null);
      if (!path.length && steps.length) setPath([0]);
      return;
    }
    setPath((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const canGoBack = onContact ? steps.length > 0 : path.length > 1;

  const submit = async () => {
    if (!name.trim()) return;
    if (!isValidBrPhone(phone)) { setPhoneErr(true); return; }
    setSending(true);
    setSendErr(false);
    try {
      const res = await onSubmitLead?.({ name: name.trim(), phone, email: email.trim() || undefined, answers });
      // Falha de envio NÃO pode virar tela de agradecimento: o lead de anúncio
      // se perdia em silêncio, sem erro e sem chance de tentar de novo.
      if (res?.failed) {
        setSendErr(true);
        return;
      }
      setResultQual(forcedScreen === 'disqualified' ? 'disqualified' : res?.qualification);
      setDone(true);
    } catch {
      setSendErr(true);
    } finally {
      setSending(false);
    }
  };

  const whatsappPhone = (config.whatsappPhone ?? '').replace(/\D/g, '');

  return (
    <Section>
      <div id="lp-lead-form" className="scroll-mt-4 rounded-2xl border p-5"
        style={{ background: 'var(--lp-block-bg)', borderColor: 'var(--lp-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
        {done ? (
          <div className="relative py-2 text-center">
            {resultQual !== 'disqualified' && <Confetti />}
            <div className="relative">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#16A34A' }}>
                <Check size={30} className="text-white" />
              </div>
              {resultQual === 'disqualified' ? (
                <>
                  <h2 className="text-xl font-bold">{config.disqualifiedTitle}</h2>
                  <p className="mx-auto mt-1 max-w-xs text-sm opacity-70">
                    {fill(config.disqualifiedMessage, { especialista: specialist })}
                  </p>
                </>
              ) : (
                <>
                  {/* Estes dois vinham escritos por dentro e ignoravam o que
                      estava gravado: o campo existia no editor, a pessoa
                      preenchia, salvava, e a landing mostrava outra coisa. */}
                  <h2 className="text-xl font-bold">{config.thankyouTitle}</h2>
                  <p className="mx-auto mt-1 max-w-xs text-sm opacity-70">
                    {fill(config.thankyouMessage, { especialista: specialist })}
                    {config.interestedLabel
                      ? ` ${fill(config.interestedLabel, { n: config.interestedCount })}`
                      : ''}
                  </p>
                  {/* Só aparece com número: sem ele o botão não abria conversa
                      nenhuma e era o mais chamativo da tela. */}
                  {whatsappPhone && (
                    <button type="button" data-lp-action="whatsapp" data-whatsapp-phone={whatsappPhone}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold text-white"
                      style={{ background: '#16A34A' }}>
                      <WhatsAppIcon size={18} /> {config.whatsappLabel}
                    </button>
                  )}
                </>
              )}
              <div className="mt-5 flex items-center gap-3 rounded-xl border p-3 text-left" style={{ borderColor: 'var(--lp-border)' }}>
                {property?.responsibleName || config.specialistName ? (
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full" style={{ background: 'var(--lp-card)' }}>
                    <UserRound size={22} style={{ color: 'var(--lp-icon)' }} />
                  </div>
                ) : null}
                <div className="flex-1">
                  <div className="text-sm font-semibold">{specialist}</div>
                  <div className="text-xs opacity-60">{config.specialistRole}</div>
                  <div className="mt-1 inline-flex items-center gap-1 text-xs" style={{ color: '#16A34A' }}>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#16A34A' }} /> {config.specialistStatus}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-base font-bold leading-snug">
              {config.title} {specialist !== 'nosso especialista' ? specialist : ''}
            </h2>
            {config.subtitle && <p className="mt-1 text-xs opacity-60">{config.subtitle}</p>}
            <div className="mt-3 mb-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--lp-card)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%`, background: 'var(--lp-text)' }} />
              </div>
              {!hasBranching && config.stepCounterLabel && (
                <span className="text-xs opacity-60">
                  {fill(config.stepCounterLabel, {
                    atual: Math.min(onContact ? totalSteps : path.length, totalSteps),
                    total: totalSteps,
                  })}
                </span>
              )}
            </div>

            {currentStep ? (
              <div>
                <h3 className="mb-3 font-semibold">{currentStep.question}</h3>
                <div className="space-y-2">
                  {currentStep.options.map((opt) => (
                    <button key={opt.id} type="button" onClick={() => pickOption(currentStep, opt)}
                      className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-white transition-transform active:scale-[0.99]"
                      style={{ background: '#1F2937' }}>
                      {opt.text}
                    </button>
                  ))}
                </div>
                {canGoBack && (
                  <button type="button" onClick={back} className="mt-3 text-xs opacity-60">{config.backLabel}</button>
                )}
              </div>
            ) : (
              <div>
                <h3 className="mb-3 font-semibold">{config.contactTitle}</h3>
                <div className="space-y-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={config.namePlaceholder}
                    className="w-full rounded-xl border bg-transparent px-4 py-3 text-sm outline-none focus:border-amber-400"
                    style={{ borderColor: 'var(--lp-border)', color: 'var(--lp-text)' }} />
                  <BrPhoneInput value={phone} onChange={(v) => { setPhone(v); if (phoneErr) setPhoneErr(false); }}
                    aria-invalid={phoneErr}
                    className="w-full rounded-xl border bg-transparent px-4 py-3 text-sm outline-none focus:border-amber-400"
                    style={{ borderColor: phoneErr ? '#f87171' : 'var(--lp-border)', color: 'var(--lp-text)' }} />
                  {phoneErr && <p className="text-xs text-red-500">Digite um telefone válido com DDD.</p>}
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={config.emailPlaceholder} inputMode="email"
                    className="w-full rounded-xl border bg-transparent px-4 py-3 text-sm outline-none focus:border-amber-400"
                    style={{ borderColor: 'var(--lp-border)', color: 'var(--lp-text)' }} />
                </div>
                {sendErr && (
                  <div className="mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: '#f87171', color: '#f87171' }}>
                    {config.sendErrorMessage}
                  </div>
                )}
                <button type="button" onClick={submit} disabled={sending || !name.trim() || !phone.trim()}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold text-white disabled:opacity-40"
                  style={{ background: '#16A34A' }}>
                  <WhatsAppIcon size={18} /> {sending ? config.sendingLabel : sendErr ? config.retryLabel : config.ctaLabel}
                </button>
                {canGoBack && (
                  <button type="button" onClick={back} className="mt-3 text-xs opacity-60">{config.backLabel}</button>
                )}
              </div>
            )}
          </>
        )}
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
  // Fixo no rodapé da viewport, sempre visível ao rolar (não só no fim).
  // Centralizado e limitado à largura da coluna da landing.
  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-40 w-[min(420px,calc(100vw-1.5rem))] -translate-x-1/2">
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
  rich_text: RichTextBlock,
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
