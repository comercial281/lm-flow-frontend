import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

describe('menu lateral: cobre e revela', () => {
  const rodar = (isCollapsed: boolean) => (
    <MemoryRouter initialEntries={['/dashboard']}>
      <Sidebar isCollapsed={isCollapsed} secoes={SECOES} rodape={[]} />
    </MemoryRouter>
  );

  it('ao recolher mantém o conteúdo aberto até a largura fechar; ao abrir troca na hora', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(rodar(false));
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();

      rerender(rodar(true));
      act(() => { vi.advanceTimersByTime(199); });
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy(); // ainda aberto
      act(() => { vi.advanceTimersByTime(2); });
      expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull(); // virou ícone

      rerender(rodar(false));
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy(); // na hora
    } finally {
      vi.useRealTimers();
    }
  });
});
