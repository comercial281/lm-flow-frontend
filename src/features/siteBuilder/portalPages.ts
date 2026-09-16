import type {
  Site,
  SiteFinancingBank,
  SiteFinancingForm,
  SiteFinancingPage,
  SiteListingForm,
  SiteListingPage,
} from '@/services/siteBuilder/siteBuilderService';

/**
 * As duas páginas extras do portal — *Simule seu financiamento* e
 * *Anuncie seu imóvel* — do lado da TELA: como o que o servidor resolveu vira
 * formulário, e como o formulário vira o que é enviado de volta.
 *
 * Fora do JSX de propósito: a tela do Site Builder tem ~1.500 linhas e nada
 * testável cabe lá dentro. A REGRA (quais bancos existem, o que o público pode
 * ver, o que é gravado) mora no servidor — `Sites::PortalPages`. Aqui só se
 * traduz.
 */

/** Os cinco bancos de reserva, para a janela de deploy em que o servidor ainda
 *  é o antigo e não devolve a lista. Sem eles o bloco abriria vazio e pareceria
 *  quebrado no pior momento — logo depois de publicar.
 *
 *  ⚠️ A ORDEM, os nomes, as cores e os links oficiais têm que bater com os do
 *  servidor (`Sites::PortalPages::BANKS`): é ele quem manda, isto é só rede. */
export const FALLBACK_BANKS: SiteFinancingBank[] = [
  { key: 'itau', name: 'Itaú', color: '#EC7000', enabled: true,
    default_url: 'https://www.itau.com.br/emprestimos-financiamentos/credito-imobiliario' },
  { key: 'santander', name: 'Santander', color: '#EC0000', enabled: true,
    default_url: 'https://www.negociosimobiliarios.santander.com.br/negociosimobiliarios/#/dados-pessoais?goal=3&ic=lpcreditoimob' },
  { key: 'bb', name: 'Banco do Brasil', color: '#FFCC29', ink: '#03318C', enabled: true,
    default_url: 'https://cim-simulador-imovelproprio.apps.bb.com.br/simulacao-imobiliario/sobre-imovel' },
  { key: 'bradesco', name: 'Bradesco', color: '#CC092F', enabled: true,
    default_url: 'https://banco.bradesco/html/classic/produtos-servicos/emprestimo-e-financiamento/encontre-seu-credito/simuladores-imoveis.shtm#box1-comprar' },
  { key: 'caixa', name: 'Caixa', color: '#0070AF', enabled: true,
    default_url: 'https://simuladorhabitacao.caixa.gov.br/home' },
].map(b => ({ ...b, url: b.default_url }));

export const FINANCING_FALLBACK: SiteFinancingPage = {
  enabled: false,
  title: 'Financiamento e bancos',
  intro: 'Escolha um banco e faça a sua simulação:',
  footer: 'Estamos à disposição para maiores dúvidas.',
  banks: FALLBACK_BANKS,
};

export const LISTING_FALLBACK: SiteListingPage = {
  enabled: false,
  title: 'Anuncie seu imóvel com a gente',
  intro: 'Preencha a ficha abaixo e um especialista entra em contato para avaliar seu imóvel.',
  whatsapp_text: 'Olá! Quero anunciar meu imóvel com vocês.',
  thanks_title: 'Recebemos a sua ficha!',
  thanks_text: 'Vamos avaliar as informações do seu imóvel e entrar em contato em breve.',
  emails: [],
};

export function financingFrom(site?: Site | null): SiteFinancingPage {
  const raw = site?.financiamento;
  if (!raw) return { ...FINANCING_FALLBACK, banks: FALLBACK_BANKS.map(b => ({ ...b })) };
  return {
    ...FINANCING_FALLBACK,
    ...raw,
    banks: raw.banks?.length ? raw.banks : FALLBACK_BANKS.map(b => ({ ...b })),
  };
}

export function listingFrom(site?: Site | null): SiteListingPage {
  const raw = site?.anuncie;
  if (!raw) return { ...LISTING_FALLBACK, emails: [] };
  return { ...LISTING_FALLBACK, ...raw, emails: raw.emails ?? [] };
}

/** O que é enviado ao salvar. Texto igual ao de fábrica NÃO viaja: gravar o
 *  padrão faria a tela mostrar "escrito por mim" onde ninguém escreveu nada, e
 *  travaria o texto no dia em que o padrão da casa mudasse. */
