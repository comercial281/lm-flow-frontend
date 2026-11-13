import { Link } from 'react-router-dom';
import { ESTILO_SELO_DESTAQUE, I, Ic, dadosDoCartao, type PropsDoCartao } from '../portalShared';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';

/* ────────────────────────────────────────────────────────────────────────────
   Cartão de foto inteira das vitrines do Moderno (spec 7 "Início"; protótipo
   `.card`): a foto ocupa o cartão, degradê escuro embaixo, selos em cima,
   bairro e código, título, metragem e preço, e "Ver detalhes" em vidro. Os
   dados (selos, local, endereço da ficha) são os do cartão do Clássico
   (`dadosDoCartao`). Sobre a foto vale branco/rgba literal; sem foto, o fundo
   é a cor principal (o degradê continua garantindo a leitura).
──────────────────────────────────────────────────────────────────────────── */

const VIDRO = 'border border-[rgba(255,255,255,0.28)] bg-[rgba(255,255,255,0.14)] backdrop-blur-[10px]';

export default function CartaoFotoInteira(props: PropsDoCartao) {
  const { p, grande } = props;
  const ctx = useCtxDoSite(props.tenant);
  const { s, selos, local, href } = dadosDoCartao(props, ctx);
  const onde = [local, p.code].filter(Boolean).join(' · ');
  const detalhes = [
    s.bedrooms ? `${s.bedrooms} dormitório${s.bedrooms > 1 ? 's' : ''}` : null,
    s.suites ? `${s.suites} suíte${s.suites > 1 ? 's' : ''}` : null,
    s.parking ? `${s.parking} vaga${s.parking > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <article
      className={`relative isolate flex snap-start flex-col justify-end overflow-hidden rounded-[20px] bg-[var(--brand)] text-white ${grande ? 'h-[520px] p-6' : 'h-[430px] p-[18px]'}`}
    >
      {p.cover_url ? (
        <img src={p.cover_url} alt={p.title} loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      ) : (
        <span aria-hidden className="absolute inset-0 -z-20 grid place-items-center text-[var(--brand-ink)]"><Ic d={I.pin} s={44} /></span>
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,10,22,0)_38%,rgba(8,10,22,0.86)_100%)]" />

      {selos.length > 0 && (
        <div className="absolute left-3.5 right-3.5 top-3.5 flex flex-wrap gap-1.5">
          {selos.map(selo => selo.tipo === 'destaque'
            ? <span key={selo.texto} className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={ESTILO_SELO_DESTAQUE}>{selo.texto}</span>
            : <span key={selo.texto} className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${VIDRO}`}>{selo.texto}</span>)}
        </div>
      )}

      {onde && <span className="text-[12px] text-[rgba(255,255,255,0.75)]">{onde}</span>}
      <h3 className={`mb-2.5 mt-0.5 line-clamp-2 font-[var(--display)] font-semibold leading-tight tracking-[-0.02em] text-white ${grande ? 'text-[26px]' : 'text-[19px]'}`}>
        {p.title}
      </h3>
      {(s.useful_area_m2 || p.display_price) && (
        <div className="mb-2 flex items-center gap-2.5">
          {!!s.useful_area_m2 && <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${VIDRO}`}>{s.useful_area_m2} m²</span>}
          {p.display_price && <b className="text-[17px] tabular-nums">{p.display_price}</b>}
        </div>
      )}
      {detalhes && <p className="mb-3.5 text-[12px] text-[rgba(255,255,255,0.72)]">{detalhes}</p>}
      <Link
        to={href} aria-label={`Ver detalhes de ${p.title}`}
        className={`rounded-full py-[11px] text-center text-[14px] font-semibold transition-transform hover:-translate-y-px ${VIDRO}`}
      >
        Ver detalhes
      </Link>
    </article>
  );
}
