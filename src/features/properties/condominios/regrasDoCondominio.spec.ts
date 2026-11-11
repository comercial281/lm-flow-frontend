import { describe, expect, it } from 'vitest';
import type { Condominium } from '@/services/condominiums/condominiumsService';
import type { Property, PropertyFormData } from '@/services/properties/propertiesService';
import {
  ABA_CONDOMINIOS, CONDOMINIO_VAZIO, camposHerdados, difereDoCondominio, errosDoCondominio,
  estaNaAbaDeCondominios, formularioDoCondominio, podePlugar, textoDasFotosDoCondominio,
  textoDasUnidades, valoresHerdados, condominioNaTela, payloadDoCondominio, destinoDepoisDeCriar, caminhoDeVolta, pedidoDeExclusao, secaoDoErro,
  linkParaCadastrarCondominio, linkParaEditarCondominio,
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
    expect(textoDasFotosDoCondominio(0, true)).toBe('');
    expect(textoDasFotosDoCondominio(0, false)).toBe('');
    expect(textoDasFotosDoCondominio(1, true)).toBe('Mais 1 foto do condomínio entra depois destas no site e nos portais.');
    expect(textoDasFotosDoCondominio(4, true)).toBe('Mais 4 fotos do condomínio entram depois destas no site e nos portais.');
  });
  it('fotos, sem foto própria: a primeira do condomínio vira a capa', () => {
    expect(textoDasFotosDoCondominio(1, false)).toBe('A foto do condomínio entra no site e nos portais e vira a capa.');
    expect(textoDasFotosDoCondominio(4, false)).toBe('As 4 fotos do condomínio entram no site e nos portais; a primeira vira a capa.');
  });
});

describe('cadastro do condomínio na tela', () => {
  it('CEP vira address_zip na tela e volta address_cep no payload; texto vazio vira nulo', () => {
    const t = condominioNaTela(formularioDoCondominio(condo));
    expect(t.address_zip).toBe('11000-000');
    expect(t.address_complement).toBe('');
    const p = payloadDoCondominio({ ...t, address_number: '  ', builder_name: '' });
    expect(p.address_cep).toBe('11000-000');
    expect(p).not.toHaveProperty('address_zip');
    expect(p.address_number).toBeNull();
    expect(p.builder_name).toBeNull();
  });
  it('contato em branco não vai; o resto vai aparado', () => {
    const t = condominioNaTela({ ...CONDOMINIO_VAZIO, contacts: [
      { name: ' Zé ', role: 'sindico', phone: '', email: '' },
      { name: '', role: 'zelador', phone: ' ', email: '' },
    ] });
    expect(payloadDoCondominio(t).contacts).toEqual([{ name: 'Zé', role: 'sindico', phone: '', email: '' }]);
  });
  it('origem do ponto desconhecida vira nula', () => {
    expect(condominioNaTela({ ...CONDOMINIO_VAZIO, location_source: 'feed' }).location_source).toBeNull();
    expect(condominioNaTela({ ...CONDOMINIO_VAZIO, location_source: 'manual' }).location_source).toBe('manual');
  });
  it('erro de nome mora no Básico; o de endereço, na Localização', () => {
    expect(secaoDoErro('Dê um nome ao condomínio.')).toBe('basico');
    expect(secaoDoErro('Preencha rua, cidade e UF do condomínio.')).toBe('localizacao');
  });
});

describe('depois de criar', () => {
  it('volta para o caminho interno de Imóveis com o condomínio', () => {
    expect(destinoDepoisDeCriar('/properties/p1/editar', 'c9')).toBe('/properties/p1/editar?condominio=c9');
    expect(destinoDepoisDeCriar('/properties/new?tipo=revenda', 'c9')).toBe('/properties/new?tipo=revenda&condominio=c9');
  });
  it('caminhoDeVolta só aceita caminho interno de Imóveis', () => {
    expect(caminhoDeVolta('/properties/p1/editar')).toBe('/properties/p1/editar');
    expect(caminhoDeVolta('https://x')).toBeNull();
    expect(caminhoDeVolta(null)).toBeNull();
  });
  it('sem voltar, ou com endereço de fora, abre o condomínio', () => {
    for (const v of [null, '', 'https://x', '//x.com/properties/', '/settings', '/properties//evil.com']) {
      expect(destinoDepoisDeCriar(v, 'c9')).toBe('/properties/condominios/c9');
    }
  });
});

describe('excluir', () => {
  it('textos por quantidade de unidades', () => {
    expect(pedidoDeExclusao('Sol', 6)).toEqual({
      titulo: 'Excluir o condomínio Sol?',
      descricao: 'As 6 unidades plugadas ficam com o endereço e as comodidades de hoje e passam a ser editadas nelas.',
    });
    expect(pedidoDeExclusao('Sol', 1).descricao).toBe('A unidade plugada fica com o endereço e as comodidades de hoje e passa a ser editada nela.');
    expect(pedidoDeExclusao('Sol', 0).descricao).toBe('Não dá para desfazer.');
  });
});

describe('+ Cadastrar condomínio na unidade', () => {
  it('volta para a unidade, sem um condominio= que já estava no endereço', () => {
    const link = linkParaCadastrarCondominio('/properties/new', '?tipo=revenda&condominio=c1&proprietario=o1');
    expect(link.startsWith('/properties/condominios/novo?voltar=')).toBe(true);
    expect(new URLSearchParams(link.split('?')[1]).get('voltar')).toBe('/properties/new?tipo=revenda&proprietario=o1');
  });
  it('sem nada no endereço, volta só para o caminho', () => {
    const link = linkParaCadastrarCondominio('/properties/p1/editar', '?condominio=c1');
    expect(new URLSearchParams(link.split('?')[1]).get('voltar')).toBe('/properties/p1/editar');
    // Volta e criação se encaixam: o cadastro do condomínio acrescenta o novo.
    expect(destinoDepoisDeCriar('/properties/p1/editar', 'c9')).toBe('/properties/p1/editar?condominio=c9');
  });
});

describe('Editar no condomínio, na unidade', () => {
  it('abre o condomínio com a volta para a unidade, sem condominio= no endereço', () => {
    const link = linkParaEditarCondominio('c1', '/properties/p1/editar', '?condominio=c1&passo=divulgar');
    expect(link.startsWith('/properties/condominios/c1?voltar=')).toBe(true);
    const voltar = new URLSearchParams(link.split('?')[1]).get('voltar');
    expect(voltar).toBe('/properties/p1/editar?passo=divulgar');
    expect(caminhoDeVolta(voltar)).toBe(voltar);
  });
  it('id com caractere especial vai codificado', () => {
    expect(linkParaEditarCondominio('a/b', '/properties/p1/editar', '').startsWith('/properties/condominios/a%2Fb?voltar=')).toBe(true);
  });
});
