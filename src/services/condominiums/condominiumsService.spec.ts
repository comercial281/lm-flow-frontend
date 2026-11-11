import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));

import { condominiumsService } from './condominiumsService';
import { propertyPhotosService } from '@/services/propertyPhotos/propertyPhotosService';

describe('condominiumsService', () => {
  beforeEach(() => { Object.values(api).forEach(f => f.mockReset()); });

  it('list manda a busca em params', async () => {
    api.get.mockResolvedValue({ data: { data: [], meta: { total: 0, page: 1, per_page: 20, cities: [] } } });
    await condominiumsService.list({ q: 'perd' });
    expect(api.get).toHaveBeenCalledWith('/condominiums', { params: { q: 'perd' } });
  });
  it('get desembrulha o data', async () => {
    api.get.mockResolvedValue({ data: { data: { id: 'c1' } } });
    expect(await condominiumsService.get('c1')).toEqual({ id: 'c1' });
  });
  it('update manda { condominium }', async () => {
    api.put.mockResolvedValue({ data: { data: { id: 'c1' } } });
    await condominiumsService.update('c1', { name: 'X' });
    expect(api.put).toHaveBeenCalledWith('/condominiums/c1', { condominium: { name: 'X' } });
  });
  it('fotos.upload posta em /condominiums/c1/photos/upload', async () => {
    api.post.mockResolvedValue({ data: { data: [] } });
    await condominiumsService.fotos.upload('c1', [new File(['a'], 'a.jpg')]);
    expect(api.post.mock.calls[0][0]).toBe('/condominiums/c1/photos/upload');
  });
  it('id vai codificado no endereço (get, update, remove e fotos)', async () => {
    api.get.mockResolvedValue({ data: { data: { id: 'a/b' } } });
    api.put.mockResolvedValue({ data: { data: { id: 'a/b' } } });
    api.delete.mockResolvedValue({ data: {} });
    api.post.mockResolvedValue({ data: { data: [] } });
    await condominiumsService.get('a/b?x');
    expect(api.get).toHaveBeenLastCalledWith('/condominiums/a%2Fb%3Fx');
    await condominiumsService.update('a/b', { name: 'X' });
    expect(api.put).toHaveBeenCalledWith('/condominiums/a%2Fb', { condominium: { name: 'X' } });
    await condominiumsService.remove('a/b');
    expect(api.delete).toHaveBeenCalledWith('/condominiums/a%2Fb');
    await condominiumsService.fotos.upload('a/b', [new File(['a'], 'a.jpg')]);
    expect(api.post.mock.calls[0][0]).toBe('/condominiums/a%2Fb/photos/upload');
    await condominiumsService.fotos.list('a/b');
    expect(api.get).toHaveBeenLastCalledWith('/condominiums/a%2Fb/photos');
  });
  it('propertyPhotosService.upload continua em /properties/p1/photos/upload', async () => {
    api.post.mockResolvedValue({ data: { data: [] } });
    await propertyPhotosService.upload('p1', [new File(['a'], 'a.jpg')]);
    expect(api.post.mock.calls[0][0]).toBe('/properties/p1/photos/upload');
    expect(api.post.mock.calls[0][2].headers['Content-Type']).toBe('multipart/form-data');
  });
});
