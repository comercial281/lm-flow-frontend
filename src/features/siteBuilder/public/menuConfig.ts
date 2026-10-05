// src/features/siteBuilder/public/menuConfig.ts
// Menu do site público (Meu site › Personalizar › Menus, C3).
//
// O servidor manda o menu configurável em `site.menu_config` (NÃO em
// `site.menu`: essa chave continua sendo a lista antiga das páginas no menu, e
// o site no ar a lê como lista). Formato (Sites::MenuConfig.public_payload):
//
//   { items:    [{ key, label, enabled, page_title? }, …],
//     external: [{ label, url }] }                          // até 3, só http(s)
//
// Chaves: sale rent launch about contact financing listing blog e
// `page:<slug>`. O servidor manda os itens fixos ligados mesmo sem destino:
// quem esconde é o site (`itensDoMenu`). Página só vem no `menu_config` se
// estiver ativa, e o `page_title` é a prova de que ela existe.
//
// Servidor velho (sem `menu_config`): o menu de fábrica, com as páginas da
// lista antiga (`site.menu`). Sai igual ao de antes do C3.
import type { SiteInfo } from '@/pages/Public/portalShared';
import { caminhoDoSite, type CtxDoSite } from './dominioDoSite';
import type { AbaId } from './homeConfig';

export const CHAVES_ANTES_DAS_PAGINAS = ['sale', 'rent', 'launch', 'about', 'contact', 'financing', 'listing'] as const;
export const CHAVES_DEPOIS_DAS_PAGINAS = ['blog'] as const;
export type ChaveFixa = typeof CHAVES_ANTES_DAS_PAGINAS[number] | typeof CHAVES_DEPOIS_DAS_PAGINAS[number];
const CHAVES_FIXAS: readonly string[] = [...CHAVES_ANTES_DAS_PAGINAS, ...CHAVES_DEPOIS_DAS_PAGINAS];
const ABAS: readonly string[] = ['sale', 'rent', 'launch'];

export const PREFIXO_PAGINA = 'page:';
const SLUG_DA_PAGINA = /^[a-z0-9/_-]+$/;
export const ROTULO_MAX = 40;
export const EXTERNOS_MAX = 3;
const URL_MAX = 2048;

/** Nome de cada item fixo quando o cliente não deu outro (o do topo de antes do C3). */
export const NOME_DE_FABRICA: Record<ChaveFixa, string> = {
  sale: 'Comprar', rent: 'Alugar', launch: 'Lançamentos', about: 'Sobre', contact: 'Contato',
  financing: 'Financiamento', listing: 'Anuncie seu imóvel', blog: 'Blog',
};

export interface ItemDoMenu { key: string; label: string | null; enabled: boolean; page_title: string | null }
export interface LinkExterno { label: string; url: string }
export interface MenuDoSite {
  items: ItemDoMenu[];
  external: LinkExterno[];
  /**
   * O cliente já salvou a tela Menus (`settings['menu']` existe no servidor)?
   * `null` quando o servidor não manda o campo (servidor anterior ao `saved`).
   */
  saved?: boolean | null;
}

/** Link pronto pro topo e pro rodapé. */
export interface LinkDoMenu {
  chave: string;
  rotulo: string;
  href: string;
  /** Endereço de fora do site: abre em outra aba (`target=_blank rel="noopener noreferrer"`). */
  externo: boolean;
  /** Âncora de seção da home (Sobre, Contato): `<a>` simples, sem o roteador. */
  ancora: boolean;
}

export const ehPagina = (key: string) => key.startsWith(PREFIXO_PAGINA);
export const ehAba = (key: string) => ABAS.includes(key);
const slugDa = (key: string) => key.slice(PREFIXO_PAGINA.length);

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

function chaveValida(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  return CHAVES_FIXAS.includes(key) || (ehPagina(key) && SLUG_DA_PAGINA.test(slugDa(key)));
}

/** Rótulo como o servidor grava: sem controle nem quebra, espaços juntos, até 40; vazio = null. */
export function rotuloLimpo(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  // Corta por caractere (code point), não por unidade UTF-16: um emoji no
  // limite não vira meio caractere quebrado.
  return t ? [...t].slice(0, ROTULO_MAX).join('').trim() : null;
}

