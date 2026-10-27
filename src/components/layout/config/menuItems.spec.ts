import { describe, it, expect } from 'vitest';
import {
  getCustomerMenuSections, getFooterMenuItems, shouldShowMenuItem, filterMenuSections,
  itensDoMenu, donoDoEndereco, itemAtivo, MENU_FREE_BY_DESIGN, ENTRADA_INTEGRACOES, SISTEMAS_INTEGRACOES,
  secoesDoCelular,
  type MenuItem, type SubMenuItem,
} from './menuItems';
import { permissionForPath } from '@/routes/permissionRoutes';

const secoes = getCustomerMenuSections();
const todos: (MenuItem | SubMenuItem)[] = itensDoMenu(secoes, getFooterMenuItems());
// O pai de um item com abas herda o href da primeira aba (ou a `entrada`, quando houver); quem confere cargo é a aba.
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
  message_funnels.read message_funnels.create message_funnels.update message_funnels.delete
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

  it('Disparos abre com a leitura ou com Disparos próprios', () => {
    expect(achar('/disparos').permissions).toEqual(['broadcasts.read', 'broadcasts.own']);
  });

  it.each([
    ['/disparos', 'broadcasts.read'],
    ['/ia-vendedora', 'sales_agents.read'],
    ['/properties', 'properties.read'],
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
    ['/settings/listas', ['pipelines.read', 'pipelines.update']],
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

  it('rota com várias chaves no mapa: o item do menu declara as MESMAS chaves, na mesma ordem', () => {
    const divergentes = folhas
      .map(i => ({ href: i.href, item: i.permissions, mapa: permissionForPath(i.href)?.permissions }))
      .filter(({ mapa, item }) => mapa && JSON.stringify(mapa) !== JSON.stringify(item));
    expect(divergentes).toEqual([]);
    expect(permissionForPath('/automations/flow-builder')?.permissions).toEqual(['flow_automations.read', 'flow_automations.own']);
  });
});

describe('Automações próprias (15/10/2026)', () => {
  const nomes = (c: Set<string>, funcoes: Record<string, boolean>) => {
    const can = (r: string, a: string) => c.has(`${r}.${a}`);
    const um = (ps: string[]) => ps.some(p => c.has(p));
    const todas = (ps: string[]) => ps.every(p => c.has(p));
    return filterMenuSections(secoes, can, um, todas, 'agent', 'c@x.com', funcoes, [], false)
      .flatMap(s => s.itens.map(i => i.name));
  };

  it('Corretor com flow_automations.own vê Automações mesmo com a chave do cliente desligada', () => {
    const c = new Set([...CORRETOR, 'flow_automations.own']);
    expect(nomes(c, { bolsao: true })).toContain('Automações');
    expect(nomes(c, { bolsao: true, client_manage_automations: true })).toContain('Automações');
  });

  it('Gerente com flow_automations.read e a chave do cliente desligada continua sem ver', () => {
    const c = new Set([...CORRETOR, 'flow_automations.read']);
    expect(nomes(c, { bolsao: true })).not.toContain('Automações');
    expect(nomes(c, { bolsao: true, client_manage_automations: true })).toContain('Automações');
  });

  // Revisão final: a chave do cliente continua valendo pro gestor. O `.own`
  // só passa direto quem não tem `flow_automations.update`.
  it('Gestor com .own e .update e a chave do cliente desligada: não vê', () => {
    const c = new Set([...CORRETOR, 'flow_automations.read', 'flow_automations.update', 'flow_automations.own']);
    expect(nomes(c, { bolsao: true })).not.toContain('Automações');
    expect(nomes(c, { bolsao: true, client_manage_automations: true })).toContain('Automações');
  });

  it('Corretor só com .own e a chave do cliente desligada: vê', () => {
    const c = new Set([...CORRETOR, 'flow_automations.own']);
    expect(nomes(c, {})).toContain('Automações');
  });

  it('Corretor sem .own segue com a lista de hoje', () => {
    expect(nomes(CORRETOR, { bolsao: true, client_manage_automations: true })).not.toContain('Automações');
  });
});

