import { describe, expect, it } from 'vitest';
import { abaDoCodigo, buscarNoIndice, indiceDeLugar, sugestoesDeLugar, type GrupoDeLugar } from './sugestoesDeLugar';
import type { PortalProperty } from './filtros';

const ORDEM: GrupoDeLugar[] = ['condominium', 'neighborhood', 'city'];

function imovel(id: string, extra: Partial<PortalProperty> & { city?: string; neighborhood?: string } = {}): PortalProperty {
  const { city, neighborhood, ...resto } = extra;
  return {
    id, code: id, title: id, transaction_type: 'sale', property_type: 'apartment',
    address: { city, neighborhood }, ...resto,
  };
}

const itens: PortalProperty[] = [
  imovel('a1', { condominium_name: 'Collina Parque dos Príncipes', city: 'São Paulo', neighborhood: 'Morumbi' }),
  imovel('a2', { condominium_name: 'Collina Parque dos Príncipes', city: 'São Paulo', neighborhood: 'Morumbi' }),
  imovel('b1', { city: 'São Paulo', neighborhood: 'Centro' }),
  imovel('b2', { city: 'Cotia', neighborhood: 'Centro' }),
  imovel('c1', { transaction_type: 'rent', city: 'Campinas', neighborhood: 'Cambuí' }),
];

const muitos: PortalProperty[] = [
  ...Array.from({ length: 4 }, (_, i) => imovel(`c${i}`, { condominium_name: `Sabiá ${i}`, city: 'Santos', neighborhood: `Saúde ${i}` })),
  ...Array.from({ length: 4 }, (_, i) => imovel(`d${i}`, { city: `Sapucaí ${i}`, neighborhood: `Santa Rita ${i}` })),
];

describe('sugestoesDeLugar', () => {
  it('"col" acha o Collina como condomínio, com a cidade', () => {
    expect(sugestoesDeLugar(itens, 'sale', 'col')).toEqual([
      { grupo: 'condominium', rotulo: 'Collina Parque dos Príncipes (São Paulo)', filtros: { condominium: 'Collina Parque dos Príncipes' } },
    ]);
  });
  it('casa pelo começo de qualquer palavra e sem acento', () => {
    expect(sugestoesDeLugar(itens, 'sale', 'principes')[0].rotulo).toMatch(/^Collina/);
    expect(sugestoesDeLugar(itens, 'sale', 'parque dos')[0].rotulo).toMatch(/^Collina/);
    expect(sugestoesDeLugar(itens, 'sale', 'arque')).toEqual([]);
  });
  it('menos de 2 letras não sugere', () => expect(sugestoesDeLugar(itens, 'sale', 'c')).toEqual([]));
  it('só o que tem imóvel na aba', () => {
    expect(sugestoesDeLugar(itens, 'rent', 'col')).toEqual([]);
    expect(sugestoesDeLugar(itens, 'sale', 'cambui')).toEqual([]);
  });
  it('bairro repetido em duas cidades vira duas sugestões com a cidade', () => {
    const r = sugestoesDeLugar(itens, 'sale', 'centro').filter(s => s.grupo === 'neighborhood');
    expect(r.map(s => s.rotulo)).toEqual(['Centro · Cotia', 'Centro · São Paulo']);
    expect(r[0].filtros).toEqual({ neighborhood: 'Centro', city: 'Cotia' });
  });
  it('bairro e cidade de uma cidade só saem simples', () => {
    expect(sugestoesDeLugar(itens, 'sale', 'moru')).toEqual([
      { grupo: 'neighborhood', rotulo: 'Morumbi', filtros: { neighborhood: 'Morumbi' } },
    ]);
    expect(sugestoesDeLugar(itens, 'sale', 'cotia')).toEqual([
      { grupo: 'city', rotulo: 'Cotia', filtros: { city: 'Cotia' } },
    ]);
  });
  it('grupos na ordem e no máximo 8', () => {
    const r = sugestoesDeLugar(muitos, 'sale', 'sa');
    expect(r.length).toBe(8);
    expect(r.map(s => s.grupo)).toEqual([...r.map(s => s.grupo)].sort((a, b) => ORDEM.indexOf(a) - ORDEM.indexOf(b)));
    expect(sugestoesDeLugar(muitos, 'sale', 'sa', 20).map(s => s.grupo)).toContain('city');
  });
});

