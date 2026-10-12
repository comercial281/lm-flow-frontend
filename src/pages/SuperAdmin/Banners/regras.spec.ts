import { describe, it, expect } from 'vitest';
import { doCampo, numerosDoBanner, paraOCampo, perguntaDoPublico } from './regras';

describe('regras do Banner', () => {
  it('números e pergunta no singular e no plural', () => {
    expect(numerosDoBanner(1, 1)).toBe('Apareceu para 1 pessoa · 1 clicou');
    expect(numerosDoBanner(1280, 0)).toBe('Apareceu para 1.280 pessoas · 0 clicaram');
    expect(perguntaDoPublico({ people: 340, tenants: 1, unreadable: [] })).toBe('Mostrar para 340 pessoas de 1 imobiliária?');
  });

  it('data e hora vão e voltam do campo sem perder o horário', () => {
    const iso = new Date(2026, 9, 26, 23, 59).toISOString();
    expect(paraOCampo(iso)).toBe('2026-10-26T23:59');
    expect(doCampo('2026-10-26T23:59')).toBe(iso);
    expect(paraOCampo(null)).toBe('');
    expect(doCampo('')).toBeNull();
  });
});

describe('telas do menu pro destino do clique', () => {
  it('lê o menu do cliente com o nome da tela, aba por aba, sem repetir endereço', async () => {
    const { getCustomerMenuSections, getFooterMenuItems } = await import('@/components/layout/config/menuItems');
    const { telasDoMenu, nomeDaTela } = await import('./regras');
    const grupos = telasDoMenu(getCustomerMenuSections(), getFooterMenuItems());
    expect(nomeDaTela(grupos, '/conversations')).toBe('Conversas');
    expect(nomeDaTela(grupos, '/channels')).toBe('Integrações · WhatsApp');
    expect(nomeDaTela(grupos, '/tutorials')).toBe('Guia do LM Flow');
    expect(nomeDaTela(grupos, 'https://lealmidia.com.br')).toBeNull();
    const enderecos = grupos.flatMap((g) => g.telas.map((t) => t.endereco));
    expect(new Set(enderecos).size).toBe(enderecos.length);
  });
});
