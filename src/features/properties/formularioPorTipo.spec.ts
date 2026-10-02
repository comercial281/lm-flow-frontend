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
});
