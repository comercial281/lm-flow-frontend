import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { I, Ic, type SiteInfo } from '../portalShared';
import type { HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { chamadasVisiveis, type CartaoChamada } from '@/features/siteBuilder/public/vitrines';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';

/* ────────────────────────────────────────────────────────────────────────────
   Faixa de chamadas da home: os caminhos que não são "quero comprar"
   (financiamento, anunciar o próprio imóvel, pedir ajuda para achar) e até 3
   chamadas livres do Personalizar.

   ⚠️ A faixa NÃO tem interruptor próprio, e é de propósito: ela aparece quando
   existem pelo menos DOIS destinos de verdade. Só a busca de imóvel ligada não
   justifica uma faixa: ela repetiria, em forma de cartão, o bloco de captura
   que já está logo abaixo na home.

   Visual (home.callouts.layout): `band` = faixa escura com ícones (a de
   sempre); `photo` = a mesma faixa com foto de fundo e filtro escuro; `cards` =
   fundo claro com cartões brancos.
──────────────────────────────────────────────────────────────────────────── */

const ICONE: Record<CartaoChamada['icone'], string> = {
  bank: I.bank, sign: I.sign, search: I.search, whatsapp: I.chat, link: I.link, page: I.page,
};

function Destino({ c, className, children }: { c: CartaoChamada; className: string; children: ReactNode }) {
  if (c.externo) return <a href={c.to} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  if (c.to.startsWith('#')) return <a href={c.to} className={className}>{children}</a>;
  return <Link to={c.to} className={className}>{children}</Link>;
}

interface Props { site: SiteInfo; tenant: string; home: HomeConfig }

export default function HomeChamadas({ site, tenant, home }: Props) {
  const ctx = useCtxDoSite(tenant);
  const cards = chamadasVisiveis(site, ctx);
  if (cards.length < 2) return null;

  const { layout, background_url, overlay } = home.callouts;
  const colunas = cards.length === 2 || cards.length === 4 ? 'md:grid-cols-2' : 'md:grid-cols-3';

  if (layout === 'cards') {
    return (
      <section className="border-y border-black/[0.06] bg-[var(--paper)]">
        <div className={`mx-auto grid max-w-6xl gap-5 px-4 py-14 sm:px-6 ${colunas}`}>
          {cards.map(c => (
            <Destino key={c.key} c={c}
              className="group flex flex-col items-start rounded-[20px] bg-white p-6 text-left ring-1 ring-black/[0.06] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.25)] transition-shadow hover:shadow-[0_20px_40px_-16px_rgba(0,0,0,0.25)]">
              <span className="text-[var(--brand)]"><Ic d={ICONE[c.icone]} s={26} /></span>
              <h3 className="mt-4 font-[var(--display)] text-[22px] font-semibold text-[var(--ink)]">{c.title}</h3>
              {c.text && <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-neutral-600">{c.text}</p>}
              <span className="mt-5 inline-flex items-center gap-2 text-[14px] font-semibold text-[var(--brand)]">
                {c.button} <Ic d={I.arrow} s={16} />
              </span>
            </Destino>
          ))}
        </div>
      </section>
    );
  }

  // `photo` sem foto cai na faixa escura de sempre.
  const comFoto = layout === 'photo' && !!background_url && /^https?:\/\//i.test(background_url);
  const filtro = Math.min(80, Math.max(0, overlay)) / 100;

  return (
    <section
      className={`relative border-y border-black/[0.06] ${comFoto ? 'bg-cover bg-center' : ''}`}
      style={comFoto ? { backgroundColor: 'var(--ink)', backgroundImage: `url("${background_url!.replace(/["\\]/g, encodeURIComponent)}")` } : { background: 'var(--ink)' }}
    >
      {comFoto && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${filtro})` }} />}
      <div className={`relative mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 ${colunas}`}>
        {cards.map(c => (
          <Destino key={c.key} c={c} className="group flex flex-col items-start text-left">
            <span className="text-white/80"><Ic d={ICONE[c.icone]} s={26} /></span>
            <h3 className="mt-4 font-[var(--display)] text-[22px] font-semibold text-white">{c.title}</h3>
            {c.text && <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-white/70">{c.text}</p>}
            <span className="mt-5 inline-flex items-center gap-2 border-b-2 border-white/60 pb-1 text-[14px] font-semibold text-white transition-colors group-hover:border-[var(--brand)]">
              {c.button} <Ic d={I.arrow} s={16} />
            </span>
          </Destino>
        ))}
      </div>
    </section>
  );
}
