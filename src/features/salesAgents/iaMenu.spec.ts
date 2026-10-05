import { describe, expect, it } from 'vitest';

import { GRUPOS, TELAS, iaDaUrl, iaInicial, itensDoGrupo, paramsDaIa, telaDaUrl, telaInfo, trilhaDe } from './iaMenu';

const url = (q: string) => new URLSearchParams(q);
const COM = { insights: true };
const SEM = { insights: false };

describe('iaMenu', () => {
  it('ids únicos e todo grupo existe', () => {
    const ids = TELAS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const grupos = GRUPOS.map((g) => g.id);
    TELAS.forEach((t) => expect(grupos).toContain(t.grupo));
  });

  it('a barra tem Painel, Configurar, Ensinar, Testar e Diagnóstico, nesta ordem', () => {
    expect(GRUPOS.map((g) => g.rotulo)).toEqual(['Painel', 'Configurar', 'Ensinar', 'Testar', 'Diagnóstico']);
  });

  it('sem ?tela= abre a Visão geral; tela desconhecida também', () => {
    expect(telaDaUrl(url(''), COM)).toBe('visao-geral');
    expect(telaDaUrl(url('tela=xpto'), COM)).toBe('visao-geral');
    expect(telaDaUrl(url('tela=ensinar'), COM)).toBe('ensinar');
  });

  it('?tela= com nome de propriedade do objeto cai na Visão geral', () => {
    ['constructor', 'toString', '__proto__'].forEach((t) => expect(telaDaUrl(url(`tela=${t}`), COM)).toBe('visao-geral'));
  });

  it('Sugestões e Relatório semanal sem a chave caem na Visão geral', () => {
    expect(telaDaUrl(url('tela=sugestoes'), SEM)).toBe('visao-geral');
    expect(telaDaUrl(url('tela=relatorio-semanal'), SEM)).toBe('visao-geral');
    expect(telaDaUrl(url('tela=sugestoes'), COM)).toBe('sugestoes');
  });

  it('o ?agent= do assistente abre a IA em Configurar', () => {
    expect(iaDaUrl(url('agent=ia-7'))).toBe('ia-7');
    expect(telaDaUrl(url('agent=ia-7'), COM)).toBe('configurar');
    // Com tela explícita, vale a tela.
    expect(telaDaUrl(url('agent=ia-7&tela=testar'), COM)).toBe('testar');
  });

  it('?ia= ganha do ?agent=', () => {
    expect(iaDaUrl(url('ia=ia-1&agent=ia-2'))).toBe('ia-1');
    expect(iaDaUrl(url(''))).toBeNull();
  });

  it('o endereço omite a Visão geral e a IA vazia', () => {
    expect(paramsDaIa('ia-1', 'visao-geral')).toEqual({ ia: 'ia-1' });
    expect(paramsDaIa('ia-1', 'ensinar')).toEqual({ ia: 'ia-1', tela: 'ensinar' });
    expect(paramsDaIa(null, 'visao-geral')).toEqual({});
  });

  it('abre a IA do endereço, senão a última usada, senão a primeira', () => {
    expect(iaInicial(['a', 'b'], 'b', 'a')).toBe('b');
    expect(iaInicial(['a', 'b'], null, 'b')).toBe('b');
    expect(iaInicial(['a', 'b'], 'excluida', 'tambem-excluida')).toBe('a');
    expect(iaInicial([], 'a', 'b')).toBeNull();
  });

  it('Painel lista Visão geral, Sugestões e Relatório semanal; sem a chave, só a Visão geral', () => {
    expect(itensDoGrupo('painel', COM).map((t) => t.id)).toEqual(['visao-geral', 'sugestoes', 'relatorio-semanal']);
    expect(itensDoGrupo('painel', SEM).map((t) => t.id)).toEqual(['visao-geral']);
    expect(itensDoGrupo('configurar', SEM).map((t) => t.id)).toEqual(['configurar']);
  });

  it('trilha e textos', () => {
    expect(trilhaDe('sugestoes')).toBe('Painel');
    expect(trilhaDe('configurar')).toBe('');
    expect(telaInfo('relatorio-semanal').titulo).toBe('Relatório semanal');
  });
});
