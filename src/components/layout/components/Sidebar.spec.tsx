import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PieChart } from 'lucide-react';
import Sidebar from './Sidebar';
import type { MenuSection } from '../config/menuItems';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

const SECOES: MenuSection[] = [
  { id: 'principal', rotulo: 'Principal', fixa: true, itens: [{ name: 'Dashboard', href: '/dashboard', icon: PieChart }] },
];

const montar = (isCollapsed: boolean) =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Sidebar isCollapsed={isCollapsed} secoes={SECOES} rodape={[]} />
    </MemoryRouter>,
  );

describe('menu lateral: abre e fecha com movimento', () => {
  it.each([true, false])('anima a largura e respeita movimento reduzido (recolhido=%s)', isCollapsed => {
    montar(isCollapsed);
    const menu = screen.getByRole('complementary', { name: 'Menu lateral' });
    expect(menu.className).toContain('transition-[width]');
    expect(menu.className).toContain('duration-200');
    expect(menu.className).toContain('ease-out');
    expect(menu.className).toContain('motion-reduce:transition-none');
    expect(menu.className).toContain('overflow-hidden');
    expect(menu.className).toContain(isCollapsed ? 'w-16' : 'w-60');
  });
});