/**
 * Endereço de link externo: só http(s) com host, até 2048. Devolve o `href`
 * do `URL`, que já converte domínio com acento pra punycode
 * (`https://imobiliária.com.br` → `https://xn--imobiliria-….com.br/`).
 */
export function urlExterna(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.length > URL_MAX) return null;
  try {
    const u = new URL(t);
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname) return null;
    // `https://usuario:senha@site` engana quem lê o link: não vale.
    if (u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * O `menu_config` do `/site`, limpo. `null` quando o servidor não mandou (ou
 * mandou algo que não é menu): aí vale o menu de antes do C3.
 * Chave desconhecida ou repetida some; item fixo que faltar entra logo depois
 * da vizinha de fábrica (a mesma regra do servidor).
 */
export function resolverMenu(raw: unknown): MenuDoSite | null {
  const m = objeto(raw);
  if (!m || !Array.isArray(m.items)) return null;

  const vistos = new Set<string>();
  const items: ItemDoMenu[] = [];
  for (const bruto of m.items) {
    const e = objeto(bruto);
    if (!e || !chaveValida(e.key) || vistos.has(e.key)) continue;
    vistos.add(e.key);
    items.push({
      key: e.key,
      label: rotuloLimpo(e.label),
      enabled: typeof e.enabled === 'boolean' ? e.enabled : true,
      page_title: ehPagina(e.key) && typeof e.page_title === 'string' && e.page_title.trim() ? e.page_title.trim() : null,
    });
  }

  const fabrica = [...CHAVES_ANTES_DAS_PAGINAS, ...items.filter(i => ehPagina(i.key)).map(i => i.key), ...CHAVES_DEPOIS_DAS_PAGINAS];
  fabrica.forEach((key, idx) => {
    if (vistos.has(key)) return;
    const vizinha = fabrica.slice(0, idx).reverse().find(k => vistos.has(k));
    const pos = vizinha ? items.findIndex(i => i.key === vizinha) + 1 : 0;
    items.splice(pos, 0, { key, label: null, enabled: true, page_title: null });
    vistos.add(key);
  });

  const external = (Array.isArray(m.external) ? m.external : [])
    .map(bruto => {
      const e = objeto(bruto);
      const label = rotuloLimpo(e?.label);
      const url = urlExterna(e?.url);
      return label && url ? { label, url } : null;
    })
    .filter((x): x is LinkExterno => !!x)
    .slice(0, EXTERNOS_MAX);

  return { items, external, saved: typeof m.saved === 'boolean' ? m.saved : null };
}

/** O menu de antes do C3: os fixos na ordem de sempre e as páginas da lista antiga. */
function menuDeAntes(site: Pick<SiteInfo, 'menu'>): MenuDoSite {
  const paginas = (Array.isArray(site.menu) ? site.menu : [])
    .filter(p => p && p.slug)
    .map((p): ItemDoMenu => ({ key: `${PREFIXO_PAGINA}${p.slug}`, label: null, enabled: true, page_title: p.title ?? '' }));
  const fixo = (key: string): ItemDoMenu => ({ key, label: null, enabled: true, page_title: null });
  return {
    items: [...CHAVES_ANTES_DAS_PAGINAS.map(fixo), ...paginas, ...CHAVES_DEPOIS_DAS_PAGINAS.map(fixo)],
    external: [],
    saved: null,
  };
}

/** O menu que o site mostra: o configurado ou, em servidor velho, o de antes. */
export function menuDoSite(site: Pick<SiteInfo, 'menu' | 'menu_config'>): MenuDoSite {
  return resolverMenu(site.menu_config) ?? menuDeAntes(site);
}

/**
 * O rodapé repete o menu? Quem decide é o servidor, pelo `saved` (o cliente
 * já salvou a tela Menus): `true` repete, mesmo com o menu igual ao de
 * fábrica; `false` fica o rodapé de antes do C3 (Review Focus 5), mesmo se a
 * ordem das páginas parecer diferente (duas na mesma posição).
 *
 * Servidor sem o campo (`saved` null): decide pela comparação com a fábrica,
 * nada de externo nem nome trocado, todo fixo ligado, a ordem de fábrica e as
 * páginas ligadas na ordem da lista antiga. Sem `menu_config`, não.
 */
export function menuPersonalizado(site: Pick<SiteInfo, 'menu' | 'menu_config'>): boolean {
  const m = resolverMenu(site.menu_config);
  if (!m) return false;
  if (typeof m.saved === 'boolean') return m.saved;
  if (m.external.length > 0) return true;
  if (m.items.some(i => i.label !== null || (!ehPagina(i.key) && !i.enabled))) return true;
  const chaves = m.items.map(i => i.key);
  if (chaves.filter(k => !ehPagina(k)).join() !== CHAVES_FIXAS.join()) return true;
  const iAntes = chaves.indexOf('listing'), iDepois = chaves.indexOf('blog');
  if (chaves.some((k, idx) => ehPagina(k) && (idx < iAntes || idx > iDepois))) return true;
  const ligadas = m.items.filter(i => ehPagina(i.key) && i.enabled).map(i => slugDa(i.key));
  const daLista = (Array.isArray(site.menu) ? site.menu : []).filter(p => p && p.slug).map(p => p.slug);
  return Array.isArray(site.menu) && ligadas.join('\n') !== daLista.join('\n');
}

interface OpcoesDoMenu { ctx: CtxDoSite; onHome?: boolean }

/**
 * Os links do menu, na ordem do cliente, com o nome dele e só os ligados.
 * Some o item sem destino: aba sem imóvel (fora de `abas`; sem `abas`, as
 * três), Sobre/Contato com a seção desligada, Financiamento e Anuncie com a
 * página desligada, Blog sem artigo, página que o servidor não confirmou. Os
 * externos vêm no fim. Todo endereço do site sai por `caminhoDoSite`.
 */
export function itensDoMenu(
  site: SiteInfo, abas: AbaId[] | undefined, temBlog: boolean, { ctx, onHome = false }: OpcoesDoMenu,
): LinkDoMenu[] {
  const menu = menuDoSite(site);
  const interno = (chave: string, rotulo: string, rota: string): LinkDoMenu =>
    ({ chave, rotulo, href: caminhoDoSite(ctx, rota), externo: false, ancora: false });
  const secao = (chave: string, rotulo: string, id: string): LinkDoMenu =>
    ({ chave, rotulo, href: onHome ? `#${id}` : caminhoDoSite(ctx, `/#${id}`), externo: false, ancora: true });

  const destino = (item: ItemDoMenu): LinkDoMenu | null => {
    const nome = (fixa: ChaveFixa) => item.label ?? NOME_DE_FABRICA[fixa];
    if (ehPagina(item.key)) {
      if (item.page_title === null) return null;
      return interno(item.key, item.label ?? item.page_title, `/p/${encodeURIComponent(slugDa(item.key))}`);
    }
    switch (item.key as ChaveFixa) {
      case 'sale': case 'rent': case 'launch': {
        const aba = item.key as AbaId;
        return !abas || abas.includes(aba) ? interno(aba, nome(aba), `/imoveis?tab=${aba}`) : null;
      }
      case 'about': return site.sections?.stats !== false ? secao('about', nome('about'), 'sobre') : null;
      case 'contact': return site.sections?.lead_capture !== false ? secao('contact', nome('contact'), 'contato') : null;
      case 'financing': return site.financiamento?.enabled ? interno('financing', nome('financing'), '/financiamento') : null;
      case 'listing': return site.anuncie?.enabled ? interno('listing', nome('listing'), '/anuncie') : null;
      case 'blog': return temBlog ? interno('blog', nome('blog'), '/blog') : null;
      default: return null;
    }
  };

  const itens = menu.items.filter(i => i.enabled).map(destino).filter((l): l is LinkDoMenu => !!l);
  const externos = menu.external.map((e, i): LinkDoMenu => ({ chave: `externo:${i}`, rotulo: e.label, href: e.url, externo: true, ancora: false }));
  return [...itens, ...externos];
}
