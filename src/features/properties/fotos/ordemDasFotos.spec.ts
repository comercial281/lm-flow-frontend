import { describe, expect, it } from 'vitest';
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';
import { idDaCapa, moverParaCapa, posicoes } from './ordemDasFotos';

const foto = (id: string, extra: Partial<PropertyPhoto> = {}) =>
  ({ id, photo_type: 'main', content_type: 'image/jpeg', is_cover: false, published: true, ...extra }) as PropertyPhoto;

describe('ordemDasFotos', () => {
  it('a capa é a marcada; sem marca, a primeira imagem', () => {
    expect(idDaCapa([foto('a'), foto('b', { is_cover: true })])).toBe('b');
    expect(idDaCapa([foto('v', { content_type: 'video/mp4' }), foto('a'), foto('b')])).toBe('a');
    expect(idDaCapa([foto('v', { photo_type: 'video', content_type: null as unknown as string })])).toBeNull();
    expect(idDaCapa([])).toBeNull();
  });

  it('definir capa leva a foto pra frente e mantém a ordem das outras', () => {
    const lista = moverParaCapa([foto('a', { is_cover: true }), foto('b'), foto('c')], 'c');
    expect(lista.map(p => p.id)).toEqual(['c', 'a', 'b']);
    expect(lista.filter(p => p.is_cover).map(p => p.id)).toEqual(['c']);
  });

  it('posições seguem a ordem da lista, a partir de zero', () => {
    expect(posicoes([foto('b'), foto('a')])).toEqual([{ id: 'b', position: 0 }, { id: 'a', position: 1 }]);
  });
});
