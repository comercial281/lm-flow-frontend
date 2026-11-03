import { describe, it, expect } from 'vitest';
import { menuRecolhido, recolheMenu, ROTA_CONVERSAS, ROTA_RECOLHE_MENU } from './menuRecolhidoEm';

describe('menuRecolhido', () => {
  it('fora de Conversas devolve a preferência salva', () => {
    expect(menuRecolhido({ salvo: true, emConversas: false, escolhaNaVisita: null })).toBe(true);
    expect(menuRecolhido({ salvo: false, emConversas: false, escolhaNaVisita: null })).toBe(false);
  });

  it('fora de Conversas ignora a escolha da visita', () => {
    expect(menuRecolhido({ salvo: false, emConversas: false, escolhaNaVisita: true })).toBe(false);
  });

  it('em Conversas sem escolha recolhe, mesmo com a preferência aberta', () => {
    expect(menuRecolhido({ salvo: false, emConversas: true, escolhaNaVisita: null })).toBe(true);
  });

  it('em Conversas a escolha da visita manda sobre a preferência', () => {
    expect(menuRecolhido({ salvo: true, emConversas: true, escolhaNaVisita: false })).toBe(false);
    expect(menuRecolhido({ salvo: false, emConversas: true, escolhaNaVisita: true })).toBe(true);
  });
});

describe('ROTA_CONVERSAS', () => {
  it('casa a lista e a conversa aberta', () => {
    expect(ROTA_CONVERSAS.test('/conversations')).toBe(true);
    expect(ROTA_CONVERSAS.test('/conversations/123')).toBe(true);
  });

  it('não casa outras rotas parecidas', () => {
    expect(ROTA_CONVERSAS.test('/conversations-old')).toBe(false);
    expect(ROTA_CONVERSAS.test('/contacts')).toBe(false);
  });
});

describe('ROTA_RECOLHE_MENU', () => {
  it('cadastro de imóvel recolhe como Conversas', () => {
    for (const url of ['/properties/new', '/properties/abc/editar']) expect(ROTA_RECOLHE_MENU.test(url)).toBe(true);
    for (const url of ['/properties', '/properties/map', '/property-owners']) expect(ROTA_RECOLHE_MENU.test(url)).toBe(false);
  });

  it('funil aberto recolhe; a lista de funis não', () => {
    for (const url of ['/pipelines/abc', '/pipelines/abc/card/42']) expect(ROTA_RECOLHE_MENU.test(url)).toBe(true);
    for (const url of ['/pipelines', '/pipelines/']) expect(ROTA_RECOLHE_MENU.test(url)).toBe(false);
  });

  it('continua recolhendo em Conversas', () => {
    expect(ROTA_RECOLHE_MENU.test('/conversations')).toBe(true);
    expect(ROTA_RECOLHE_MENU.test('/conversations/123')).toBe(true);
  });

  it('o mapa aberto recolhe; as listas das Automações não', () => {
    for (const url of ['/automations/flow-builder/abc', '/automations/message-funnels/abc', '/automations/follow-ups/abc'])
      expect(ROTA_RECOLHE_MENU.test(url)).toBe(true);
    for (const url of ['/automations', '/automations/flow-builder', '/automations/message-funnels', '/automations/follow-ups',
      '/automations/follow-ups/'])
      expect(ROTA_RECOLHE_MENU.test(url)).toBe(false);
  });
});

describe('recolheMenu (pathname + search)', () => {
  it('recolhe nas páginas de Configurar e Ensinar da IA Vendedora, lendo o search', () => {
    expect(recolheMenu('/ia-vendedora', '?ia=ia-1&tela=configurar&pagina=modo')).toBe(true);
    expect(recolheMenu('/ia-vendedora', '?ia=ia-1&tela=ensinar')).toBe(true);
    expect(recolheMenu('/ia-vendedora', '?tela=configurar&ia=ia-1')).toBe(true);
    expect(recolheMenu('/ia-vendedora', 'ia=ia-1&tela=configurar')).toBe(true);
  });

  it('recolhe no Novo agente', () => {
    expect(recolheMenu('/ia-vendedora/novo', '')).toBe(true);
    expect(recolheMenu('/ia-vendedora/novo/', '?x=1')).toBe(true);
  });

  it('não recolhe na página de agentes nem no Painel', () => {
    expect(recolheMenu('/ia-vendedora', '')).toBe(false);
    expect(recolheMenu('/ia-vendedora', '?ia=ia-1')).toBe(false);
    expect(recolheMenu('/ia-vendedora', '?ia=ia-1&tela=visao-geral')).toBe(false);
    expect(recolheMenu('/ia-vendedora', '?ia=ia-1&tela=relatorio')).toBe(false);
  });

  it('não recolhe em outra rota que tenha tela=configurar no search', () => {
    expect(recolheMenu('/settings', '?tela=configurar')).toBe(false);
    expect(recolheMenu('/ia-vendedora-velha', '?tela=configurar')).toBe(false);
  });

  it('as rotas de sempre continuam recolhendo pelo pathname', () => {
    expect(recolheMenu('/conversations', '')).toBe(true);
    expect(recolheMenu('/pipelines/abc', '')).toBe(true);
    expect(recolheMenu('/pipelines', '')).toBe(false);
  });
});
