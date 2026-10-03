import { describe, it, expect } from 'vitest';
import {
  getCustomerMenuSections, getFooterMenuItems, shouldShowMenuItem, filterMenuSections,
  itensDoMenu, donoDoEndereco, MENU_FREE_BY_DESIGN,
  type MenuItem, type SubMenuItem,
} from './menuItems';
import { permissionForPath } from '@/routes/permissionRoutes';

const secoes = getCustomerMenuSections();
const todos: (MenuItem | SubMenuItem)[] = itensDoMenu(secoes, getFooterMenuItems());
// O pai de um item com abas herda o href da primeira aba; quem confere cargo é a aba.
const folhas = todos.filter(i => !('abas' in i && i.abas?.length));
const achar = (href: string) => folhas.find(i => i.href === href)!;
const semCargo = (i: MenuItem | SubMenuItem) => !(i.resource && i.action) && !(i.permissions && i.permissions.length > 0);

// Cargo Corretor de fábrica (backend: PermissionsController::AGENT_PERMISSIONS).
const CORRETOR = new Set(`
  dashboard.read profile.read profile.update
  properties.read properties.map properties.cep_lookup
  property_photos.read property_interests.read visits.read visits.create proposals.read
  contacts.read contacts.create contacts.update
  conversations.read conversations.create conversations.update
  pipelines.read pipeline_stages.read pipeline_items.create labels.read canned_responses.read
  quick_replies.read macros.read person_roles.read dynamic_forms.read sites.read site_leads.read
  reports.read summary_reports.read capi_events.read bolsao_leads.read bolsao_leads.claim
  inboxes.read channels.read channels.update
`.split(/\s+/).filter(Boolean));

const comCargo = (chaves: Set<string>) => {
  const can = (r: string, a: string) => chaves.has(`${r}.${a}`);
  const um = (ps: string[]) => ps.some(p => chaves.has(p));
  const todas = (ps: string[]) => ps.every(p => chaves.has(p));
  const funcoes = { bolsao: true, client_manage_automations: true };
  return filterMenuSections(secoes, can, um, todas, 'agent', 'c@x.com', funcoes, [], false);
};

describe('o menu do CRM confere o cargo', () => {
  it('todo item e toda aba declaram a permissão que o servidor exige (ou são livres por decisão registrada)', () => {
    const faltando = folhas.filter(i => semCargo(i) && !MENU_FREE_BY_DESIGN.includes(i.href)).map(i => i.href);
    expect(faltando).toEqual([]);
  });

  it.each([
    ['/disparos', 'broadcasts.read'],
    ['/ia-vendedora', 'sales_agents.read'],
    ['/properties', 'properties.read'],
    ['/books', 'properties.read'],
    ['/property-owners', 'properties.read'],
    ['/settings/portals', 'portals.read'],
    ['/visits', 'visits.read'],
    ['/automations/message-funnels', 'message_funnels.read'],
    ['/settings/pixel-capi', 'capi_configs.read'],
    ['/settings/facebook', 'lead_ads_form_configs.read'],
    ['/automations/origem', 'lead_ads_form_configs.read'],
  ])('%s pede %s', (href, chave) => {
    const item = achar(href);
    expect(`${item.resource}.${item.action}`).toBe(chave);
  });

  it.each([
    ['/channels', ['channels.read', 'inboxes.update']],
    ['/settings/labels', ['labels.read', 'labels.create']],
    ['/settings/template-variables', ['canned_responses.read', 'canned_responses.create']],
    ['/settings/site-builder', ['sites.read', 'sites.update']],
  ])('tela de gestão %s pede a chave da rota E uma de escrita', (href, chaves) => {
    const item = achar(href);
    expect(item.permissions).toEqual(chaves);
    expect(item.requireAll).toBe(true);
    // A primeira é sempre a da rota — o menu nunca oferece o que a rota recusa.
    const rota = permissionForPath(href)!;
    expect(chaves[0]).toBe(`${rota.resource}.${rota.action}`);
  });

  it('Tutoriais é o único livre', () => {
    expect([...MENU_FREE_BY_DESIGN]).toEqual(['/tutorials']);
  });

  it('o Corretor não vê IA Vendedora mesmo com a função liberada no cliente', () => {
    const can = (r: string, a: string) => `${r}.${a}` !== 'sales_agents.read';
    expect(shouldShowMenuItem(achar('/ia-vendedora'), can, () => false, () => false, 'agent', 'c@x.com',
      { client_manage_automations: true }, [], false)).toBe(false);
  });

  it('o suporte vem do parâmetro, não do e-mail', () => {
    const ia = achar('/ia-vendedora');
    const pode = () => true;
    expect(shouldShowMenuItem(ia, pode, pode, pode, 'admin', 'freela@gmail.com', {}, [], true)).toBe(true);
    expect(shouldShowMenuItem(ia, pode, pode, pode, 'admin', 'comercial@lealmidia.com.br', {}, [], false)).toBe(false);
  });

  // Ruling do controlador (fonte única de chave): todo item com resource/action
  // cujo href está no mapa de rotas declara EXATAMENTE a chave daquele mapa.
  it('todo item com resource/action cujo href está no mapa de rotas usa a MESMA chave do mapa', () => {
    const divergentes = folhas
      .filter(i => i.resource && i.action)
      .map(i => ({ href: i.href, item: `${i.resource}.${i.action}`, mapa: permissionForPath(i.href) }))
      .filter(({ mapa, item }) => mapa && `${mapa.resource}.${mapa.action}` !== item);
    expect(divergentes).toEqual([]);
  });
});

