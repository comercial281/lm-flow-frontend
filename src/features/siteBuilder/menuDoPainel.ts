// Menu do site como a tela Menus edita (Meu site › Personalizar › Menus, C3).
//
// O admin manda `site.menu` já resolvido pelo servidor (Sites::MenuConfig.resolve):
// os itens fixos, TODAS as páginas do site (ativas ou não) com `page_title`, e o
// `enabled` de cada página = o `in_menu` dela (a caixinha "Exibir no menu" da
// tela Páginas). A leitura usa o mesmo `resolverMenu` do site público.
//
// No Salvar vai o `menuParaGravar`: cada item com `{ key, label, enabled }`. O
// item de página leva SEMPRE o `enabled`: ausente, o servidor entende "ligado"
// e grava `in_menu = true` na página (ele grava o in_menu junto com o menu).
import type { MenuDoPainel, MenuParaGravar, SitePage } from '@/services/siteBuilder/siteBuilderService';
import {
  CHAVES_ANTES_DAS_PAGINAS, CHAVES_DEPOIS_DAS_PAGINAS, EXTERNOS_MAX, NOME_DE_FABRICA, PREFIXO_PAGINA,
  ehPagina, resolverMenu, rotuloLimpo, urlExterna, type ChaveFixa,
} from './public/menuConfig';

export { EXTERNOS_MAX };

/** Menu de fábrica, sem páginas (servidor velho, que não manda `menu` no admin). */
export function menuDeFabrica(): MenuDoPainel {
  return {
    items: [...CHAVES_ANTES_DAS_PAGINAS, ...CHAVES_DEPOIS_DAS_PAGINAS]
      .map(key => ({ key, label: null, enabled: true, page_title: null })),
    external: [],
  };
}

/** O `menu` do admin pronto pra tela. Lixo ou ausente = o de fábrica. */
export function menuDoPainel(raw: unknown): MenuDoPainel {
  return resolverMenu(raw) ?? menuDeFabrica();
}

/** O nome que o site mostra quando o item não tem nome próprio (o placeholder do campo). */
export function nomeDeFabrica(item: { key: string; page_title: string | null }): string {
  if (ehPagina(item.key)) return item.page_title || item.key.slice(PREFIXO_PAGINA.length);
  return NOME_DE_FABRICA[item.key as ChaveFixa] ?? item.key;
}

/**
 * Avisos de um link externo, campo a campo (null = sem aviso). O servidor
 * descarta em silêncio link sem nome ou fora de http(s): a tela avisa antes.
 */
export function avisosDoExterno(e: { label: string; url: string }): { nome: string | null; endereco: string | null } {
  const url = e.url.trim();
  return {
    nome: rotuloLimpo(e.label) ? null : 'Sem nome, o link não é salvo.',
    endereco: !url
      ? 'Sem endereço, o link não é salvo.'
      : urlExterna(url) ? null : 'Sem um endereço que comece com http:// ou https://, o link não é salvo.',
  };
}

/**
 * O que viaja no Salvar. Nome em branco = null (o nome de fábrica). Link
 * externo sem nome ou fora de http(s) não vai (a tela já avisou); o endereço
 * sai pelo `new URL(...).href`, que converte domínio com acento
 * (`imobiliária.com.br` → `xn--imobiliria-….com.br`): o servidor recusaria o
 * acento e o link sumiria sem aviso.
 */
export function menuParaGravar(m: MenuDoPainel): MenuParaGravar {
  return {
    items: m.items.map(i => ({ key: i.key, label: rotuloLimpo(i.label), enabled: i.enabled === true })),
    external: m.external
      .map(e => {
        const label = rotuloLimpo(e.label);
        const url = urlExterna(e.url);
        return label && url ? { label, url } : null;
      })
      .filter((e): e is { label: string; url: string } => !!e)
      .slice(0, EXTERNOS_MAX),
  };
}

const chaveDa = (slug: string) => `${PREFIXO_PAGINA}${slug}`;

/** Onde uma página nova entra: depois da última página, senão depois do Anuncie, senão antes do Blog. */
function posicaoDePaginaNova(items: MenuDoPainel['items']): number {
  let ultimaPagina = -1;
  items.forEach((i, idx) => { if (ehPagina(i.key)) ultimaPagina = idx; });
  if (ultimaPagina >= 0) return ultimaPagina + 1;
  const anuncie = items.findIndex(i => i.key === 'listing');
  if (anuncie >= 0) return anuncie + 1;
  const blog = items.findIndex(i => i.key === 'blog');
  return blog >= 0 ? blog : items.length;
}

/**
 * O menu da tela depois que uma página foi criada ou salva na tela Páginas.
 * Espelha o servidor: o liga/desliga da página é o `in_menu` dela e o nome de
 * fábrica é o título. Endereço trocado = outra chave: o item antigo some e o
 * novo entra como página nova, sem o nome e a posição que tinha (o servidor
 * faz o mesmo). Landing de anúncio não é item do menu.
 */
export function menuComPagina(m: MenuDoPainel, pagina: SitePage, slugAntigo?: string): MenuDoPainel {
  if (pagina.page_kind === 'ad_landing') return m;
  const chave = chaveDa(pagina.slug);
  const antiga = slugAntigo && slugAntigo !== pagina.slug ? chaveDa(slugAntigo) : null;
  const items = m.items.filter(i => i.key !== antiga);
  const idx = items.findIndex(i => i.key === chave);
  if (idx >= 0) {
    items[idx] = { ...items[idx], enabled: pagina.in_menu === true, page_title: pagina.title };
  } else {
    items.splice(posicaoDePaginaNova(items), 0,
      { key: chave, label: null, enabled: pagina.in_menu === true, page_title: pagina.title });
  }
  return { ...m, items };
}

/** O menu da tela depois que uma página foi excluída. */
export function menuSemPagina(m: MenuDoPainel, slug: string): MenuDoPainel {
  return { ...m, items: m.items.filter(i => i.key !== chaveDa(slug)) };
}
