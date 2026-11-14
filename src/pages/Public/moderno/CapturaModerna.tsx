import { useId, type ReactNode } from 'react';
import { I, Ic, MarcaDoSite, onlyDigits, tokensDoSite, useLinkDoWhatsApp, type SiteInfo } from '../portalShared';
import { BrPhoneInput } from '@/components/shared';
import { TEXTO_ENVIO_NA_PREVIA } from '@/features/siteBuilder/public/previa';
import { logoNaSuperficie, resolverAparencia, textoSobre } from '@/features/siteBuilder/public/aparenciaConfig';
import type { Finalidade } from '../finalidade';
import { TituloComDestaque } from '../TituloComDestaque';
import type { PropsDaCaptura } from './InicioModerno';
import { BLOCO, BOTAO_PRINCIPAL, MIOLO, tituloDeSecao } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   "Não achou?" do Moderno (spec 7 "Início"; protótipo `.contact`, `.panel`).
   Os MESMOS campos e o MESMO envio do Clássico: "Quero comprar / Quero
   alugar", nome e WhatsApp; estado e envio moram no PortalHomePage
   (`captura`). Os "comprar/vender/alugar" e a mensagem livre do protótipo
   não entram. Título e formulário à esquerda; à direita, o painel na cor
   principal com o WhatsApp, o telefone e o e-mail do site (os mesmos do
   topo e do rodapé), do tamanho do que mostra (logo e, logo abaixo, os
   contatos; não estica até a altura do formulário). Sem nenhum deles, o
   painel não aparece.
   `id="contato"`: é a âncora do menu e das chamadas.
──────────────────────────────────────────────────────────────────────────── */

interface Props { site: SiteInfo; wa?: string | null; captura: PropsDaCaptura }

const TITULO = 'Não achou? A gente encontra *pra você.*';
const TEXTO = 'Deixe seu contato e um especialista traz opções que combinam com o que você procura — sem robô, sem enrolação.';
const OPCOES: [Finalidade, string][] = [['venda', 'Quero comprar'], ['locacao', 'Quero alugar']];
const ROTULO = 'mb-1.5 block text-[12px] font-semibold text-[var(--m-muted)]';
const CAMPO = 'w-full rounded-2xl border bg-[var(--m-surface)] px-4 py-3.5 text-[15px] font-medium text-[var(--m-head)] outline-none ' +
  'placeholder:font-normal placeholder:text-[var(--m-muted)] focus:border-[var(--brand)]';