describe('menu novo: seções (fase 4)', () => {
  it('o Corretor de fábrica vê só Principal, Imóveis e Leads', () => {
    const vistas = comCargo(CORRETOR);
    expect(vistas.map(s => s.id)).toEqual(['principal', 'imoveis', 'leads']);
    // Gestão de proprietários passa no cargo; quem tira do corretor sem
    // proprietário liberado é o `aplicarProprietariosNoMenu`, no MainLayout.
    expect(vistas.flatMap(s => s.itens.map(i => i.name))).toEqual([
      'Dashboard', 'Conversas', 'Funil de vendas', 'Visitas', 'Meus imóveis', 'Gestão de proprietários', 'Books', 'Contatos', 'Bolsão',
    ]);
  });

  it('Gestão de proprietários fica em Imóveis, logo depois de Meus imóveis', () => {
    const imoveis = secoes.find(s => s.id === 'imoveis')!;
    expect(imoveis.itens.map(i => i.href).slice(0, 2)).toEqual(['/properties', '/property-owners']);
    const item = imoveis.itens[1];
    expect(item.featureKey).toBe('properties');
    expect(item.marcador).toBeUndefined();
  });

  it('o Bolsão do Corretor fica com uma aba só (Listas e regras é do gestor)', () => {
    const bolsao = comCargo(CORRETOR).flatMap(s => s.itens).find(i => i.name === 'Bolsão')!;
    expect(bolsao.abas?.map(a => a.name)).toEqual(['Pegar leads']);
    expect(bolsao.href).toBe('/bolsao');
  });

  it('item com abas leva para a primeira aba que sobreviveu ao cargo', () => {
    const soPortais = new Set(['portals.read']);
    const integracoes = comCargo(soPortais).flatMap(s => s.itens).find(i => i.name === 'Integrações')!;
    expect(integracoes.href).toBe('/settings/portals');
    expect(integracoes.abas?.map(a => a.name)).toEqual(['Portais']);
  });

  it('seção sem nenhum item visível some', () => {
    expect(comCargo(new Set(['dashboard.read'])).map(s => s.id)).toEqual(['principal']);
  });

  it('as telas que saíram do menu não voltam por engano', () => {
    const hrefs = todos.map(i => i.href);
    for (const fora of ['/proposals', '/contracts', '/property-capture-requests', '/property-interests',
      '/contacts/scheduled-actions', '/marketplace', '/automations']) {
      expect(hrefs).not.toContain(fora);
    }
  });

  it('a Página do Facebook é aba de Integrações, e Formulários fica sozinho em Minha imobiliária', () => {
    const imobiliaria = secoes.find(s => s.id === 'imobiliaria')!;
    const integracoes = imobiliaria.itens.find(i => i.name === 'Integrações')!;
    expect(integracoes.abas?.map(a => a.name)).toEqual(['WhatsApp', 'Facebook', 'Pixel', 'Portais']);
    expect(imobiliaria.itens.find(i => i.href === '/automations/origem')?.name).toBe('Formulários');
  });

  it('o dono do endereço é o casamento mais longo, inclusive em tela interna', () => {
    expect(donoDoEndereco(secoes, '/automations/flow-builder/42')?.item.name).toBe('Automações');
    expect(donoDoEndereco(secoes, '/bolsao/listas')?.aba?.name).toBe('Listas e regras');
    expect(donoDoEndereco(secoes, '/bolsao')?.aba?.name).toBe('Pegar leads');
    expect(donoDoEndereco(secoes, '/pipelines/7')?.secao.id).toBe('principal');
    expect(donoDoEndereco(secoes, '/profile')).toBeNull();
  });
});

describe('Automações · sprint 2 (03/10/2026)', () => {
  const vendas = secoes.find(s => s.id === 'vendas')!;

  it('Vendas e automação: Funis de mensagem, Disparos, IA Vendedora, Follow-up e Automações, sem abas', () => {
    expect(vendas.itens.map(i => i.name)).toEqual(['Funis de mensagem', 'Disparos', 'IA Vendedora', 'Follow-up', 'Automações']);
    vendas.itens.forEach(i => expect(i.abas ?? []).toEqual([]));
  });

  it('Funis de mensagem abre o editor de funis', () => {
    expect(vendas.itens.find(i => i.name === 'Funis de mensagem')?.href).toBe('/automations/message-funnels');
  });

  it('Automações abre direto a lista de fluxos, com a chave do construtor', () => {
    const automacoes = vendas.itens.find(i => i.name === 'Automações')!;
    expect(automacoes.href).toBe('/automations/flow-builder');
    expect(`${automacoes.resource}.${automacoes.action}`).toBe('flow_automations.read');
    expect(automacoes.clientToggleKey).toBe('client_manage_automations');
  });

  it('o canvas de um fluxo acende Automações, sem fileira de abas', () => {
    const dono = donoDoEndereco(secoes, '/automations/flow-builder/abc');
    expect(dono?.item.name).toBe('Automações');
    expect(dono?.aba).toBeUndefined();
  });

  it('Regras de lead e Lembretes saíram do menu (abrem só pelo endereço), e "FlowBuilder" não aparece', () => {
    const hrefs = todos.map(i => i.href);
    expect(hrefs).not.toContain('/automations/lead-automations');
    expect(hrefs).not.toContain('/automations/whatsapp-reminders');
    expect(todos.map(i => i.name)).not.toContain('FlowBuilder');
    expect(todos.map(i => i.name)).not.toContain('Fluxos de mensagem');
    expect(donoDoEndereco(secoes, '/automations/lead-automations')).toBeNull();
  });
});
