import { describe, expect, it } from 'vitest';
import type { Condominium } from '@/services/condominiums/condominiumsService';
import type { Property, PropertyFormData } from '@/services/properties/propertiesService';
import {
  ABA_CONDOMINIOS, CONDOMINIO_VAZIO, camposHerdados, difereDoCondominio, errosDoCondominio,
  estaNaAbaDeCondominios, formularioDoCondominio, podePlugar, textoDasFotosDoCondominio,
  textoDasUnidades, valoresHerdados,
} from './regrasDoCondominio';

const condo = {
  id: 'c1', name: 'Edifício Sol', kind: 'vertical', address_street: 'Rua A', address_number: '10',
  address_neighborhood: 'Centro', address_city: 'Santos', address_state: 'SP', address_cep: '11000-000',
  address_complement: null, latitude: -23.9, longitude: -46.3, condo_features: ['piscina'],
  builder_name: null, developer_name: null, administrator_name: null, year_built: null, internal_note: null,
  location_source: null, contacts: [], locked_fields: [], photos_count: 0, units: [], units_count: 0,
  for_sale_count: 0, sold_count: 0, sold_count_: 0, updated_at: '', cover_photo_url: null,
} as unknown as Condominium;

describe('aba', () => {
  it('reconhece ?aba=condominios', () => {
    expect(ABA_CONDOMINIOS).toBe('condominios');
    expect(estaNaAbaDeCondominios(new URLSearchParams('aba=condominios'))).toBe(true);
    expect(estaNaAbaDeCondominios(new URLSearchParams('aba=resale'))).toBe(false);
  });
});

describe('formulário e erros', () => {
  it('formularioDoCondominio copia só os campos editáveis', () => {
    const f = formularioDoCondominio(condo);
    expect(f.name).toBe('Edifício Sol');
    expect(f.address_cep).toBe('11000-000');
    expect((f as unknown as Record<string, unknown>).units).toBeUndefined();
    expect((f as unknown as Record<string, unknown>).id).toBeUndefined();
  });
  it('erros do servidor', () => {
    expect(errosDoCondominio(CONDOMINIO_VAZIO)).toEqual(['Dê um nome ao condomínio.', 'Preencha rua, cidade e UF do condomínio.']);
    expect(errosDoCondominio(formularioDoCondominio(condo))).toEqual([]);
  });
});

describe('campos herdados', () => {
  it('monta pelo tipo; horizontal sem latitude/longitude', () => {
    const v = camposHerdados({ kind: 'vertical' });
    expect(v).toContain('address_zip');
    expect(v).toContain('latitude');
    expect(v).toContain('condo_features');
    expect(camposHerdados({ kind: 'horizontal' })).not.toContain('latitude');
  });
  it('usa locked_fields do servidor, com address_cep na grafia da tela', () => {
    expect(camposHerdados({ kind: 'vertical', locked_fields: ['address_cep', 'address_city'] })).toEqual(['address_zip', 'address_city']);
  });
  it('valoresHerdados mapeia o CEP', () => {
    const v = valoresHerdados(condo, 'vertical');
    expect(v.address_zip).toBe('11000-000');
    expect(v.latitude).toBe(-23.9);
    expect(v.condo_features).toEqual(['piscina']);
  });
  it('horizontal: sem lat/long, a menos que o formulário não tenha', () => {
    const h = { ...condo, kind: 'horizontal' } as Condominium;
    expect(valoresHerdados(h, 'horizontal')).not.toHaveProperty('latitude');
    expect(valoresHerdados(h, 'horizontal', { latitude: 1, longitude: 2 } as PropertyFormData)).not.toHaveProperty('latitude');
    expect(valoresHerdados(h, 'horizontal', {} as PropertyFormData)).toMatchObject({ latitude: -23.9, longitude: -46.3 });
  });
  it('difereDoCondominio', () => {
    expect(difereDoCondominio({} as PropertyFormData, condo)).toBe(false);
    expect(difereDoCondominio({ address_city: 'Santos', condo_features: ['piscina'] } as PropertyFormData, condo)).toBe(false);
    expect(difereDoCondominio({ address_city: 'Recife' } as PropertyFormData, condo)).toBe(true);
    expect(difereDoCondominio({ condo_features: ['sauna'] } as PropertyFormData, condo)).toBe(true);
  });
});

describe('podePlugar', () => {
  it('empreendimento não', () => {
    expect(podePlugar(null, 'development').pode).toBe(false);
  });
  it('imóvel com site travado não, com o texto', () => {
    const p = { feed: { source_id: 's', external_url: null, locked_fields: ['title'] } } as Property;
    const r = podePlugar(p, 'resale');
    expect(r.pode).toBe(false);
    expect(r.motivo).toBe('Este imóvel vem do site da imobiliária: endereço e comodidades vêm de lá.');
  });
  it('revenda livre e novo imóvel pode', () => {
    expect(podePlugar(null, 'resale')).toEqual({ pode: true });
    expect(podePlugar({ feed: null } as Property, 'auction').pode).toBe(true);
  });
});

describe('textos', () => {
  it('unidades', () => {
    expect(textoDasUnidades(0)).toBe('');
    expect(textoDasUnidades(1)).toBe('Mudanças aqui valem para a unidade plugada.');
    expect(textoDasUnidades(3)).toBe('Mudanças aqui valem para as 3 unidades plugadas.');
  });
  it('fotos', () => {
    expect(textoDasFotosDoCondominio(0)).toBe('');
    expect(textoDasFotosDoCondominio(1)).toBe('Mais 1 foto do condomínio entra depois destas no site e nos portais.');
    expect(textoDasFotosDoCondominio(4)).toBe('Mais 4 fotos do condomínio entram depois destas no site e nos portais.');
  });
});
