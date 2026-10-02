import { describe, it, expect } from 'vitest';
import { menuRecolhido, ROTA_CONVERSAS } from './menuRecolhidoEm';

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
