import { describe, expect, it } from 'vitest';
import { GRUPOS, iaInicial, itensDoGrupo, paginaPedida, paramsDaIa, pediuTestar, telaDaUrl } from './iaMenu';

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

  it('a página só fica no endereço em Configurar e Ensinar', () => {
    expect(paramsDaIa('ia-1', 'configurar', 'destino')).toEqual({ ia: 'ia-1', tela: 'configurar', pagina: 'destino' });
    expect(paramsDaIa('ia-1', 'ensinar', 'exemplos')).toEqual({ ia: 'ia-1', tela: 'ensinar', pagina: 'exemplos' });
    expect(paramsDaIa('ia-1', 'visao-geral', 'exemplos')).toEqual({ ia: 'ia-1' });
    expect(paramsDaIa('ia-1', 'visao-geral')).toEqual({ ia: 'ia-1' });
  });

  it('o ?agent= de link antigo continua abrindo Configurar', () => {
    expect(telaDaUrl(url('agent=ia-1'), CLIENTE)).toBe('configurar');
  });

  it('a página pedida depende da tela (o endereço do Ensinar sobrevive à normalização)', () => {
    const p = new URLSearchParams('ia=ia-1&tela=ensinar&pagina=exemplos');
    expect(paginaPedida(p, 'ensinar')).toBe('exemplos');
    expect(paginaPedida(new URLSearchParams('ia=ia-1&tela=ensinar&pagina=regras'), 'ensinar')).toBe('licoes');
    expect(paginaPedida(p, 'configurar')).toBeNull();
    expect(paginaPedida(new URLSearchParams('pagina=destino'), 'ensinar')).toBeNull();
    expect(paginaPedida(new URLSearchParams('pagina=destino'), 'configurar')).toBe('destino');
    const certo = paramsDaIa('ia-1', 'ensinar', paginaPedida(p, 'ensinar'));
    expect(new URLSearchParams(certo).toString()).toBe(p.toString());
  });
});

describe('iaInicial (Tarefa 68)', () => {
  const ids = ['ia-1', 'ia-2'];
  it('sem IA no endereço não escolhe nenhuma (a entrada é a página de agentes)', () => {
    expect(iaInicial(ids, null)).toBeNull();
  });
  it('IA do endereço que existe vale', () => {
    expect(iaInicial(ids, 'ia-2')).toBe('ia-2');
  });
  it('IA do endereço que não existe mais cai na primeira; sem nenhuma, nula', () => {
    expect(iaInicial(ids, 'excluida')).toBe('ia-1');
    expect(iaInicial([], 'excluida')).toBeNull();
  });
  it('link salvo de agente juntado abre o agente que o absorveu, não o primeiro', () => {
    expect(iaInicial(['ia-1', 'ia-2'], 'velha', { velha: 'ia-2' })).toBe('ia-2');
  });
  it('junção em cadeia segue até o agente vivo; ciclo ou destino sumido cai na primeira', () => {
    expect(iaInicial(['ia-1', 'ia-2'], 'a', { a: 'b', b: 'ia-2' })).toBe('ia-2');
    expect(iaInicial(['ia-1', 'ia-2'], 'a', { a: 'b', b: 'a' })).toBe('ia-1');
    expect(iaInicial(['ia-1', 'ia-2'], 'a', { a: 'sumido' })).toBe('ia-1');
  });
});
