import { createContext, useContext } from 'react';
import type { MenuSection } from '@/components/layout/config/menuItems';

// O menu JÁ FILTRADO (cargo, função do cliente, arquivamento) que o MainLayout
// monta. As páginas com abas leem daqui — a mesma lista que desenha o menu —
// para menu e abas nunca discordarem sobre o que a pessoa vê.
const MenuContext = createContext<MenuSection[]>([]);

export const MenuProvider = MenuContext.Provider;

export function useMenuSecoes(): MenuSection[] {
  return useContext(MenuContext);
}
