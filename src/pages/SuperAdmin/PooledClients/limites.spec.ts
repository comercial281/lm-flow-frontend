import { describe, it, expect } from 'vitest';
import { validarLimites } from './limites';

describe('validarLimites', () => {
  it('converte valores válidos', () => {
    expect(validarLimites({ numeros: '0', franquia: '', preco: '2,49' })).toEqual({
      erros: {}, valores: { max_whatsapp_channels: 0, ai_leads_included: null, ai_lead_overage_price_brl: 2.49 },
    });
    expect(validarLimites({ numeros: ' 5 ', franquia: '100', preco: '1.5' }).valores)
      .toEqual({ max_whatsapp_channels: 5, ai_leads_included: 100, ai_lead_overage_price_brl: 1.5 });
  });
  it('vazio ou lixo nunca vira 0', () => {
    const r = validarLimites({ numeros: '', franquia: 'abc', preco: '' });
    expect(r.valores).toBeUndefined();
    expect(Object.keys(r.erros).sort()).toEqual(['franquia', 'numeros', 'preco']);
  });
  it('negativo e decimal em inteiro são inválidos', () => {
    expect(validarLimites({ numeros: '-1', franquia: '', preco: '1' }).erros.numeros).toBeTruthy();
    expect(validarLimites({ numeros: '1', franquia: '2,5', preco: '1' }).erros.franquia).toBeTruthy();
  });
});
