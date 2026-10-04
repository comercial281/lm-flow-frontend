import { describe, it, expect } from 'vitest';
import { TELAS, GRUPOS, telaDaUrl, itensDoGrupo, telaInfo, trilhaDe } from './meuSiteMenu';

describe('meuSiteMenu', () => {
  it('ids únicos e todo grupo existe', () => {
    const ids = TELAS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const grupos = GRUPOS.map(g => g.id);
    TELAS.forEach(t => expect(grupos).toContain(t.grupo));
  });

  it('lê ?tela= e cai no Painel quando não conhece', () => {
    expect(telaDaUrl(new URLSearchParams('tela=marca'))).toBe('marca');
    expect(telaDaUrl(new URLSearchParams('tela=xpto'))).toBe('painel');
    expect(telaDaUrl(new URLSearchParams(''))).toBe('painel');
  });

  it('link antigo ?tab= cai na tela nova equivalente', () => {
    const casos: [string, string][] = [['portal', 'painel'], ['config', 'aparencia'], ['pages', 'paginas'],
      ['articles', 'blog'], ['leads', 'contatos'], ['landings', 'anuncios']];
    casos.forEach(([tab, tela]) => expect(telaDaUrl(new URLSearchParams(`tab=${tab}`))).toBe(tela));
  });

  it('?tab= com nome de propriedade do objeto (constructor, toString) cai no Painel', () => {
    ['constructor', 'toString', '__proto__', 'hasOwnProperty'].forEach(tab =>
      expect(telaDaUrl(new URLSearchParams(`tab=${tab}`))).toBe('painel'));
  });

  it('Páginas de anúncio some sem a chave do cliente', () => {
    expect(itensDoGrupo('marketing', { podeAnuncios: false }).map(t => t.id)).not.toContain('anuncios');
    expect(itensDoGrupo('marketing', { podeAnuncios: true }).map(t => t.id)).toContain('anuncios');
  });

  it('Contatos do site e Painel não aparecem nas listas suspensas', () => {
    const todos = GRUPOS.flatMap(g => itensDoGrupo(g.id, { podeAnuncios: true })).map(t => t.id);
    expect(todos).not.toContain('contatos');
    expect(todos).not.toContain('painel');
  });

  it('trilha e textos', () => {
    expect(trilhaDe('marca')).toBe('Configurações');
    expect(trilhaDe('painel')).toBe('');
    expect(telaInfo('marca').titulo).toBe("Marca d'água");
  });

  it('as telas da página inicial ficam no Personalizar, logo depois de Aparência', () => {
    const ids = itensDoGrupo('personalizar', { podeAnuncios: true }).map(t => t.id);
    expect(ids.slice(ids.indexOf('aparencia'), ids.indexOf('aparencia') + 5))
      .toEqual(['aparencia', 'busca', 'vitrines', 'chamadas', 'buscados']);
    expect(telaDaUrl(new URLSearchParams('tela=vitrines'))).toBe('vitrines');
    expect(telaDaUrl(new URLSearchParams('tela=buscados'))).toBe('buscados');
    expect(telaInfo('busca').titulo).toBe('Busca rápida');
    expect(trilhaDe('chamadas')).toBe('Personalizar');
  });

  it('Página do imóvel e Lista de imóveis ficam no Personalizar, logo depois da página inicial', () => {
    const ids = itensDoGrupo('personalizar', { podeAnuncios: true }).map(t => t.id);
    expect(ids.slice(ids.indexOf('buscados'), ids.indexOf('buscados') + 3)).toEqual(['buscados', 'ficha', 'lista']);
    expect(telaDaUrl(new URLSearchParams('tela=ficha'))).toBe('ficha');
    expect(telaDaUrl(new URLSearchParams('tela=lista'))).toBe('lista');
    expect(telaInfo('ficha').titulo).toBe('Página do imóvel');
    expect(telaInfo('lista').titulo).toBe('Lista de imóveis');
    expect(trilhaDe('ficha')).toBe('Personalizar');
    expect(trilhaDe('lista')).toBe('Personalizar');
  });
});