export function financingPayload(page: SiteFinancingPage): SiteFinancingForm {
  const out: SiteFinancingForm = { enabled: page.enabled };
  if (page.title.trim() && page.title.trim() !== FINANCING_FALLBACK.title) out.title = page.title.trim();
  if (page.intro.trim() && page.intro.trim() !== FINANCING_FALLBACK.intro) out.intro = page.intro.trim();
  if (page.footer.trim() && page.footer.trim() !== FINANCING_FALLBACK.footer) out.footer = page.footer.trim();
  out.banks = Object.fromEntries(
    page.banks.map(b => {
      const url = (b.url ?? '').trim();
      const logo = (b.logo_url ?? '').trim();
      return [b.key, {
        enabled: b.enabled !== false,
        // Link igual ao oficial não viaja: ele já vem de fábrica, e gravá-lo
        // congelaria a página no endereço de hoje se o banco mudar o dele.
        url: url === (b.default_url ?? '') ? '' : url,
        // ⚠️ Logo igual ao HERDADO da Leal Mídia não viaja, pela mesma razão do
        // link. Sem esta linha, bastava um gestor abrir *Configurações* e
        // salvar sem mexer em nada para aquele cliente CONGELAR o logo de hoje
        // como escolha dele — e no dia em que a Leal Mídia trocasse a arte ele
        // continuaria com a antiga, calado.
        logo_url: logo === (b.default_logo_url ?? '') ? '' : logo,
      }];
    }),
  );
  return out;
}

export function listingPayload(page: SiteListingPage): SiteListingForm {
  const out: SiteListingForm = { enabled: page.enabled };
  const keys = ['title', 'intro', 'whatsapp_text', 'thanks_title', 'thanks_text'] as const;
  keys.forEach(k => {
    const v = (page[k] ?? '').trim();
    if (v && v !== LISTING_FALLBACK[k]) out[k] = v;
  });
  out.emails = parseEmails(page.emails);
  return out;
}

/** O gestor digita e-mails separados por vírgula, ponto e vírgula ou linha. */
export function parseEmails(input?: string[] | string | null): string[] {
  const list = Array.isArray(input) ? input : String(input ?? '').split(/[,;\n]+/);
  const seen = new Set<string>();
  return list
    .map(e => e.trim().toLowerCase())
    .filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    .filter(e => (seen.has(e) ? false : (seen.add(e), true)))
    .slice(0, 5);
}

/**
 * O aviso que a tela mostra embaixo do bloco do financiamento. Banco sem link
 * não aparece no site: sem este aviso, o gestor liga a página, publica e não
 * entende por que ela está vazia.
 */
export function financingWarning(page: SiteFinancingPage): string | null {
  if (!page.enabled) return null;
  const live = page.banks.filter(b => b.enabled !== false && (b.url ?? '').trim());
  if (live.length === 0) {
    return 'Todos os bancos estão desligados, então a página vai ao ar vazia. Ligue pelo menos um.';
  }
  const off = page.banks.length - live.length;
  if (off > 0) {
    return `${off} banco(s) desligado(s) não aparecem no site.`;
  }
  return null;
}

/**
 * De onde vem o logo que está aparecendo naquele banco. A tela PRECISA
 * distinguir os três casos: sem isso a lixeira vira "ficar sem logo" em vez de
 * "voltar ao da Leal Mídia", e o gestor não entende o que está vendo.
 */
export function bankLogoSource(bank: SiteFinancingBank): 'own' | 'inherited' | 'none' {
  const logo = (bank.logo_url ?? '').trim();
  if (!logo) return 'none';
  return logo === (bank.default_logo_url ?? '').trim() ? 'inherited' : 'own';
}

/** O aviso do bloco do "Anuncie": sem e-mail de destino, a ficha não chega a ninguém. */
export function listingWarning(page: SiteListingPage): string | null {
  if (!page.enabled) return null;
  if (parseEmails(page.emails).length === 0) {
    return 'Sem e-mail de destino a ficha fica guardada na aba Leads e ninguém é avisado. Cadastre ao menos um e-mail.';
  }
  return null;
}

/** Rótulo do desfecho do envio, na lista de leads. */
export function emailDeliveryLabel(value?: string | null): { text: string; tone: 'ok' | 'warn' | 'bad' } | null {
  if (!value) return null;
  if (value === 'enviado') return { text: 'E-mail enviado', tone: 'ok' };
  if (value === 'sem_destinatario') return { text: 'Sem e-mail de destino cadastrado', tone: 'warn' };
  if (value === 'sem_email_configurado') return { text: 'A plataforma não tem envio de e-mail configurado', tone: 'bad' };
  if (value.startsWith('falhou')) return { text: `Não saiu — ${value.replace(/^falhou:\s*/, '')}`, tone: 'bad' };
  return { text: value, tone: 'warn' };
}
