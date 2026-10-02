import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { PieChart, Building2, Users, Contact, Inbox } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/ds';
import MenuRecolhido from './MenuRecolhido';
import type { MenuSection } from '../config/menuItems';

const SECOES: MenuSection[] = [
  { id: 'principal', rotulo: 'Principal', fixa: true, itens: [{ name: 'Dashboard', href: '/dashboard', icon: PieChart }] },
  { id: 'imoveis', rotulo: 'Imóveis', icone: Building2, itens: [{ name: 'Meus imóveis', href: '/properties', icon: Building2 }] },
  {
    id: 'leads', rotulo: 'Leads', icone: Users, itens: [
      { name: 'Contatos', href: '/contacts', icon: Contact },
      { name: 'Bolsão', href: '/bolsao', icon: Inbox },
    ],
  },
  { id: 'vazia', rotulo: 'Vazia', icone: Inbox, itens: [] },
];

function Endereco() {
  return <span data-testid="endereco">{useLocation().pathname}</span>;
}

const montar = (endereco: string) =>
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <TooltipProvider>
        <MenuRecolhido secoes={SECOES} />
        <Endereco />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe('menu recolhido', () => {
  it('mostra os itens da seção fixa e esconde os das outras até abrir', () => {
    montar('/dashboard');
    // Recolhido, o link da seção fixa só tem ícone (o nome vem no tooltip): acha pelo endereço.
    expect(document.querySelector('a[href="/dashboard"]')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Meus imóveis' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Contatos' })).toBeNull();
  });

  it('um botão por seção não fixa, com o rótulo como nome', () => {
    montar('/dashboard');
    expect(screen.getByRole('button', { name: 'Imóveis' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Leads' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Principal' })).toBeNull();
  });

  it('clicar no botão abre a lista; clicar num link navega e fecha', () => {
    montar('/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Leads' }));
    expect(screen.getByRole('link', { name: 'Contatos' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bolsão' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Contatos' }));
    expect(screen.getByTestId('endereco').textContent).toBe('/contacts');
    expect(screen.queryByRole('link', { name: 'Bolsão' })).toBeNull();
  });

  it('o endereço dentro de uma seção marca só o botão dela como ativo', () => {
    montar('/contacts');
    expect(screen.getByRole('button', { name: 'Leads' }).className).toContain('text-primary');
    expect(screen.getByRole('button', { name: 'Imóveis' }).className).not.toContain('text-primary');
  });

  it('seção sem itens não renderiza botão', () => {
    montar('/dashboard');
    expect(screen.queryByRole('button', { name: 'Vazia' })).toBeNull();
  });
});
