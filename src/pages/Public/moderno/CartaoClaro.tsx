import { Link } from 'react-router-dom';
import { ESTILO_SELO_DESTAQUE, I, Ic, dadosDoCartao, type PropsDoCartao } from '../portalShared';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';

/* ────────────────────────────────────────────────────────────────────────────
   Cartão claro da lista de imóveis do Moderno (spec 7 "Imóveis"; protótipo
   `.lcard`): foto 4:3 com o preço em vidro escuro no pé e os selos em cima;
   corpo claro com tipo · código, título em 2 linhas, bairro e cidade, os
   números do imóvel, "Ver detalhes" e o WhatsApp redondo. Os dados (selos,
   local, endereço da ficha, link do WhatsApp) são os do cartão do Clássico
   (`dadosDoCartao`). Deitado (Lista de imóveis › em linhas): foto à esquerda
   a partir do md; no celular volta a ficar em pé.
──────────────────────────────────────────────────────────────────────────── */

const VIDRO_ESCURO = 'bg-[rgba(8,10,22,0.62)] backdrop-blur-[8px] text-white';

function Numero({ d, children }: { d: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-[5px]">
      <span className="text-[var(--m-muted)]"><Ic d={d} s={14} /></span>{children}
    </span>
  );
}

export default function CartaoClaro(props: PropsDoCartao & { deitado?: boolean }) {
  const { p, deitado } = props;
  const ctx = useCtxDoSite(props.tenant);
  const { s, selos, typeLabel, local, waLink, href } = dadosDoCartao(props, ctx);
  const sobretitulo = [typeLabel, p.code].filter(Boolean).join(' · ');
  const numeros = [
    s.bedrooms ? { d: I.bed, t: `${s.bedrooms} dorm.` } : null,
    s.suites ? { d: I.bath, t: `${s.suites} suíte${s.suites > 1 ? 's' : ''}` } : null,
    s.parking ? { d: I.car, t: `${s.parking} vaga${s.parking > 1 ? 's' : ''}` } : null,
    s.useful_area_m2 ? { d: I.ruler, t: `${s.useful_area_m2} m²` } : null,
  ].filter((x): x is { d: string; t: string } => !!x);

  return (
    <article
      className={`group flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-[var(--m-line)] bg-[var(--m-surface)] ${deitado ? 'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]' : ''}`}
    >
      {/* Foto: atalho de mouse pro mesmo endereço de "Ver detalhes" (fora do Tab e do
          leitor de tela, que já têm o título e o botão); selos e preço por cima, fora do link. */}
      <div className={`relative aspect-[4/3] overflow-hidden bg-[var(--m-brand-soft)] ${deitado ? 'md:aspect-auto md:min-h-[220px]' : ''}`}>
        <Link to={href} tabIndex={-1} aria-hidden className="absolute inset-0 block">
          {p.cover_url ? (
            <img src={p.cover_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
          ) : (
            <span className="absolute inset-0 grid content-center place-items-center gap-2 text-[12.5px] font-semibold text-[var(--m-head)]">
              <span className="opacity-45"><Ic d={I.pin} s={40} /></span>
              Fotos em breve
            </span>
          )}
        </Link>
        {selos.length > 0 && (
          <div className="pointer-events-none absolute left-3 right-3 top-3 flex flex-wrap gap-1.5">
            {selos.map(selo => selo.tipo === 'destaque'
              ? <span key={selo.texto} className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={ESTILO_SELO_DESTAQUE}>{selo.texto}</span>
              : <span key={selo.texto} className="rounded-full bg-[var(--brand)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--brand-ink)]">{selo.texto}</span>)}
          </div>
        )}
        {p.display_price && (
          <span className={`pointer-events-none absolute bottom-3 left-3 rounded-full px-3 py-[5px] text-[14px] font-bold tabular-nums ${VIDRO_ESCURO}`}>
            {p.display_price}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-[5px] px-4 pb-3 pt-4">
          {sobretitulo && <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--m-muted)]">{sobretitulo}</span>}
          <Link to={href}>
            <h3 className="line-clamp-2 font-[var(--display)] text-[16px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--m-head)]">{p.title}</h3>
          </Link>
          {local && (
            <p className="flex items-center gap-[5px] text-[12.5px] text-[var(--m-muted)]">
              <span className="shrink-0"><Ic d={I.pin} s={13} /></span>{local}
            </p>
          )}
          {numeros.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[12.5px] text-[var(--m-text)]">
              {numeros.map(n => <Numero key={n.t} d={n.d}>{n.t}</Numero>)}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-4 pb-4 pt-1">
          <Link
            to={href} aria-label={`Ver detalhes de ${p.title}`}
            className="flex-1 rounded-full bg-[var(--brand)] px-3 py-2.5 text-center text-[14px] font-semibold text-[var(--brand-ink)] transition-transform hover:-translate-y-px"
          >
            Ver detalhes
          </Link>
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp" title="Falar no WhatsApp"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1FAF5A] text-white transition-transform hover:scale-105">
              <Ic d={I.wa} s={18} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

/** O mesmo cartão claro, deitado (Lista de imóveis › cartões em linhas). */
export function CartaoClaroDeitado(props: PropsDoCartao) {
  return <CartaoClaro {...props} deitado />;
}