describe('menu novo: seções (fase 4)', () => {
  it('o Corretor de fábrica vê Principal, Atividades, Imóveis, Leads e, em Vendas e automação, só Funis de mensagem', () => {
    const vistas = comCargo(CORRETOR);
    expect(vistas.map(s => s.id)).toEqual(['principal', 'atividades', 'imoveis', 'leads', 'vendas']);
    // Gestão de proprietários passa no cargo; quem tira do corretor sem
    // proprietário liberado é o `aplicarProprietariosNoMenu`, no MainLayout.
    expect(vistas.flatMap(s => s.itens.map(i => i.name))).toEqual([
      'Dashboard', 'Conversas', 'Funil de vendas', 'Tarefas', 'Visitas', 'Meus imóveis', 'Gestão de proprietários', 'Contatos', 'Bolsão',
      'Funis de mensagem',
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

  it('Atividades é uma seção (depois de Principal) com Tarefas e Visitas; cada item some sem o cargo', () => {
    const ordem = secoes.map(x => x.id);
    expect(ordem.indexOf('atividades')).toBe(ordem.indexOf('principal') + 1);
    const nomes = (c: Set<string>) => comCargo(c).find(x => x.id === 'atividades')?.itens.map(i => [i.name, i.href]);
    expect(nomes(new Set(['visits.read', 'pipelines.read']))).toEqual([['Tarefas', '/tarefas'], ['Visitas', '/visits']]);
    expect(nomes(new Set(['visits.read']))).toEqual([['Visitas', '/visits']]);
    expect(nomes(new Set(['pipelines.read']))).toEqual([['Tarefas', '/tarefas']]);
    expect(nomes(new Set())).toBeUndefined();
  });

  it('Integrações leva sempre à página de entrada, mesmo com uma tela só', () => {
    const soPortais = new Set(['portals.read']);
    const integracoes = comCargo(soPortais).flatMap(s => s.itens).find(i => i.name === 'Integrações')!;
    expect(integracoes.href).toBe(ENTRADA_INTEGRACOES);
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
    expect(integracoes.abas?.map(a => a.name)).toEqual(['WhatsApp', 'WhatsApp Oficial', 'Facebook', 'Pixel', 'Portais', 'CVCRM', 'Site da imobiliária']);
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

describe('Automações · sprint 4 (04/10/2026)', () => {
  const imobiliaria = secoes.find(s => s.id === 'imobiliaria')!;

  it('Variáveis de mensagem é item de Minha imobiliária, e Campos personalizados ficou sem abas', () => {
    const variaveis = imobiliaria.itens.find(i => i.name === 'Variáveis de mensagem')!;
    expect(variaveis.href).toBe('/settings/template-variables');
    expect(variaveis.abas ?? []).toEqual([]);
    const campos = imobiliaria.itens.find(i => i.name === 'Campos personalizados')!;
    expect(campos.href).toBe('/settings/attributes');
    expect(campos.abas ?? []).toEqual([]);
    expect(todos.map(i => i.name)).not.toContain('Variáveis');
  });

  it('o canvas de um funil acende Funis de mensagem', () => {
    expect(donoDoEndereco(secoes, '/automations/message-funnels/abc')?.item.name).toBe('Funis de mensagem');
  });

  it('o Corretor não ganha Minha imobiliária por causa das Variáveis de mensagem (só lê)', () => {
    expect(comCargo(CORRETOR).map(s => s.id)).not.toContain('imobiliaria');
  });
});

describe('Automações · sprint 2 (03/10/2026)', () => {
  const vendas = secoes.find(s => s.id === 'vendas')!;

  it('Vendas e automação: Funis de mensagem, Disparos, IA Vendedora e Automações; só Funis de mensagem tem abas', () => {
    expect(vendas.itens.map(i => i.name)).toEqual(['Funis de mensagem', 'Disparos', 'IA Vendedora', 'Automações']);
    vendas.itens.filter(i => i.name !== 'Funis de mensagem').forEach(i => expect(i.abas ?? []).toEqual([]));
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

  it('Regras de lead e Lembretes não estão no menu, e "FlowBuilder" não aparece', () => {
    const hrefs = todos.map(i => i.href);
    expect(hrefs).not.toContain('/automations/lead-automations');
    expect(hrefs).not.toContain('/automations/whatsapp-reminders');
    expect(todos.map(i => i.name)).not.toContain('FlowBuilder');
    expect(todos.map(i => i.name)).not.toContain('Fluxos de mensagem');
    expect(donoDoEndereco(secoes, '/automations/lead-automations')).toBeNull();
  });
});

describe('Integrações em cartões (07/10/2026)', () => {
  const integracoes = secoes.find(s => s.id === 'imobiliaria')!.itens.find(i => i.name === 'Integrações')!;

  it('o item aponta pra entrada e cada tela diz em que cartão mora', () => {
    expect(integracoes.entrada).toBe('/settings/integrations');
    expect(integracoes.href).toBe('/settings/integrations');
    expect(integracoes.abas?.map(a => [a.href, a.cartao])).toEqual([
      ['/channels', 'whatsapp'],
      ['/settings/whatsapp-oficial', 'whatsapp'],
      ['/settings/facebook', 'facebook'],
      ['/settings/pixel-capi', 'facebook'],
      ['/settings/portals', 'portais'],
      ['/settings/cvcrm', 'sistemas'],
      ['/settings/site-da-imobiliaria', 'sistemas'],
    ]);
    expect(SISTEMAS_INTEGRACOES).toBe('/settings/integrations/sistemas');
  });

  it('no painel raiz (jsdom = localhost) o gestor do Facebook fica só com o Pixel', () => {
    const gestorFacebook = new Set(['lead_ads_form_configs.read', 'capi_configs.read']);
    const item = comCargo(gestorFacebook).flatMap(s => s.itens).find(i => i.name === 'Integrações')!;
    expect(item.abas?.map(a => a.href)).toEqual(['/settings/pixel-capi']);
    expect(item.href).toBe(ENTRADA_INTEGRACOES);
  });

  it('Integrações fica aceso na entrada, em Sistemas e nas telas internas', () => {
    for (const endereco of ['/settings/integrations', '/settings/integrations/sistemas', '/settings/portals/zap', '/settings/cvcrm', '/channels/new']) {
      expect(itemAtivo(integracoes, endereco), endereco).toBe(true);
    }
    expect(itemAtivo(integracoes, '/settings/labels')).toBe(false);
  });

  it('o dono de Sistemas e da entrada é Integrações, sem aba; o de uma tela é a aba dela', () => {
    expect(donoDoEndereco(secoes, '/settings/integrations/sistemas')?.item.name).toBe('Integrações');
    expect(donoDoEndereco(secoes, '/settings/integrations/sistemas')?.aba).toBeUndefined();
    expect(donoDoEndereco(secoes, '/settings/integrations')?.aba).toBeUndefined();
    expect(donoDoEndereco(secoes, '/settings/portals/zap')?.aba?.name).toBe('Portais');
    expect(donoDoEndereco(secoes, '/settings/pixel-capi')?.aba?.cartao).toBe('facebook');
  });

  it('a busca do menu continua achando cada tela', () => {
    const nomes = itensDoMenu(secoes).map(i => i.name);
    for (const n of ['Integrações', 'WhatsApp', 'Facebook', 'Pixel', 'Portais', 'CVCRM']) expect(nomes).toContain(n);
  });
});

describe('Listas da casa (E1 do funil, 07/10/2026)', () => {
  const imobiliaria = secoes.find(s => s.id === 'imobiliaria')!;

  it('Listas fica em Minha imobiliária, logo depois de Etiquetas', () => {
    const nomes = imobiliaria.itens.map(i => i.name);
    expect(nomes[nomes.indexOf('Etiquetas') + 1]).toBe('Listas');
    const listas = imobiliaria.itens.find(i => i.name === 'Listas')!;
    expect(listas.href).toBe('/settings/listas');
    expect(listas.abas ?? []).toEqual([]);
    expect(donoDoEndereco(secoes, '/settings/listas')?.item.name).toBe('Listas');
  });

  it('o Corretor de fábrica não ganha Minha imobiliária por causa das Listas (só lê)', () => {
    expect(comCargo(new Set([...CORRETOR, 'pipelines.read'])).map(s => s.id)).not.toContain('imobiliaria');
  });

  it('o Gerente (pipelines.update) vê Listas', () => {
    const itens = comCargo(new Set(['pipelines.read', 'pipelines.update'])).flatMap(s => s.itens).map(i => i.name);
    expect(itens).toContain('Listas');
  });
});

describe('gaveta do celular (Raio-X do celular, 10/10/2026)', () => {
  const FORA_DO_CELULAR = [
    'Meu site', 'Campos personalizados', 'Variáveis de mensagem', 'Integrações', 'Listas',
    'Funis de mensagem', 'Disparos',
  ];
  const nomes = (lista: typeof secoes) => lista.flatMap(s => s.itens.map(i => i.name));

  it('tira só as telas de montar/configurar, e o menu do computador continua inteiro', () => {
    const celular = nomes(secoesDoCelular(secoes));
    for (const n of FORA_DO_CELULAR) expect(celular).not.toContain(n);
    // Computador: a mesma lista de antes, com tudo.
    expect(nomes(secoes).filter(n => !celular.includes(n)).sort()).toEqual([...FORA_DO_CELULAR].sort());
    // Ordem e seções preservadas no que fica.
    expect(celular).toEqual(nomes(secoes).filter(n => !FORA_DO_CELULAR.includes(n)));
    expect(secoesDoCelular(secoes).map(s => s.id)).toEqual(secoes.map(s => s.id));
  });

  it('a seção que fica vazia some: o Corretor perde Vendas e automação no celular', () => {
    const vistas = comCargo(CORRETOR);
    expect(vistas.map(s => s.id)).toContain('vendas');
    expect(secoesDoCelular(vistas).map(s => s.id)).toEqual(['principal', 'atividades', 'imoveis', 'leads']);
  });

  // Follow-up (Fase 3): virou aba de Funis de mensagem, mas segue na gaveta como
  // antes (decisão do dono, 10/10: "Follow-up e Automações ficam no menu do
  // celular"), só pra quem tem a chave do follow-up. A aba Manual fica de fora.
  const podeCom = (chaves: Set<string>) => (ps: string[]) => ps.some(p => chaves.has(p));
  const GESTOR_FOLLOWUP = new Set(['followup_sequences.read', 'followup_sequences.update', 'message_funnels.read']);

  it('o Follow-up continua na gaveta pro gestor, sem a aba Manual, com o nome e o endereço do follow-up', () => {
    const vistas = comCargo(GESTOR_FOLLOWUP);
    const vendas = secoesDoCelular(vistas, podeCom(GESTOR_FOLLOWUP)).find(s => s.id === 'vendas')!;
    const followup = vendas.itens.find(i => i.href === '/automations/follow-ups')!;
    expect(followup.name).toBe('Follow-up');
    expect(followup.abas?.map(a => a.name)).toEqual(['Follow-up']);
    expect(vendas.itens.map(i => i.name)).not.toContain('Funis de mensagem');
    expect(itensDoMenu([vendas]).map(i => i.href)).not.toContain('/automations/message-funnels');
  });

  it('o corretor (só message_funnels.*) não ganha o Follow-up na gaveta e segue sem Vendas e automação', () => {
    const vistas = comCargo(CORRETOR);
    expect(secoesDoCelular(vistas, podeCom(CORRETOR)).map(s => s.id)).toEqual(['principal', 'atividades', 'imoveis', 'leads']);
  });

  it('as telas continuam com dono no menu inteiro (abrem pelo endereço e a busca acha)', () => {
    expect(donoDoEndereco(secoes, '/settings/attributes')?.item.name).toBe('Campos personalizados');
    expect(itensDoMenu(secoes).map(i => i.name)).toContain('Disparos');
  });
});

describe('Sala de demonstração (21/10/2026)', () => {
  const sala = () => folhas.find(i => i.href === '/sala-demonstracao')!;
  const pode = () => true;
  const mostra = (papel: string, demoMode: boolean, suporte = false) =>
    shouldShowMenuItem(sala(), pode, pode, pode, papel, 'x@y.com', {}, [], suporte, demoMode);

  it('o item existe, é somenteDemonstracao e usa a chave do mapa de rotas', () => {
    expect(sala().somenteDemonstracao).toBe(true);
    expect(`${sala().resource}.${sala().action}`).toBe('sales_agents.update');
  });

  it('some pra todo mundo, suporte inclusive, quando o espaço não é de demonstração', () => {
    expect(mostra('admin', false)).toBe(false);
    expect(mostra('admin', false, true)).toBe(false);
    expect(shouldShowMenuItem(sala(), pode, pode, pode, 'admin', 'x@y.com', {}, [], true)).toBe(false);
  });

  it('no espaço de demonstração aparece pela permissão da rota, sem adivinhar o cargo (o servidor decide)', () => {
    expect(mostra('admin', true)).toBe(true);
    expect(mostra('manager', true)).toBe(true);
    expect(mostra('agent', true, true)).toBe(true);
    // O usuário do app não traz a chave do cargo: o item não pode depender dela.
    expect(shouldShowMenuItem(sala(), pode, pode, pode, undefined, 'x@y.com', {}, [], false, true)).toBe(true);
    const naoPode = () => false;
    expect(shouldShowMenuItem(sala(), naoPode, naoPode, naoPode, undefined, 'x@y.com', {}, [], false, true)).toBe(false);
  });

  it('a seção Principal do filtro leva demoMode adiante', () => {
    const nomes = (demo: boolean) => filterMenuSections(secoes, pode, pode, pode, 'admin', 'x@y.com', {}, [], false, demo)
      .flatMap(s => s.itens.map(i => i.name));
    expect(nomes(true)).toContain('Sala de demonstração');
    expect(nomes(false)).not.toContain('Sala de demonstração');
  });
});

describe('Follow-up por usuário (Fase 3, 21/10/2026)', () => {
  const vendas = secoes.find(s => s.id === 'vendas')!;
  const funis = vendas.itens.find(i => i.name === 'Funis de mensagem')!;

  it('menu mostra Funis de mensagem com as abas Manual e Follow-up e sem o item Follow-up solto', () => {
    expect(funis.abas?.map(a => [a.name, a.href])).toEqual([
      ['Manual', '/automations/message-funnels'],
      ['Follow-up', '/automations/follow-ups'],
    ]);
    expect(funis.href).toBe('/automations/message-funnels');
    expect(vendas.itens.map(i => i.name)).not.toContain('Follow-up');
    // O catálogo de Funções continua com as duas chaves (cada aba leva a dela).
    expect(funis.abas?.find(a => a.name === 'Follow-up')?.featureKey).toBe('follow_ups');
    expect(funis.abas?.find(a => a.name === 'Manual')?.featureKey).toBe('message_funnels');
  });

  it('a aba Follow-up abre com message_funnels.read OU followup_sequences.read', () => {
    const aba = funis.abas!.find(a => a.name === 'Follow-up')!;
    expect(aba.permissions).toEqual(['message_funnels.read', 'followup_sequences.read']);
  });

  it('o Corretor de fábrica (só message_funnels.*) vê as duas abas', () => {
    const item = comCargo(CORRETOR).flatMap(s => s.itens).find(i => i.name === 'Funis de mensagem')!;
    expect(item.abas?.map(a => a.name)).toEqual(['Manual', 'Follow-up']);
  });

  it('quem só tem followup_sequences.read vê o item, com a aba Follow-up só', () => {
    const item = comCargo(new Set(['followup_sequences.read'])).flatMap(s => s.itens).find(i => i.name === 'Funis de mensagem')!;
    expect(item.abas?.map(a => a.name)).toEqual(['Follow-up']);
    expect(item.href).toBe('/automations/follow-ups');
  });

  it('com a função de follow-up desligada no cliente, some só a aba Follow-up', () => {
    const can = (r: string, a: string) => CORRETOR.has(`${r}.${a}`);
    const um = (ps: string[]) => ps.some(p => CORRETOR.has(p));
    const todas = (ps: string[]) => ps.every(p => CORRETOR.has(p));
    const item = filterMenuSections(secoes, can, um, todas, 'agent', 'c@x.com', { follow_ups: false }, [], false)
      .flatMap(s => s.itens).find(i => i.name === 'Funis de mensagem')!;
    expect(item.abas?.map(a => a.name)).toEqual(['Manual']);
  });

  it('a lista e o canvas do follow-up acendem a aba Follow-up de Funis de mensagem', () => {
    for (const endereco of ['/automations/follow-ups', '/automations/follow-ups/abc']) {
      const dono = donoDoEndereco(secoes, endereco);
      expect(dono?.item.name, endereco).toBe('Funis de mensagem');
      expect(dono?.aba?.name, endereco).toBe('Follow-up');
    }
    expect(donoDoEndereco(secoes, '/automations/message-funnels')?.aba?.name).toBe('Manual');
  });
});
