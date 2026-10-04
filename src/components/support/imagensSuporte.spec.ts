import { describe, it, expect } from 'vitest';
import { juntarImagens, MAX_BYTES } from './imagensSuporte';

const img = (nome = 'p.png', tipo = 'image/png', bytes = 10) => new File([new Uint8Array(bytes)], nome, { type: tipo });

describe('imagens do suporte', () => {
  it('aceita até 3', () => {
    const r = juntarImagens([img(), img()], [img(), img()]);
    expect(r.imagens).toHaveLength(3);
    expect(r.erro).toBe('Até 3 imagens por mensagem.');
  });

  it('recusa tipo que não é PNG, JPG ou WEBP', () => {
    const r = juntarImagens([], [img('x.svg', 'image/svg+xml'), img('a.webp', 'image/webp')]);
    expect(r.imagens.map(f => f.name)).toEqual(['a.webp']);
    expect(r.erro).toBe('Envie imagens em PNG, JPG ou WEBP.');
  });

  it('recusa acima de 5 MB', () => {
    const r = juntarImagens([], [img('g.png', 'image/png', MAX_BYTES + 1)]);
    expect(r.imagens).toEqual([]);
    expect(r.erro).toBe('Cada imagem pode ter até 5 MB.');
  });
});
