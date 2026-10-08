import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import BaseHeader from '@/components/base/BaseHeader';
import { getCustomerMenuSections, getFooterMenuItems } from './config/menuItems';
import { ADMIN_MENU_ITEMS } from './config/adminMenuItems';
import {
  NOME_PADRAO_DA_ABA,
  NomeDaAba,
  montarNomeDaAba,
  paginaNoMenu,
  paginaNoMenuAdmin,
  useNomeDaAba,
} from './nomeDaAba';

function Detalhe({ nome }: { nome: string | null }) {
  useNomeDaAba(nome);
  return null;
}

describe('montarNomeDaAba', () => {
  it('junta item · página · cliente, do mais específico pro mais geral', () => {
    expect(montarNomeDaAba(['João Silva', 'Funil de vendas', 'Moeda Forte'])).toBe('João Silva · Funil de vendas · Moeda Forte');
  });

  it('pula o que falta e não repete a mesma palavra', () => {
    expect(montarNomeDaAba([null, 'Contatos', 'Moeda Forte'])).toBe('Contatos · Moeda Forte');
    expect(montarNomeDaAba(['Contatos', 'contatos', '  Moeda   Forte '])).toBe('Contatos · Moeda Forte');
  });

  it('sem nada, fica LM Flow', () => {
    expect(montarNomeDaAba([undefined, '', '  '])).toBe(NOME_PADRAO_DA_ABA);
  });
});

describe('página pelo menu', () => {
  const secoes = getCustomerMenuSections();
  const rodape = getFooterMenuItems();

  it('usa o item do menu dono do endereço, inclusive nas telas de dentro', () => {
    expect(paginaNoMenu(secoes, rodape, '/pipelines')).toBe('Funil de vendas');
    expect(paginaNoMenu(secoes, rodape, '/pipelines/12/card/34')).toBe('Funil de vendas');
    expect(paginaNoMenu(secoes, rodape, '/properties/9/editar')).toBe('Meus imóveis');
  });

  it('página com abas usa a aba acesa', () => {
    expect(paginaNoMenu(secoes, rodape, '/bolsao/listas')).toBe('Listas e regras');
    expect(paginaNoMenu(secoes, rodape, '/settings/integrations')).toBe('Integrações');
  });

  it('o rodapé do menu também conta; fora do menu não há página', () => {
    expect(paginaNoMenu(secoes, rodape, '/tutorials')).toBe('Guia do LM Flow');
    expect(paginaNoMenu(secoes, rodape, '/profile')).toBeNull();
  });

  it('na Área do Admin, pela aba do menu do admin', () => {
    expect(paginaNoMenuAdmin(ADMIN_MENU_ITEMS, '/admin/clientes/abc')).toBe('Clientes');
    expect(paginaNoMenuAdmin(ADMIN_MENU_ITEMS, '/admin/push')).toBe('Push');
  });
});

describe('NomeDaAba', () => {
  beforeEach(() => { document.title = NOME_PADRAO_DA_ABA; });

  it('escreve página · cliente na aba', () => {
    render(<NomeDaAba pagina="Funil de vendas" cliente="Moeda Forte"><div /></NomeDaAba>);
    expect(document.title).toBe('Funil de vendas · Moeda Forte');
  });

  it('a tela de um registro põe o nome dele na frente, e tira ao sair', () => {
    const { rerender } = render(
      <NomeDaAba pagina="Funil de vendas" cliente="Moeda Forte"><Detalhe nome="João Silva" /></NomeDaAba>,
    );
    expect(document.title).toBe('João Silva · Funil de vendas · Moeda Forte');
    rerender(<NomeDaAba pagina="Funil de vendas" cliente="Moeda Forte"><div /></NomeDaAba>);
    expect(document.title).toBe('Funil de vendas · Moeda Forte');
  });

  it('enquanto carrega (nome vazio), fica só página · cliente', () => {
    render(<NomeDaAba pagina="Meus imóveis" cliente="Moeda Forte"><Detalhe nome={null} /></NomeDaAba>);
    expect(document.title).toBe('Meus imóveis · Moeda Forte');
  });

  it('tela fora do menu usa o título do cabeçalho; dentro do menu, o menu manda', () => {
    const { rerender } = render(
      <NomeDaAba pagina={null} cliente="Moeda Forte"><BaseHeader title="Meu perfil" /></NomeDaAba>,
    );
    expect(document.title).toBe('Meu perfil · Moeda Forte');
    rerender(<NomeDaAba pagina="Roleta de leads" cliente="Moeda Forte"><BaseHeader title="Roleta" /></NomeDaAba>);
    expect(document.title).toBe('Roleta de leads · Moeda Forte');
  });

  it('ao sair da moldura (login, página pública), volta a LM Flow', () => {
    const { unmount } = render(<NomeDaAba pagina="Clientes" cliente="Admin"><div /></NomeDaAba>);
    expect(document.title).toBe('Clientes · Admin');
    unmount();
    expect(document.title).toBe(NOME_PADRAO_DA_ABA);
  });

  it('cabeçalho fora da moldura não quebra nada', () => {
    render(<BaseHeader title="Contatos" />);
    expect(document.title).toBe(NOME_PADRAO_DA_ABA);
  });
});
