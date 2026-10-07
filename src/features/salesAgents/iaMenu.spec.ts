import { describe, expect, it } from 'vitest';
import { GRUPOS, itensDoGrupo, paramsDaIa, pediuTestar, telaDaUrl } from './iaMenu';

const url = (s: string) => new URLSearchParams(s);
const CLIENTE = { insights: true, equipe: false, motor: false };
const EQUIPE = { insights: true, equipe: true, motor: true };

describe('iaMenu (onda 3)', () => {
  it('o menu tem 3 itens: Painel, Configurar, Ensinar', () => {
    expect(GRUPOS.map((g) => g.rotulo)).toEqual(['Painel', 'Configurar', 'Ensinar']);
    expect(itensDoGrupo('painel', { insights: false }).map((t) => t.id)).toEqual(['visao-geral']);
  });

  it('Diagnóstico e Motor ficam fora do menu e, sem permissão, caem na Visão geral', () => {
    expect(telaDaUrl(url('tela=diagnostico'), CLIENTE)).toBe('visao-geral');
    expect(telaDaUrl(url('tela=diagnostico'), EQUIPE)).toBe('diagnostico');
    expect(telaDaUrl(url('tela=motor'), CLIENTE)).toBe('visao-geral');
    expect(telaDaUrl(url('tela=motor'), { ...CLIENTE, motor: true })).toBe('motor');
  });

  it('tela do protótipo (constructor, __proto__) cai na Visão geral', () => {
    expect(telaDaUrl(url('tela=constructor'), EQUIPE)).toBe('visao-geral');
    expect(telaDaUrl(url('tela=__proto__'), EQUIPE)).toBe('visao-geral');
  });

  it('?tela=testar antigo abre a Visão geral (a janela abre por cima)', () => {
    expect(telaDaUrl(url('tela=testar'), CLIENTE)).toBe('visao-geral');
    expect(pediuTestar(url('ia=1&tela=testar'))).toBe(true);
    expect(pediuTestar(url('ia=1'))).toBe(false);
  });

  it('?passo=avancado antigo abre o Motor (com permissão) ou o Configurar', () => {
    expect(telaDaUrl(url('tela=configurar&passo=avancado'), EQUIPE)).toBe('motor');
    expect(telaDaUrl(url('tela=configurar&passo=avancado'), CLIENTE)).toBe('configurar');
  });

  it('a página só fica no endereço em Configurar', () => {
    expect(paramsDaIa('ia-1', 'configurar', 'destino')).toEqual({ ia: 'ia-1', tela: 'configurar', pagina: 'destino' });
    expect(paramsDaIa('ia-1', 'ensinar', 'destino')).toEqual({ ia: 'ia-1', tela: 'ensinar' });
    expect(paramsDaIa('ia-1', 'visao-geral')).toEqual({ ia: 'ia-1' });
  });

  it('o ?agent= de link antigo continua abrindo Configurar', () => {
    expect(telaDaUrl(url('agent=ia-1'), CLIENTE)).toBe('configurar');
  });
});
