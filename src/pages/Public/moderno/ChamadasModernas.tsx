import { useState } from 'react';
import { I, Ic, type PortalProperty, type SiteInfo } from '../portalShared';
import type { HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import type { DestaqueDosTitulos } from '@/features/siteBuilder/public/aparenciaConfig';
import { chamadasVisiveis, type CartaoChamada } from '@/features/siteBuilder/public/vitrines';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { semAsteriscos } from '@/features/siteBuilder/public/destaqueNoTitulo';
import { Destino, ICONE } from '../home/HomeChamadas';
import { fotoDaCapa } from '../home/useBuscaDaCapa';
import { TituloComDestaque } from '../TituloComDestaque';
import { DESTAQUE_SOBRE_A_COR, DESTAQUE_SOBRE_O_CLARO } from './destaqueModerno';
import { BLOCO, BOTAO_PRINCIPAL, BOTAO_REDONDO, MIOLO, SETA_DIREITA, SETA_ESQUERDA } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   Chamadas do Moderno (spec 7 "Início"; protótipo `.ch-band`, `.ch-cards`,
   `.ch-photo`/`.help`). As MESMAS chamadas do Clássico (`chamadasVisiveis`:
   financiamento, anuncie, sob encomenda e as livres, com os mesmos textos e
   destinos) e a mesma regra: com menos de duas, a seção some.
   `home.callouts.layout`:
   - `band`  Faixa: bloco na cor principal, colunas separadas por linha;
   - `photo` Foto: foto com o "Como podemos ajudar?" em vidro listando as
     chamadas; ao lado, título, texto e botão da escolhida, setas e "01 / 03".
     Foto = `callouts.background_url` com o filtro `callouts.overlay`; sem
     ela, a foto da capa (`fotoDaCapa`), pra o jeito nunca ficar sem foto;
   - `cards` Cartões: cartões claros, o primeiro na cor principal.
   Sobre a cor principal o texto é `--brand-ink`; os tons suaves vêm de
   opacidade sobre a cor do texto (como no rodapé), nunca de color-mix.
──────────────────────────────────────────────────────────────────────────── */

interface Props { site: SiteInfo; home: HomeConfig; items: PortalProperty[]; tenant: string; modo: DestaqueDosTitulos }

const TITULO_DA_CHAMADA = 'font-[var(--display)] text-[22px] font-semibold leading-tight tracking-[-0.02em]';

/** Ícone numa bolinha cujo fundo é a cor do texto em 12% (sobre a cor principal). */
function Bolinha({ c, corDoIcone }: { c: CartaoChamada; corDoIcone: string }) {
  return (
    <span className="relative mb-1 grid h-11 w-11 place-items-center rounded-full">
      <span aria-hidden className="absolute inset-0 rounded-full bg-current opacity-[0.12]" />
      <span className={`relative ${corDoIcone}`}><Ic d={ICONE[c.icone]} s={18} /></span>
    </span>
  );
}

function Titulo({ c, modo, sobreACor }: { c: CartaoChamada; modo: DestaqueDosTitulos; sobreACor: boolean }) {
  return (
    <h3 className={`${TITULO_DA_CHAMADA} ${sobreACor ? DESTAQUE_SOBRE_A_COR : `text-[var(--m-head)] ${DESTAQUE_SOBRE_O_CLARO}`}`}>
      <TituloComDestaque texto={c.title} modo={modo} sobreEscuro={sobreACor} />
    </h3>
  );
}

function NaFaixa({ cards, modo }: { cards: CartaoChamada[]; modo: DestaqueDosTitulos }) {
  const cols = cards.length === 2 || cards.length === 4 ? 2 : 3;
  return (
    <div className={`grid grid-cols-1 gap-y-0 rounded-[28px] py-2 md:gap-y-10 md:py-[clamp(28px,4vw,44px)] ${cols === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}
      style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}>
      {cards.map((c, i) => (
        <div key={c.key} className="relative flex flex-col gap-2.5 px-[clamp(20px,3vw,36px)] py-[22px] md:py-0">
          {/* Linha entre as colunas: em cima no celular; à esquerda no computador (menos na 1ª da linha). */}
          {i > 0 && (
            <span aria-hidden className={`absolute left-[clamp(20px,3vw,36px)] right-[clamp(20px,3vw,36px)] top-0 h-px bg-current opacity-[0.16] ${
              i % cols === 0 ? 'md:hidden' : 'md:bottom-0 md:left-0 md:right-auto md:h-auto md:w-px'}`} />
          )}
          <Bolinha c={c} corDoIcone="text-[var(--accent)]" />
          <Titulo c={c} modo={modo} sobreACor />
          {c.text && <p className="mb-1.5 text-[14px] leading-relaxed opacity-75">{c.text}</p>}
          <Destino c={c} className="mt-auto inline-flex items-center gap-2 self-start rounded-full border-[1.5px] border-current px-[18px] py-2.5 text-[14px] font-semibold transition-transform hover:-translate-y-px">
            {c.button} <Ic d={I.arrow} s={16} />
          </Destino>
        </div>
      ))}
    </div>
  );
}

function EmCartoes({ cards, modo }: { cards: CartaoChamada[]; modo: DestaqueDosTitulos }) {
  const colunas = cards.length === 2 || cards.length === 4 ? 'md:grid-cols-2' : 'md:grid-cols-3';
  return (
    <div className={`grid grid-cols-1 gap-3 ${colunas}`}>
      {cards.map((c, i) => {
        const principal = i === 0;
        return (
          <Destino key={c.key} c={c} data-principal={principal ? '' : undefined}
            className={`flex flex-col gap-2.5 rounded-[20px] border p-[26px] transition-transform hover:-translate-y-px ${principal
              ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]'
              : 'border-[var(--m-line)] bg-[var(--m-surface)]'}`}>
            {principal
              ? <Bolinha c={c} corDoIcone="" />
              : <span className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-[var(--m-brand-soft)] text-[var(--m-head)]"><Ic d={ICONE[c.icone]} s={18} /></span>}
            <Titulo c={c} modo={modo} sobreACor={principal} />
            {c.text && <p className={`mb-2 text-[14px] leading-relaxed ${principal ? 'opacity-75' : 'text-[var(--m-text)]'}`}>{c.text}</p>}
            <span className={`mt-auto inline-flex items-center gap-2 text-[14px] font-semibold ${principal ? '' : 'text-[var(--m-head)]'}`}>
              {c.button} <Ic d={I.arrow} s={15} />
            </span>
          </Destino>
        );
      })}
    </div>
  );
}

function NaFoto({ cards, foto, filtro, modo }: { cards: CartaoChamada[]; foto: string; filtro: number; modo: DestaqueDosTitulos }) {
  const [escolhida, setEscolhida] = useState(0);
  const n = cards.length;
  const c = cards[Math.min(escolhida, n - 1)];
  const andar = (passo: 1 | -1) => setEscolhida(k => (k + passo + n) % n);
  const doisDigitos = (k: number) => String(k).padStart(2, '0');

  return (
    <div className="grid grid-cols-1 items-stretch gap-10 md:grid-cols-2">
      <div className="relative isolate grid min-h-[420px] place-items-center overflow-hidden rounded-[28px] p-6 md:min-h-[500px]">
        <img src={foto} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        {filtro > 0 && <div aria-hidden className="absolute inset-0 -z-10" style={{ background: `rgba(0,0,0,${filtro})` }} />}
        <div className="w-[min(340px,100%)] rounded-[22px] border border-[rgba(255,255,255,0.38)] bg-[rgba(255,255,255,0.18)] p-4 text-white backdrop-blur-[16px]">
          <p className="mb-3 text-center text-[13.5px] font-semibold">Como podemos ajudar?</p>
          <div className="grid gap-2">
            {cards.map((o, k) => (
              <button key={o.key} type="button" aria-pressed={k === escolhida} onClick={() => setEscolhida(k)}
                className={`rounded-[14px] border px-3 py-2.5 text-left text-[14.5px] font-semibold leading-tight transition-colors ${k === escolhida
                  ? 'border-white bg-white text-[#0B0B0F]'
                  : 'border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.12)] text-white hover:bg-[rgba(255,255,255,0.22)]'}`}>
                {semAsteriscos(o.title)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button type="button" aria-label="Anterior" onClick={() => andar(-1)} className={BOTAO_REDONDO}><Ic d={SETA_ESQUERDA} s={16} /></button>
            <button type="button" aria-label="Próximo" onClick={() => andar(1)} className={BOTAO_REDONDO}><Ic d={SETA_DIREITA} s={16} /></button>
          </div>
          <span className="text-[12.5px] tabular-nums tracking-[0.04em] text-[var(--m-muted)]">{doisDigitos(escolhida + 1)} / {doisDigitos(n)}</span>
        </div>
        <div aria-live="polite" className="flex flex-1 flex-col">
          <h3 className={`mb-3.5 mt-7 font-[var(--display)] text-[clamp(26px,3vw,34px)] font-semibold leading-tight tracking-[-0.02em] text-[var(--m-head)] ${DESTAQUE_SOBRE_O_CLARO}`}>
            <TituloComDestaque texto={c.title} modo={modo} />
          </h3>
          {c.text && <p className="max-w-[46ch] text-[15px] leading-relaxed text-[var(--m-text)]">{c.text}</p>}
          <Destino c={c} className={`mt-6 self-start ${BOTAO_PRINCIPAL}`}>{c.button} <Ic d={I.arrow} s={16} /></Destino>
        </div>
      </div>
    </div>
  );
}

export default function ChamadasModernas({ site, home, items, tenant, modo }: Props) {
  const ctx = useCtxDoSite(tenant);
  const cards = chamadasVisiveis(site, ctx);
  if (cards.length < 2) return null;

  const { layout, background_url, overlay } = home.callouts;
  const fundoValido = !!background_url && /^https?:\/\//i.test(background_url);
  return (
    <section data-chamadas={layout} className={BLOCO}>
      <div className={MIOLO}>
        {layout === 'cards' ? <EmCartoes cards={cards} modo={modo} />
          : layout === 'photo' ? (
            <NaFoto cards={cards} modo={modo}
              foto={fundoValido ? background_url! : fotoDaCapa(site, items)}
              filtro={Math.min(80, Math.max(0, overlay)) / 100} />
          ) : <NaFaixa cards={cards} modo={modo} />}
      </div>
    </section>
  );
}
