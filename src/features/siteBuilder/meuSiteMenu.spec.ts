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
});