describe('indiceDeLugar', () => {
  it('monta uma vez e responde igual a sugestoesDeLugar', () => {
    const indice = indiceDeLugar(itens, 'sale');
    for (const t of ['col', 'principes', 'centro', 'moru', 'cotia', 'sa', 'arque', 'c']) {
      expect(buscarNoIndice(indice, t)).toEqual(sugestoesDeLugar(itens, 'sale', t));
    }
    expect(buscarNoIndice(indiceDeLugar(muitos, 'sale'), 'sa', 20)).toEqual(sugestoesDeLugar(muitos, 'sale', 'sa', 20));
  });
  it('guarda a grafia mais comum e a cidade mais comum do condomínio', () => {
    const indice = indiceDeLugar([
      imovel('x1', { condominium_name: 'Jardim Sul', city: 'Cotia' }),
      imovel('x2', { condominium_name: ' JARDIM SUL ', city: 'Cotia' }),
      imovel('x3', { condominium_name: 'Jardim Sul', city: 'São Paulo' }),
    ], 'sale');
    expect(indice.condominios.map(e => e.sugestao)).toEqual([
      { grupo: 'condominium', rotulo: 'Jardim Sul (Cotia)', filtros: { condominium: 'Jardim Sul' } },
    ]);
  });
  it('catálogo grande: cada tecla responde rápido (sem varrer o catálogo de novo)', () => {
    const grande: PortalProperty[] = Array.from({ length: 2000 }, (_, i) =>
      imovel(`g${i}`, { condominium_name: `Condomínio ${i % 500}`, city: `Cidade ${i % 40}`, neighborhood: `Conjunto ${i % 300}` }));
    const indice = indiceDeLugar(grande, 'sale');
    const inicio = performance.now();
    for (const t of ['co', 'con', 'cond', 'condo', 'condominio 4']) buscarNoIndice(indice, t);
    // Antes do índice, "con" levava ~600 ms num Mac (as cinco teclas, ~3 s); com o índice, poucos ms.
    // O teto folgado (500 ms) segura a volta ao caminho lento sem falhar com a máquina carregada.
    expect(performance.now() - inicio).toBeLessThan(500);
    expect(buscarNoIndice(indice, 'con')).toHaveLength(8);
  });
});

/* A regra única de "é código?" da caixa de busca (capa do Moderno, capa do Clássico com o
   lugar ligado e página de Imóveis): o texto igual ao código de um imóvel publicado. */
describe('abaDoCodigo', () => {
  const cat: PortalProperty[] = [
    imovel('AP0632', { city: 'Campinas' }),
    imovel('L77', { transaction_type: 'rent', city: 'Campinas' }),
  ];

  it('código igual (sem maiúscula, acento nem espaço sobrando) devolve a aba de agora', () => {
    expect(abaDoCodigo(cat, 'AP0632', 'sale', ['sale', 'rent'])).toBe('sale');
    expect(abaDoCodigo(cat, '  ap0632 ', 'sale', ['sale', 'rent'])).toBe('sale');
  });

  it('nome de lugar, texto com espaço e texto vazio não são código', () => {
    expect(abaDoCodigo(cat, 'Centro', 'sale', ['sale', 'rent'])).toBeNull();
    expect(abaDoCodigo(cat, 'Campinas', 'sale', ['sale', 'rent'])).toBeNull();
    expect(abaDoCodigo(cat, 'Vila 2', 'sale', ['sale', 'rent'])).toBeNull();
    expect(abaDoCodigo(cat, '', 'sale', ['sale', 'rent'])).toBeNull();
    expect(abaDoCodigo(cat, '   ', 'sale', ['sale', 'rent'])).toBeNull();
  });

  it('pedaço de código (com número, sem espaço, dentro de algum código publicado) também é código', () => {
    expect(abaDoCodigo(cat, 'AP06', 'sale', ['sale', 'rent'])).toBe('sale');
    expect(abaDoCodigo(cat, 'ap06', 'sale', ['sale', 'rent'])).toBe('sale');
    // Pedaço sem número não é código (seria nome de lugar): "AP" fica como texto.
    expect(abaDoCodigo(cat, 'AP', 'sale', ['sale', 'rent'])).toBeNull();
    // Com número mas em nenhum código publicado: texto.
    expect(abaDoCodigo(cat, 'ZZ9', 'sale', ['sale', 'rent'])).toBeNull();
  });

  it('pedaço de código: fica na aba de agora; todos os imóveis numa outra aba só, vai pra ela', () => {
    const misto: PortalProperty[] = [
      imovel('AP0632', { city: 'Campinas' }),
      imovel('AP0701', { transaction_type: 'rent' }),
      imovel('L77', { transaction_type: 'rent' }),
      imovel('L78', { transaction_type: 'rent' }),
    ];
    expect(abaDoCodigo(misto, 'AP0', 'sale', ['sale', 'rent'])).toBe('sale');
    expect(abaDoCodigo(misto, 'AP0', 'rent', ['sale', 'rent'])).toBe('rent');
    expect(abaDoCodigo(misto, 'L7', 'sale', ['sale', 'rent'])).toBe('rent');
  });

  it('código de outra aba devolve a aba dele (entre as do site)', () => {
    expect(abaDoCodigo(cat, 'l77', 'sale', ['sale', 'rent'])).toBe('rent');
  });

  it('a aba dele não está entre as do site: fica na de agora (o código ainda vale)', () => {
    expect(abaDoCodigo(cat, 'l77', 'sale', ['sale'])).toBe('sale');
  });
});