/** WhatsApp gravado só com dígitos (com o 55) no jeito de ler: (11) 98765-4321. */
function telefoneLegivel(digitos: string): string {
  const d = digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

/** O que o painel mostra: WhatsApp, telefone e e-mail do site (os do topo e do rodapé). */
function useContatosDoSite(site: SiteInfo, wa?: string | null) {
  const link = useLinkDoWhatsApp(site);
  return { waHref: wa ? link : null, telefone: site.contact?.phone?.trim(), email: site.contact?.email?.trim() };
}

function LinhaDoPainel({ href, icone, externo, children }: { href: string; icone: string; externo?: boolean; children: ReactNode }) {
  return (
    <li className="relative">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-current opacity-[0.16]" />
      <a href={href} {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="flex items-center gap-3.5 py-3.5">
        <span className="relative grid h-9 w-9 flex-none place-items-center rounded-full">
          <span aria-hidden className="absolute inset-0 rounded-full border border-current opacity-30" />
          <Ic d={icone} s={15} />
        </span>
        <span className="min-w-0">{children}</span>
      </a>
    </li>
  );
}

function Painel({ site, wa }: { site: SiteInfo; wa?: string | null }) {
  const { waHref, telefone, email } = useContatosDoSite(site, wa);

  const brand = tokensDoSite(site).brand;
  const logo = logoNaSuperficie(site.branding?.logo_url, resolverAparencia(site.appearance), 'marca', brand);
  // Logo normal vira branca só sobre cor principal escura (como no rodapé).
  const filtroDaLogo = logo.clara || textoSobre(brand) !== '#FFFFFF' ? '' : 'brightness-0 invert';
  return (
    <aside data-painel-de-contato className="flex flex-col gap-8 self-start rounded-[28px] p-8" style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}>
      <MarcaDoSite site={site} logo={logo.url} logoCls={`h-9 w-auto max-w-[180px] self-start object-contain ${filtroDaLogo}`}
        nomeCls="font-[var(--display)] text-[18px] font-bold" />
      <ul>
        {waHref && wa && (
          <LinhaDoPainel href={waHref} icone={I.wa} externo>
            <b className="block text-[17px] font-medium">{telefoneLegivel(onlyDigits(wa))}</b>
            <span className="text-[13px] opacity-70">WhatsApp</span>
          </LinhaDoPainel>
        )}
        {telefone && (
          <LinhaDoPainel href={`tel:${onlyDigits(telefone)}`} icone={I.phone}>
            <b className="block text-[17px] font-medium">{telefone}</b>
            <span className="text-[13px] opacity-70">Telefone</span>
          </LinhaDoPainel>
        )}
        {email && (
          <LinhaDoPainel href={`mailto:${email}`} icone={I.mail}>
            <b className="block break-all text-[17px] font-medium">{email}</b>
          </LinhaDoPainel>
        )}
      </ul>
    </aside>
  );
}

function Formulario({ c }: { c: PropsDaCaptura }) {
  const id = useId();
  if (c.enviado && c.enviadoNaPrevia) {
    return <div role="status" className="rounded-2xl bg-[var(--m-brand-soft)] p-6 text-[15px] font-semibold text-[var(--m-head)]">{TEXTO_ENVIO_NA_PREVIA}</div>;
  }
  if (c.enviado) {
    return (
      <div className="rounded-2xl border border-[var(--m-line)] bg-[var(--m-surface)] p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: '#25D366' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <p className="text-lg font-semibold text-[var(--m-head)]">Recebemos seu contato!</p>
        <p className="mt-1 text-[var(--m-text)]">Um especialista vai te chamar em breve.</p>
      </div>
    );
  }
  return (
    <form onSubmit={c.enviar} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div role="radiogroup" aria-label="O que você procura" className="flex flex-wrap gap-2 sm:col-span-2">
        {OPCOES.map(([opcao, rotulo]) => {
          const marcada = c.finalidade === opcao;
          return (
            <label key={opcao} className={`cursor-pointer rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${marcada
              ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]'
              : 'border-[var(--m-line)] bg-[var(--m-surface)] text-[var(--m-head)]'}`}>
              <input type="radio" name="finalidade" value={opcao} checked={marcada} onChange={() => c.aoMudarFinalidade(opcao)} className="sr-only" />
              {rotulo}
            </label>
          );
        })}
      </div>
      <div>
        <label htmlFor={`${id}-nome`} className={ROTULO}>Seu nome</label>
        <input id={`${id}-nome`} value={c.nome} onChange={e => c.aoMudarNome(e.target.value)} required placeholder="Como podemos te chamar?"
          className={`${CAMPO} border-[var(--m-line)]`} />
      </div>
      <div>
        <label htmlFor={`${id}-whats`} className={ROTULO}>WhatsApp</label>
        <BrPhoneInput id={`${id}-whats`} value={c.telefone} onChange={c.aoMudarTelefone} required aria-invalid={c.telefoneInvalido}
          className={`${CAMPO} ${c.telefoneInvalido ? 'border-[#EF4444]' : 'border-[var(--m-line)]'}`} />
        {c.telefoneInvalido && <p className="mt-1 text-[13px] text-[#EF4444]">Digite um telefone válido com DDD.</p>}
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className={`mt-1 ${BOTAO_PRINCIPAL}`}>Quero ajuda pra encontrar <Ic d={I.arrow} s={16} /></button>
        {c.erro && <p role="alert" className="mt-3 text-[13px] text-[#EF4444]">{c.erro}</p>}
      </div>
    </form>
  );
}

export default function CapturaModerna({ site, wa, captura }: Props) {
  const { waHref, telefone, email } = useContatosDoSite(site, wa);
  if (!captura.ligada) return null;
  const modo = resolverAparencia(site.appearance).heading_highlight;
  const comPainel = !!(waHref || telefone || email);
  return (
    <section id="contato" className={BLOCO}>
      <div className={`${MIOLO} grid grid-cols-1 items-stretch gap-8 ${comPainel ? 'md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]' : ''}`}>
        {/* Sem o painel, a coluna fica em até 720px, alinhada à esquerda como as outras seções. */}
        <div className={`min-w-0 ${comPainel ? '' : 'max-w-[720px]'}`}>
          <h2 className={tituloDeSecao('text-[clamp(30px,3.8vw,46px)]')}><TituloComDestaque texto={TITULO} modo={modo} /></h2>
          <p className="mb-6 mt-3.5 max-w-[52ch] text-[14.5px] leading-relaxed text-[var(--m-text)]">{TEXTO}</p>
          <Formulario c={captura} />
        </div>
        {comPainel && <Painel site={site} wa={wa} />}
      </div>
    </section>
  );
}
