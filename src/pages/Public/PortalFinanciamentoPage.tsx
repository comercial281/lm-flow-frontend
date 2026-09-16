import { useParams } from 'react-router-dom';
import {
  I, Ic, PortalFooter, PortalHeader, onlyDigits, usePortalData,
  type PortalBank,
} from './portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — SIMULE SEU FINANCIAMENTO

   "Como eu financio?" é a segunda pergunta de todo lead de imóvel, e até aqui
   ela só era respondida no WhatsApp. A página leva o visitante ao simulador do
   banco em UM clique.

   ⚠️ Quem decide quais bancos existem é o SERVIDOR (`Sites::PortalPages`), e ele
   só manda os que têm link de simulação — banco sem link não aparece, porque
   link morto no site de um cliente é pior do que banco faltando. Nada aqui
   inventa banco nem URL.
──────────────────────────────────────────────────────────────────────────── */

/**
 * O círculo do banco. Com logo enviado pelo gestor, sai o logo; sem ele, sai a
 * cor da marca com o nome escrito — nunca um círculo vazio.
 *
 * Os logos oficiais NÃO são embutidos no nosso código: quem tem a relação com o
 * banco (e o direito de usar a arte) é a imobiliária, e o campo de logo existe
 * para ela subir a versão oficial.
 */
function BankBadge({ bank }: { bank: PortalBank }) {
  const ink = bank.ink || '#FFFFFF';
  return (
    <a
      href={bank.url || '#'}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={`Simular financiamento no ${bank.name}`}
      className="group flex flex-col items-center gap-3"
    >
      <span
        className="flex h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-full shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_32px_-14px_rgba(0,0,0,0.45)]"
        style={{ background: bank.color }}
      >
        {bank.logo_url ? (
          <img src={bank.logo_url} alt={bank.name} className="h-full w-full object-contain p-4" />
        ) : (
          <span
            className="px-3 text-center text-[15px] font-bold leading-tight"
            style={{ color: ink }}
          >
            {bank.name}
          </span>
        )}
      </span>
      <span className="text-[13px] font-medium text-neutral-600 transition-colors group-hover:text-[var(--brand)]">
        {bank.name}
      </span>
    </a>
  );
}

export default function PortalFinanciamentoPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const { state, site, fontHref, wa, cssVars } = usePortalData(tenant);

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400" style={{ fontFamily: 'system-ui' }}>Carregando…</div>;
  }
  if (state === 'error') {
    return <div className="flex min-h-screen items-center justify-center px-6 text-center text-neutral-500" style={{ fontFamily: 'system-ui' }}>Portal indisponível.</div>;
  }

  const page = site.financiamento;
  const banks = page?.banks ?? [];
  const waHref = wa
    ? `https://wa.me/${onlyDigits(wa)}?text=${encodeURIComponent('Olá! Quero tirar dúvidas sobre o financiamento do imóvel.')}`
    : null;

  return (
    <div style={cssVars} className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={fontHref} rel="stylesheet" />

      <PortalHeader site={site} tenant={tenant!} />

      <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
        <h1 className="font-[var(--display)] text-3xl font-semibold sm:text-4xl">
          {page?.title || 'Financiamento e bancos'}
        </h1>

        {/* Página ligada sem nenhum banco com link: o visitante precisa de uma
            saída, e o gestor de um sinal de que falta configurar. Tela em branco
            aqui seria indistinguível de "quebrou". */}
        {banks.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-black/10 px-6 py-12 text-center">
            <p className="text-[15px] text-neutral-600">
              Nossas condições de financiamento estão sendo atualizadas.
            </p>
            {waHref && (
              <a
                href={waHref} target="_blank" rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold text-white"
                style={{ background: '#25D366' }}
              >
                <Ic d={I.wa} s={17} /> Fale com a gente no WhatsApp
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="mt-7 rounded-[24px] border border-black/[0.07] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-9">
              <p className="text-[15px] text-neutral-600">
                {page?.intro || 'Escolha um banco e faça a sua simulação:'}
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-8 sm:justify-start sm:gap-10">
                {banks.map(b => <BankBadge key={b.key} bank={b} />)}
              </div>

              {page?.footer && (
                <p className="mt-9 border-t border-black/[0.06] pt-6 text-[15px] text-neutral-600">
                  {page.footer}
                </p>
              )}
            </div>

            {waHref && (
              <div className="mt-8 overflow-hidden rounded-[24px] px-6 py-8 sm:px-10" style={{ background: 'var(--ink)' }}>
                <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                  <div className="text-white">
                    <h2 className="font-[var(--display)] text-[22px] font-semibold">Ficou com dúvida na simulação?</h2>
                    <p className="mt-1.5 max-w-md text-[14px] text-white/70">
                      A gente acompanha você em cada etapa, do banco à assinatura.
                    </p>
                  </div>
                  <a
                    href={waHref} target="_blank" rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold text-white"
                    style={{ background: '#25D366' }}
                  >
                    <Ic d={I.wa} s={17} /> Falar no WhatsApp
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <PortalFooter site={site} tenant={tenant!} />
    </div>
  );
}
