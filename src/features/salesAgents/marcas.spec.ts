import { describe, expect, it } from 'vitest';
import { CONHECIMENTOS_DA_MARCA, TITULO_DO_CONHECIMENTO, conhecimentosLigados } from './marcas';

describe('conhecimentos de fábrica por marca (espelho da fase 3)', () => {
  it('Empreendimento liga MCMV, Financiamento, FGTS e Compra na planta', () => {
    expect(conhecimentosLigados(['empreendimento'])).toEqual(['mcmv', 'financiamento', 'fgts', 'compra_planta']);
  });

  it('Venda, Leilão e Locação ligam os deles', () => {
    expect(conhecimentosLigados(['venda'])).toEqual(['financiamento', 'fgts', 'custos_compra', 'vender_atual']);
    expect(conhecimentosLigados(['leilao'])).toEqual(['financiamento', 'custos_compra', 'compra_leilao']);
    expect(conhecimentosLigados(['locacao'])).toEqual(['locacao']);
  });

  it('juntar marcas não repete e segue a ordem da tabela', () => {
    expect(conhecimentosLigados(['venda', 'empreendimento'])).toEqual(['mcmv', 'financiamento', 'fgts', 'compra_planta', 'custos_compra', 'vender_atual']);
  });

  it('sem marca, nenhum conhecimento', () => {
    expect(conhecimentosLigados([])).toEqual([]);
    expect(conhecimentosLigados(null)).toEqual([]);
  });

  it('os 8 tópicos têm título e aparecem em alguma marca', () => {
    const todos = new Set(Object.values(CONHECIMENTOS_DA_MARCA).flat());
    expect(todos.size).toBe(8);
    todos.forEach((t) => expect(TITULO_DO_CONHECIMENTO[t]).toBeTruthy());
  });
});
