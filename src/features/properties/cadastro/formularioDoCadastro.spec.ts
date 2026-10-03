import { describe, expect, it } from 'vitest';
import type { Property } from '@/services/properties/propertiesService';
import { errosDoCadastro, formularioDoImovel, payloadDoCadastro } from './formularioDoCadastro';
import { formularioNovo } from '../formularioPorTipo';

const base = { title: 'Casa', transaction_type: 'sale', category_type: 'residential', property_type: 'house',
  status: 'active', stage: 'ready' } as const;

describe('formularioDoCadastro', () => {
  it('sem título aponta Básico', () => {
    expect(errosDoCadastro({ ...base, title: ' ', sale_price: 1 }).map(e => e.secao)).toEqual(['basico']);
  });
  it('revenda à venda sem preço aponta Valores', () => {
    expect(errosDoCadastro({ ...base, ...formularioNovo('resale') }).map(e => e.secao)).toEqual(['valores']);
  });
  it('empreendimento sem preço aponta Tipologias (hoje o preço só nas tipologias não vale)', () => {
    expect(errosDoCadastro({ ...base, ...formularioNovo('development'), typologies: [{ sale_price: 500000 }] } as never)
      .map(e => e.secao)).toEqual(['tipologias']);
  });
  it('responsável obrigatório quando o lead vai pro responsável', () => {
    expect(errosDoCadastro({ ...base, sale_price: 1, lead_goes_to_responsible: true }).map(e => e.secao)).toEqual(['equipe']);
  });
  it('rascunho grava como draft', () => {
    expect(payloadDoCadastro({ ...base, sale_price: 1 }, { rascunho: true }).status).toBe('draft');
    expect(payloadDoCadastro({ ...base, sale_price: 1 }, { rascunho: false }).status).toBe('active');
  });
  it('imóvel antigo sem os campos novos vira formulário com padrões vazios', () => {
    const f = formularioDoImovel({ id: '1', code: 'AP1', created_at: '', updated_at: '', ...base } as Property);
    expect(f).toMatchObject({ builder: {}, internal_info: {}, commission: {}, accepts_fgts: null, iptu_period: null, owner_id: null,
      video_url: '', virtual_tour_url: '' });
  });
});
