import { describe, expect, it } from 'vitest';
import { comListaNoEndereco, lerListaDoEndereco } from './listaNoEndereco';

// A lista de Contatos no endereço (10/10/2026): ida e volta, e o que não vale cai no padrão.
const ler = (q: string) => lerListaDoEndereco(new URLSearchParams(q));

describe('lerListaDoEndereco / comListaNoEndereco', () => {
  it('ida e volta: o que foi gravado é o que se lê', () => {
    const lista = {
      busca: 'ana',
      pilula: 'meus' as const,
      filtros: { comEtiqueta: 'quente', semEtiquetas: ['frio', 'teste'], responsavel: 'u9' },
      pagina: 3,
      porPagina: 50,
    };
    expect(lerListaDoEndereco(comListaNoEndereco(new URLSearchParams(), lista))).toEqual(lista);
  });

  it('valor padrão não vai pro endereço, e os outros parâmetros ficam', () => {
    const vazio = { busca: '', pilula: 'todos' as const, filtros: { comEtiqueta: '', semEtiquetas: [], responsavel: '' }, pagina: 1, porPagina: null };
    expect(comListaNoEndereco(new URLSearchParams('suporte=7&busca=x'), vazio).toString()).toBe('suporte=7');
  });

  it('?por= só aceita os tamanhos do seletor (10, 20, 50, 100); outro cai no padrão', () => {
    expect(ler('por=50').porPagina).toBe(50);
    expect(ler('por=100').porPagina).toBe(100);
    expect(ler('por=100000').porPagina).toBeNull();
    expect(ler('por=7').porPagina).toBeNull();
    expect(ler('por=abc').porPagina).toBeNull();
  });

  it('pílula e página inválidas caem no padrão', () => {
    expect(ler('pilula=qualquer&pagina=-2').pilula).toBe('todos');
    expect(ler('pagina=0').pagina).toBe(1);
  });
});
