import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MenuProvider } from '@/contexts/MenuContext';
import { getCustomerMenuSections, type MenuSection, type MenuItem } from '@/components/layout/config/menuItems';
import PaginaComAbas from './PaginaComAbas';
import Pagina from './Pagina';
import BaseHeader from './BaseHeader';

const bolsao = getCustomerMenuSections().flatMap(s => s.itens).find(i => i.name === 'Bolsão')!;

// Menu do gestor: o item com as duas abas. Menu do corretor: só uma aba.
function menu(abas: number): MenuSection[] {
  const item = { ...(bolsao as MenuItem), abas: (bolsao.abas ?? []).slice(0, abas) } as MenuItem;
  return [{ id: 'leads', rotulo: 'Leads', itens: [item] }];
}

const renderNoBolsao = (endereco: string, { abas }: { abas: number }, tela: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <MenuProvider value={menu(abas)}>
        <Routes>
          <Route element={<PaginaComAbas />}>
            <Route path="/bolsao" element={tela} />
          </Route>
        </Routes>
      </MenuProvider>
    </MemoryRouter>,
  );

describe('PaginaComAbas (moldura sem título)', () => {
  it('com duas abas, não desenha título e entrega as abas pra Pagina', () => {
    renderNoBolsao('/bolsao', { abas: 2 }, <Pagina cabecalho={<BaseHeader title="Bolsão" />} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const h1 = screen.getByRole('heading', { level: 1, name: 'Bolsão' });
    const abas = screen.getByRole('navigation', { name: /Abas de Bolsão/ });
    expect(h1.compareDocumentPosition(abas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelectorAll('main')).toHaveLength(0);
  });

  it('com uma aba (corretor), não desenha nada além da página', () => {
    renderNoBolsao('/bolsao', { abas: 1 }, <Pagina cabecalho={<BaseHeader title="Bolsão" />} />);
    expect(screen.queryByRole('navigation', { name: /Abas de Bolsão/ })).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
