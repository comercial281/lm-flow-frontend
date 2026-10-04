import { describe, it, expect } from 'vitest';
import { ADMIN_MENU_ITEMS, donoDoEnderecoAdmin } from './adminMenuItems';

const dono = (p: string) => donoDoEnderecoAdmin(ADMIN_MENU_ITEMS, p);

describe('menu da Área do Admin', () => {
  it('tem os 8 itens, nesta ordem', () => {
    expect(ADMIN_MENU_ITEMS.map(i => i.name)).toEqual([
      'Visão Geral', 'Suporte', 'Clientes', 'Usuários', 'Comunicação', 'Plataforma', 'IA Vendedora', 'Equipe',
    ]);
  });

  it('o endereço do item é o da primeira aba', () => {
    for (const item of ADMIN_MENU_ITEMS) {
      if (item.abas?.length) expect(item.href).toBe(item.abas[0].href);
    }
  });

  it('nenhum endereço de aba se repete', () => {
    const todos = ADMIN_MENU_ITEMS.flatMap(i => i.abas?.map(a => a.href) ?? [i.href]);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it.each([
    ['/admin', 'Visão Geral', 'Dashboard'],
    ['/admin/leads-ao-vivo', 'Visão Geral', 'Leads ao vivo'],
    ['/admin/clientes', 'Clientes', 'Clientes'],
    ['/admin/clientes/numeros', 'Clientes', 'Números conectados'],
    ['/admin/clientes/custos', 'Clientes', 'Custos'],
    ['/admin/usuarios', 'Usuários', 'Usuários'],
    ['/admin/usuarios/tenant_x/8f1c-uuid', 'Usuários', 'Usuários'],
    ['/admin/usuarios/logs', 'Usuários', 'Logs'],
    ['/admin/usuarios/mensagem-de-acesso', 'Usuários', 'Mensagem de acesso'],
    ['/admin/comunicacao', 'Comunicação', 'Avisos na tela'],
    ['/admin/push', 'Comunicação', 'Push'],
    ['/admin/comunicacao/whatsapp', 'Comunicação', 'WhatsApp'],
    ['/admin/academia', 'Plataforma', 'Academia'],
    ['/admin/plataforma/menus-arquivados', 'Plataforma', 'Menus arquivados'],
    ['/admin/plataforma', 'Plataforma', 'Site'],
    ['/admin/plataforma/kit-boas-vindas', 'Plataforma', 'Kit de boas-vindas'],
    ['/admin/agentes', 'IA Vendedora', 'Agentes'],
    ['/admin/agentes/dashboard', 'IA Vendedora', 'Dashboard'],
    ['/admin/agentes/conhecimento', 'IA Vendedora', 'Conhecimento'],
    ['/admin/agentes/aviso-de-visita', 'IA Vendedora', 'Aviso de visita'],
  ])('%s é da aba %s → %s', (pathname, item, aba) => {
    const d = dono(pathname);
    expect(d?.item.name).toBe(item);
    expect(d?.aba?.name).toBe(aba);
  });

  it('Equipe não tem abas e casa pelo endereço do item', () => {
    const d = dono('/admin/equipe');
    expect(d?.item.name).toBe('Equipe');
    expect(d?.aba).toBeUndefined();
  });

  it('Suporte não tem abas e casa a lista e o chamado aberto', () => {
    expect(dono('/admin/suporte')?.item.name).toBe('Suporte');
    expect(dono('/admin/suporte/9b2e-uuid')?.item.name).toBe('Suporte');
    expect(dono('/admin/suporte')?.aba).toBeUndefined();
  });

  it('Sugestões e bugs saiu de Plataforma', () => {
    const plataforma = ADMIN_MENU_ITEMS.find(i => i.name === 'Plataforma');
    expect(plataforma?.abas?.map(a => a.name)).not.toContain('Sugestões e bugs');
  });

  it('endereço desconhecido não tem dono', () => {
    expect(dono('/admin/qualquer-coisa')).toBeNull();
    expect(dono('/dashboard')).toBeNull();
  });
});
