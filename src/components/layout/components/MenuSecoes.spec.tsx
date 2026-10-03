import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PieChart, Building2, Users, Inbox, Contact, Hand, ListChecks } from 'lucide-react';
import MenuSecoes from './MenuSecoes';
import type { MenuSection } from '../config/menuItems';

const SECOES: MenuSection[] = [
  { id: 'principal', rotulo: 'Principal', fixa: true, itens: [{ name: 'Dashboard', href: '/dashboard', icon: PieChart }] },
  { id: 'imoveis', rotulo: 'Imóveis', icone: Building2, itens: [{ name: 'Meus imóveis', href: '/properties', icon: Building2 }] },
  {
    id: 'leads', rotulo: 'Leads', icone: Users, itens: [
      { name: 'Contatos', href: '/contacts', icon: Contact },
      {
        name: 'Bolsão', href: '/bolsao', icon: Inbox, abas: [
          { name: 'Pegar leads', href: '/bolsao', icon: Hand, exata: true },
          { name: 'Listas e regras', href: '/bolsao/listas', icon: ListChecks },
        ],
      },
    ],
  },
];

const montar = (endereco: string) =>
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <MenuSecoes secoes={SECOES} />
    </MemoryRouter>,
  );

const secao = (nome: string) => screen.getByRole('button', { name: nome });

describe('menu em seções', () => {
  it('o Principal fica sempre visível, sem cabeçalho', () => {
    montar('/properties');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Principal' })).toBeNull();
  });

  it('abre sozinha a seção da página atual, inclusive pela aba de um item', () => {
    montar('/bolsao/listas');
    expect(secao('Leads').getAttribute('aria-expanded')).toBe('true');
    expect(secao('Imóveis').getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('link', { name: 'Bolsão' }).getAttribute('aria-current')).toBe('page');
  });

  it('só uma seção aberta por vez', () => {
    montar('/dashboard');
    fireEvent.click(secao('Imóveis'));
    expect(screen.getByRole('link', { name: 'Meus imóveis' })).toBeTruthy();
    fireEvent.click(secao('Leads'));
    expect(screen.queryByRole('link', { name: 'Meus imóveis' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Contatos' })).toBeTruthy();
  });

  it('clicar na seção aberta fecha', () => {
    montar('/contacts');
    fireEvent.click(secao('Leads'));
    expect(screen.queryByRole('link', { name: 'Contatos' })).toBeNull();
  });
});

describe('bolinha de novidade no menu em seções', () => {
  const comNovidade: MenuSection[] = [
    SECOES[0],
    { id: 'imoveis', rotulo: 'Imóveis', icone: Building2, itens: [{ name: 'Meus imóveis', href: '/properties', icon: Building2, marcador: true }] },
    SECOES[2],
  ];

  it('seção fechada mostra a bolinha no cabeçalho; aberta, no item', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><MenuSecoes secoes={comNovidade} /></MemoryRouter>);
    expect(secao('Imóveis').querySelector('[data-marcador]')).toBeTruthy();
    expect(secao('Leads').querySelector('[data-marcador]')).toBeNull();
    fireEvent.click(secao('Imóveis'));
    expect(secao('Imóveis').querySelector('[data-marcador]')).toBeNull();
    expect(screen.getByRole('link', { name: /Meus imóveis/ })).toContainElement(screen.getByLabelText('Novidade'));
  });
});
