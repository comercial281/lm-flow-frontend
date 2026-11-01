import { describe, expect, it } from 'vitest';
import {
  GRUPOS_DO_ENSINAR, PAGINAS_DO_ENSINAR, PAGINA_INICIAL_DO_ENSINAR, ROTULO_DA_ORIGEM, TEMAS,
  casosDe, conversasReais, paginaDoEnsinarDaUrl, textoDosCasos,
} from './paginas';

describe('registro do Ensinar', () => {
  it('são 5 páginas, na ordem da seção 4 da spec', () => {
    expect(GRUPOS_DO_ENSINAR.flatMap((g) => g.paginas)).toEqual(['licoes', 'exemplos', 'casa', 'conhecimentos', 'arquivos']);
    expect(Object.keys(PAGINAS_DO_ENSINAR)).toHaveLength(5);
    expect(PAGINAS_DO_ENSINAR.casa.titulo).toBe('Regras e objeções da casa');
    expect(PAGINAS_DO_ENSINAR.arquivos.titulo).toBe('Arquivos e prova social');
    expect(PAGINA_INICIAL_DO_ENSINAR).toBe('licoes');
  });

  it('lê a página do endereço; os endereços antigos caem no destino novo', () => {
    expect(paginaDoEnsinarDaUrl(new URLSearchParams('pagina=casa'))).toBe('casa');
    expect(paginaDoEnsinarDaUrl(new URLSearchParams('pagina=instrucoes'))).toBe('casa');
    expect(paginaDoEnsinarDaUrl(new URLSearchParams('pagina=regras'))).toBe('licoes');
    expect(paginaDoEnsinarDaUrl(new URLSearchParams('pagina=prova'))).toBe('arquivos');
  });

  it('desconhecida, vazia ou da cadeia do objeto vira null', () => {
    expect(paginaDoEnsinarDaUrl(new URLSearchParams('pagina=destino'))).toBeNull();
    expect(paginaDoEnsinarDaUrl(new URLSearchParams('pagina=constructor'))).toBeNull();
    expect(paginaDoEnsinarDaUrl(new URLSearchParams('pagina=toString'))).toBeNull();
    expect(paginaDoEnsinarDaUrl(new URLSearchParams(''))).toBeNull();
  });

  it('cada tema e cada origem tem rótulo próprio, sem travessão', () => {
    expect(Object.keys(TEMAS)).toEqual(['preco', 'tom', 'objecao', 'visita', 'documento', 'abertura', 'outro']);
    expect(ROTULO_DA_ORIGEM.sugestao).not.toBe(ROTULO_DA_ORIGEM.correcao);
    expect(new Set(Object.values(ROTULO_DA_ORIGEM)).size).toBe(3);
    [...Object.values(TEMAS), ...Object.values(ROTULO_DA_ORIGEM)].forEach((t) => expect(t).not.toMatch(/[—–]/));
  });

  it('conversas reais espelham o servidor: resposta vazia sai, texto solto vale, reply só sem resposta', () => {
    expect(conversasReais([
      { lead: 'a', resposta: '  ' },
      { lead: ' b ', resposta: ' ok ' },
      'solto',
      '   ',
      { lead: 'c', reply: 'pelo reply' },
      { lead: 'd', resposta: '', reply: 'não cai pro reply' },
      42,
      null,
    ])).toEqual([
      { indice: 1, lead: 'b', resposta: 'ok' },
      { indice: 2, lead: '', resposta: 'solto' },
      { indice: 4, lead: 'c', resposta: 'pelo reply' },
    ]);
    expect(conversasReais(null)).toEqual([]);
    expect(conversasReais(undefined)).toEqual([]);
  });

  it('prova social: divide por linha sem caso vazio e junta de volta', () => {
    expect(casosDe('  A \n\n B\n')).toEqual(['A', 'B']);
    expect(casosDe(null)).toEqual([]);
    expect(textoDosCasos(['A', 'B'])).toBe('A\nB');
    expect(textoDosCasos([])).toBeNull();
    expect(textoDosCasos(casosDe('A\nB'))).toBe('A\nB');
  });
});
