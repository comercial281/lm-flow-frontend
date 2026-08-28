import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PieChart } from 'lucide-react';
import Sidebar from './Sidebar';
import type { MenuItem as MenuItemType } from '../config/menuItems';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

const item = (name: string, href: string): MenuItemType => ({ name, href, icon: PieChart });

const montar = (itens: MenuItemType[], isCollapsed = false) =>
  render(
    <Sidebar
      isCollapsed={isCollapsed}
      menuItems={itens}
      activeSubmenu={null}
      activeMenu={null}
      isMenuWithSubItemsActive={() => false}
      handleMenuClick={() => {}}
      setActiveSubmenu={() => {}}
    />,
    { wrapper: MemoryRouter },
  );

// Ordem padrão: cada grupo inteiro e junto.
const ORDEM_PADRAO: MenuItemType[] = [
  item('Dashboard', '/dashboard'),
  item('Conversas', '/conversations'),
  item('Imóveis', '/properties'),
  item('Books', '/books'),
  item('Visitas', '/visits'),
];

// ⚠️ A lista que chega na Sidebar NÃO é a do menuItems.ts: o MainLayout passa o
// resultado do applyMenuPrefs, que sobe os favoritos pro topo. Favoritar um item
// de Imobiliário basta pra lista chegar intercalada.
const COM_FAVORITO: MenuItemType[] = [
  item('Imóveis', '/properties'),   // favoritado -> subiu
  item('Dashboard', '/dashboard'),
  item('Conversas', '/conversations'),
  item('Books', '/books'),          // Imobiliário de novo, agora lá embaixo
  item('Visitas', '/visits'),
];

describe('Cabeçalhos de grupo da sidebar', () => {
  it('na ordem padrão, cada grupo aparece uma vez', () => {
    montar(ORDEM_PADRAO);
    expect(screen.getAllByText('Principal')).toHaveLength(1);
    expect(screen.getAllByText('Imobiliário')).toHaveLength(1);
  });

  it('com a ordem personalizada, NENHUM cabeçalho aparece', () => {
    // Antes deste conserto saíam dois "Imobiliário": o código só suprimia
    // repetição consecutiva. Rótulo repetido é rótulo mentindo sobre o que está
    // embaixo dele — então some inteiro em vez de sair errado.
    montar(COM_FAVORITO);
    expect(screen.queryByText('Imobiliário')).toBeNull();
    expect(screen.queryByText('Principal')).toBeNull();
  });

  it('com a sidebar recolhida, nenhum cabeçalho aparece', () => {
    montar(ORDEM_PADRAO, true);
    expect(screen.queryByText('Principal')).toBeNull();
  });
});
