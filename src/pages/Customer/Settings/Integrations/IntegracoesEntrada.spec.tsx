import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MenuProvider } from '@/contexts/MenuContext';
import { getCustomerMenuSections, type MenuSection, type MenuItem } from '@/components/layout/config/menuItems';
import IntegracoesEntrada from './IntegracoesEntrada';

const integracoes = getCustomerMenuSections().flatMap(s => s.itens).find(i => i.name === 'Integrações')!;
const comTelas = (hrefs: string[]): MenuSection[] => {
  const item: MenuItem = { ...integracoes, abas: integracoes.abas!.filter(a => hrefs.includes(a.href)) };
  return [{ id: 'imobiliaria', rotulo: 'Minha imobiliária', itens: [item] }];
};
const montar = (secoes: MenuSection[]) => render(
  <MemoryRouter><MenuProvider value={secoes}><IntegracoesEntrada /></MenuProvider></MemoryRouter>,
);

describe('Integrações · página de entrada', () => {
  it('mostra os quatro cartões com nome e frase, cada um como link', () => {
    montar(comTelas(['/channels', '/settings/facebook', '/settings/pixel-capi', '/settings/portals', '/settings/cvcrm']));
    expect(screen.getByRole('heading', { name: 'Integrações' })).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links.map(l => l.getAttribute('href'))).toEqual(['/channels', '/settings/facebook', '/settings/portals', '/settings/integrations/sistemas']);
    expect(screen.getByRole('link', { name: /Facebook.*Página dos anúncios e Pixel/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sistemas.*Mande os leads pro sistema que você já usa/ })).toBeInTheDocument();
  });

  it('só com o Pixel: um cartão, que leva ao Pixel', () => {
    montar(comTelas(['/settings/pixel-capi']));
    expect(screen.getAllByRole('link').map(l => l.getAttribute('href'))).toEqual(['/settings/pixel-capi']);
  });

  it('sem nenhuma tela: avisa em vez de ficar em branco', () => {
    montar([]);
    expect(screen.getByText('Nenhuma integração disponível pro seu acesso.')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toEqual([]);
  });
});
