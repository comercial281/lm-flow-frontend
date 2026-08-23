// Preferências do menu lateral por usuário (persistidas no navegador):
// esconder itens, favoritar (sobe pro topo) e reordenar. Aplicado em cima do
// menu já filtrado por permissão — não dá pra "ver" item que você não tem acesso.
export interface MenuPrefs {
  hidden: string[];    // hrefs escondidos
  favorites: string[]; // hrefs favoritados (vão pro topo)
  order: string[];     // ordem manual (por href)
}

const KEY = 'lmflow:menu_prefs';
export const MENU_PREFS_EVENT = 'lmflow:menu-prefs-changed';

export function loadMenuPrefs(): MenuPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { hidden: raw.hidden || [], favorites: raw.favorites || [], order: raw.order || [] };
  } catch {
    return { hidden: [], favorites: [], order: [] };
  }
}

export function saveMenuPrefs(p: MenuPrefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* noop */ }
  try { window.dispatchEvent(new Event(MENU_PREFS_EVENT)); } catch { /* noop */ }
}

export function resetMenuPrefs(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  try { window.dispatchEvent(new Event(MENU_PREFS_EVENT)); } catch { /* noop */ }
}

// Aplica as prefs num array de itens (qualquer um com href). Esconde os
// hidden, joga favoritos pro topo, e respeita a ordem manual.
export function applyMenuPrefs<T extends { href: string }>(items: T[]): T[] {
  const p = loadMenuPrefs();
  const visible = items.filter(i => !p.hidden.includes(i.href));

  const orderIndex = (href: string) => {
    const i = p.order.indexOf(href);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const byOrder = (a: T, b: T) => orderIndex(a.href) - orderIndex(b.href);

  const fav = visible.filter(i => p.favorites.includes(i.href)).sort(byOrder);
  const rest = visible.filter(i => !p.favorites.includes(i.href)).sort(byOrder);
  return [...fav, ...rest];
}
