import { I, Ic, type PortalBank, type PortalFinancing } from '../portalShared';
import { MIOLO } from './estilos';

/* ────────────────────────────────────────────────────────────────────────────
   Financiamento do Moderno (spec 7; protótipo `.fin-hero`, `.banks`, `.bank`):
   cabeçalho em bloco da cor principal (título e intro), bancos em cartões
   claros com "Simular no site do banco", o texto de rodapé da página e o
   bloco "Ficou com dúvida na simulação?" com o WhatsApp. Os bancos e os links
   são os que o servidor manda (só banco com link), como no Clássico.
──────────────────────────────────────────────────────────────────────────── */

const WHATSAPP = 'inline-flex items-center gap-2 rounded-full bg-[#1FAF5A] px-5 py-3 text-[14px] font-semibold text-white transition-transform hover:-translate-y-px';

/** O círculo do banco: logo enviado ou a cor da marca com o nome (nunca vazio). */
function Selo({ bank }: { bank: PortalBank }) {
  return (
    <span className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-[14px]" style={{ background: bank.color }}>
      {bank.logo_url
        ? <img src={bank.logo_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-2" />
        : <span className="px-1 text-center text-[12px] font-bold leading-tight" style={{ color: bank.ink || '#FFFFFF' }}>{bank.name}</span>}
    </span>
  );
}

export default function FinanciamentoModerno({ page, banks, waHref }: { page?: PortalFinancing | null; banks: PortalBank[]; waHref: string | null }) {
  return (
    <main className="px-4 pb-[clamp(56px,8vw,96px)]">
      <div className={MIOLO}>
        <header className="mt-6 grid items-end gap-6 rounded-[28px] bg-[var(--brand)] p-[clamp(28px,5vw,56px)] text-[var(--brand-ink)] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <h1 className="font-[var(--display)] text-[clamp(32px,4.4vw,52px)] font-semibold leading-[1.06] tracking-[-0.03em] [text-wrap:balance]">
            {page?.title || 'Financiamento e bancos'}
          </h1>
          {banks.length > 0 && (
            <p className="text-[15.5px] leading-relaxed opacity-80">{page?.intro || 'Escolha um banco e faça a sua simulação:'}</p>
          )}
        </header>

        {/* Sem banco com link: o visitante precisa de uma saída (tela vazia parece quebrada). */}
        {banks.length === 0 ? (
          <div className="mt-6 rounded-[20px] border border-[var(--m-line)] bg-[var(--m-surface)] px-6 py-12 text-center">
            <p className="text-[15px] text-[var(--m-text)]">Nossas condições de financiamento estão sendo atualizadas.</p>
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" className={`mt-5 ${WHATSAPP}`}>
                <Ic d={I.wa} s={17} /> Fale com a gente no WhatsApp
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {banks.map(b => (
                <a
                  key={b.key} href={b.url || '#'} target="_blank" rel="noreferrer noopener" aria-label={`Simular financiamento no ${b.name}`}
                  className="group flex flex-col gap-3.5 rounded-[20px] border border-[var(--m-line)] bg-[var(--m-surface)] p-5 transition-transform hover:-translate-y-0.5"
                >
                  <Selo bank={b} />
                  <b className="text-[16px] font-semibold text-[var(--m-head)]">{b.name}</b>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--m-head)]">
                    Simular no site do banco <Ic d={I.arrow} s={15} />
                  </span>
                </a>
              ))}
            </div>
            {page?.footer && <p className="mt-6 max-w-[68ch] text-[14.5px] leading-relaxed text-[var(--m-muted)]">{page.footer}</p>}
            {waHref && (
              <div className="mt-8 flex flex-col items-start justify-between gap-5 rounded-[28px] border border-[var(--m-line)] bg-[var(--m-surface)] p-[clamp(24px,4vw,36px)] sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-[var(--display)] text-[22px] font-semibold text-[var(--m-head)]">Ficou com dúvida na simulação?</h2>
                  <p className="mt-1.5 max-w-md text-[14px] text-[var(--m-muted)]">A gente acompanha você em cada etapa, do banco à assinatura.</p>
                </div>
                <a href={waHref} target="_blank" rel="noreferrer" className={`flex-none ${WHATSAPP}`}>
                  <Ic d={I.wa} s={17} /> Falar no WhatsApp
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
