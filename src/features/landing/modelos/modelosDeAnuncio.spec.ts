import { describe, it, expect } from 'vitest';
import {
  BLOCK_CONFIG_SCHEMAS,
  formularioDaCapa,
  safeParsePageBlocks,
  withLegacyQualificationMaps,
  type BlockConfig,
} from '@/features/landing/blocks';
import { FONTES_DO_SITE } from '@/features/siteBuilder/public/aparenciaConfig';
import { MODELOS_DE_ANUNCIO, modeloSugerido } from './modelosDeAnuncio';

const modelo = (id: string) => MODELOS_DE_ANUNCIO.find((m) => m.id === id)!;
const pesos = (id: string) => {
  const form = modelo(id).blocos()[1];
  return withLegacyQualificationMaps(form.config as BlockConfig<'lead_form'>).answerWeights;
};

describe('modelos de página de anúncio', () => {
  it('são três, na ordem Lançamento, Revenda, Aluguel', () => {
    expect(MODELOS_DE_ANUNCIO.map((m) => m.nome)).toEqual(['Lançamento', 'Revenda', 'Aluguel']);
  });

  it.each(MODELOS_DE_ANUNCIO.map((m) => [m.id, m] as const))('%s: capa com formulário e um só lead_form logo depois', (_id, m) => {
    const blocos = m.blocos();
    expect(blocos[0].type).toBe('hero');
    expect((blocos[0].config as { formInHero?: boolean }).formInHero).toBe(true);
    expect(blocos[1].type).toBe('lead_form');
    expect(blocos.filter((b) => b.type === 'lead_form')).toHaveLength(1);
    expect(formularioDaCapa(blocos)).not.toBeNull();
  });

  it.each(MODELOS_DE_ANUNCIO.map((m) => [m.id, m] as const))('%s: todos os blocos passam no contrato', (_id, m) => {
    const blocos = m.blocos();
    expect(safeParsePageBlocks(blocos)).toHaveLength(blocos.length);
    for (const b of blocos) {
      expect(BLOCK_CONFIG_SCHEMAS[b.type].safeParse(b.config).success).toBe(true);
    }
  });

  it('cada chamada gera ids novos', () => {
    const a = modelo('aluguel').blocos().map((b) => b.id);
    const b = modelo('aluguel').blocos().map((b2) => b2.id);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });

  it('a fonte de cada tema é uma das fontes do site', () => {
    for (const m of MODELOS_DE_ANUNCIO) {
      const principal = m.tema.fontFamily.split(',')[0].trim();
      expect(FONTES_DO_SITE).toContain(principal);
    }
  });

  it('Lançamento esconde a fase da obra e pede a tabela de preços', () => {
    const blocos = modelo('lancamento').blocos();
    expect(blocos.find((b) => b.type === 'construction_progress')?.visible).toBe(false);
    expect((blocos[1].config as { ctaLabel: string }).ctaLabel).toBe('Quero a tabela');
    expect(blocos.at(-1)?.type).toBe('sticky_cta');
  });

  it('Aluguel traz custo mensal, passo a passo e as duas listas de amenities', () => {
    const blocos = modelo('aluguel').blocos();
    expect(blocos.map((b) => b.type)).toEqual([
      'hero', 'lead_form', 'price_band', 'monthly_cost', 'tech_sheet', 'steps',
      'amenities', 'amenities', 'gallery', 'description', 'map', 'sticky_cta',
    ]);
    expect((blocos[5].config as { items: unknown[] }).items).toHaveLength(3);
  });

  it('pesos da Revenda', () => {
    expect(pesos('revenda')).toEqual({
      'Esta semana': 3, 'Nas próximas semanas': 2,
      'À vista': 3, 'Financiamento aprovado': 3, 'Vou financiar': 2, 'Usar FGTS': 2,
    });
  });

  it('pesos do Aluguel', () => {
    expect(pesos('aluguel')).toEqual({
      'Ainda este mês': 3, 'Em até 3 meses': 2, 'Fiador': 1, 'Seguro fiança': 1, 'Caução': 1,
    });
  });
});

describe('modeloSugerido', () => {
  it('aluguel e temporada sugerem Aluguel', () => {
    expect(modeloSugerido({ transaction_type: 'rent' })).toBe('aluguel');
    expect(modeloSugerido({ transaction_type: 'season' })).toBe('aluguel');
  });
  it('empreendimento sugere Lançamento', () => {
    expect(modeloSugerido({ listing_kind: 'development' })).toBe('lancamento');
  });
  it('o resto é Revenda', () => {
    expect(modeloSugerido({})).toBe('revenda');
    expect(modeloSugerido({ transaction_type: 'sale', listing_kind: 'resale' })).toBe('revenda');
  });
});
