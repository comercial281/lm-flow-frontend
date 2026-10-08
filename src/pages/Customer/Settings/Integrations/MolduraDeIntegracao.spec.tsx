import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MenuProvider } from '@/contexts/MenuContext';
import { getCustomerMenuSections, type MenuSection, type MenuItem } from '@/components/layout/config/menuItems';
import { Pagina, BaseHeader } from '@/components/base';
import MolduraDeIntegracao from './MolduraDeIntegracao';

const Tela = ({ texto, titulo }: { texto: string; titulo: string }) => (
  <Pagina cabecalho={<BaseHeader title={titulo} />}><p>{texto}</p></Pagina>
);

const integracoes = getCustomerMenuSections().flatMap(s => s.itens).find(i => i.name === 'Integrações')!;
const gestor: MenuSection[] = [{ id: 'imobiliaria', rotulo: 'Minha imobiliária', itens: [integracoes as MenuItem] }];

const abrir = (endereco: string, secoes: MenuSection[]) => render(
  <MemoryRouter initialEntries={[endereco]}>
    <MenuProvider value={secoes}>
      <Routes>
        <Route element={<MolduraDeIntegracao />}>
          <Route path="/channels" element={<Tela titulo="WhatsApp" texto="tela de números" />} />
          <Route path="/settings/cvcrm" element={<Tela titulo="CVCRM" texto="tela do cvcrm" />} />
          <Route path="/settings/integrations" element={<p>entrada</p>} />
        </Route>
      </Routes>
    </MenuProvider>
  </MemoryRouter>,
);

describe('moldura das telas de Integrações', () => {
  it('gestor no WhatsApp: só o ← Integrações; o título é um só, o da página', () => {
    abrir('/channels', gestor);
    expect(screen.getByRole('link', { name: /Integrações/ })).toHaveAttribute('href', '/settings/integrations');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.querySelectorAll('main')).toHaveLength(0);
    expect(screen.getByText('tela de números')).toBeInTheDocument();
  });

  it('corretor em Meus números (sem Integrações no menu): só a tela, sem voltar', () => {
    abrir('/channels', []);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('tela de números')).toBeInTheDocument();
  });

  it('no CVCRM o voltar leva a Sistemas', () => {
    abrir('/settings/cvcrm', gestor);
    expect(screen.getByRole('link', { name: /Sistemas/ })).toHaveAttribute('href', '/settings/integrations/sistemas');
  });

  it('na entrada não desenha barra', () => {
    abrir('/settings/integrations', gestor);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('entrada')).toBeInTheDocument();
  });
});
