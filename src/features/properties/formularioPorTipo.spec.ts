import { describe, expect, it } from 'vitest';
import { formularioNovo, payloadDoFormulario } from './formularioPorTipo';

describe('formulário por tipo', () => {
  it('empreendimento nasce venda e na planta; revenda nasce pronto', () => {
    expect(formularioNovo('development')).toMatchObject({ listing_kind: 'development', transaction_type: 'sale', stage: 'launch' });
    expect(formularioNovo('resale')).toMatchObject({ listing_kind: 'resale', stage: 'ready' });
  });

  it('empreendimento sempre grava venda; previsão vazia vira null; pronto não leva previsão', () => {
    const base = { title: 'x', category_type: 'residential', property_type: 'apartment', status: 'active' };
    expect(payloadDoFormulario({ ...base, listing_kind: 'development', transaction_type: 'rent', stage: 'launch', delivery_forecast: '2027-12' } as never))
      .toMatchObject({ transaction_type: 'sale', delivery_forecast: '2027-12' });
    expect(payloadDoFormulario({ ...base, listing_kind: 'development', transaction_type: 'sale', stage: 'ready', delivery_forecast: '2027-12' } as never).delivery_forecast).toBeNull();
    expect(payloadDoFormulario({ ...base, listing_kind: 'resale', transaction_type: 'rent', stage: 'ready', delivery_forecast: '' } as never).delivery_forecast).toBeNull();
  });

  it('revenda mantém a previsão que veio do empreendimento', () => {
    const base = { title: 'x', category_type: 'residential', property_type: 'apartment', status: 'active' };
    expect(payloadDoFormulario({ ...base, listing_kind: 'resale', transaction_type: 'sale', stage: 'ready', delivery_forecast: '2027-12' } as never).delivery_forecast).toBe('2027-12');
  });

  it('leilão nasce venda e pronto, e sempre grava venda', () => {
    expect(formularioNovo('auction')).toMatchObject({ listing_kind: 'auction', transaction_type: 'sale', stage: 'ready' });
    const base = { title: 'x', category_type: 'residential', property_type: 'apartment', status: 'active' };
    expect(payloadDoFormulario({ ...base, listing_kind: 'auction', transaction_type: 'rent', stage: 'ready', delivery_forecast: '' } as never))
      .toMatchObject({ transaction_type: 'sale', delivery_forecast: null });
  });
  it('empreendimento com preço nas plantas manda o menor como Valor de venda (a partir de)', () => {
    const base = { title: 'x', category_type: 'residential', property_type: 'apartment', status: 'active', stage: 'launch' };
    const p = payloadDoFormulario({ ...base, listing_kind: 'development', transaction_type: 'sale', sale_price: 1,
      typologies: [{ sale_price: 300000 }, { sale_price: 244633 }, { bedrooms: 2 }] } as never);
    expect(p.sale_price).toBe(244633);
  });

  it('empreendimento sem preço nas plantas e revenda mantêm o Valor de venda digitado', () => {
    const base = { title: 'x', category_type: 'residential', property_type: 'apartment', status: 'active', stage: 'ready' };
    expect(payloadDoFormulario({ ...base, listing_kind: 'development', transaction_type: 'sale', sale_price: 450000,
      typologies: [{ bedrooms: 2 }] } as never).sale_price).toBe(450000);
    expect(payloadDoFormulario({ ...base, listing_kind: 'resale', transaction_type: 'sale', sale_price: 500000,
      typologies: [{ sale_price: 1 }] } as never).sale_price).toBe(500000);
  });
});
