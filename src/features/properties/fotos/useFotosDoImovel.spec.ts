import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';

const svc = vi.hoisted(() => ({
  list: vi.fn(), upload: vi.fn(), create: vi.fn(), update: vi.fn(),
  delete: vi.fn(), setAsCover: vi.fn(), reorder: vi.fn(),
}));
vi.mock('@/services/propertyPhotos/propertyPhotosService', async orig => ({
  ...(await orig<typeof import('@/services/propertyPhotos/propertyPhotosService')>()),
  propertyPhotosService: svc,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { useFotosDoImovel } from './useFotosDoImovel';

const foto = (id: string, extra: Partial<PropertyPhoto> = {}) =>
  ({ id, property_id: 'p1', file_url: `https://x/${id}.jpg`, photo_type: 'main', content_type: 'image/jpeg',
     position: 0, is_cover: false, published: true, created_at: '', ...extra }) as PropertyPhoto;
const video = (id: string) => foto(id, { photo_type: 'video', content_type: 'video/mp4' });

async function montar(lista: PropertyPhoto[]) {
  svc.list.mockResolvedValue(lista);
  const h = renderHook(() => useFotosDoImovel('p1'));
  await waitFor(() => expect(h.result.current.carregando).toBe(false));
  return h;
}

beforeEach(() => { Object.values(svc).forEach(f => f.mockReset()); Object.values(toast).forEach(f => f.mockReset()); });

describe('useFotosDoImovel', () => {
  it('carrega e calcula a capa', async () => {
    const h = await montar([foto('a'), foto('b')]);
    expect(h.result.current.fotos.map(p => p.id)).toEqual(['a', 'b']);
    expect(h.result.current.capaId).toBe('a');
  });

  it('erro de leitura vira erro, não lista vazia', async () => {
    svc.list.mockRejectedValue(new Error('rede'));
    const h = renderHook(() => useFotosDoImovel('p1'));
    await waitFor(() => expect(h.result.current.carregando).toBe(false));
    expect(h.result.current.erro).toBe(true);
  });

  it('mover grava fotos e depois mídias', async () => {
    const h = await montar([foto('a'), video('v'), foto('b')]);
    svc.reorder.mockResolvedValue([foto('b'), foto('a'), video('v')]);
    await act(() => h.result.current.mover('imagens', 'b', 'a'));
    expect(svc.reorder).toHaveBeenCalledWith('p1', [
      { id: 'b', position: 0 }, { id: 'a', position: 1 }, { id: 'v', position: 2 },
    ]);
    expect(h.result.current.fotos.map(p => p.id)).toEqual(['b', 'a', 'v']);
  });

  it('mover que falha avisa e relê do servidor', async () => {
    const h = await montar([foto('a'), foto('b')]);
    svc.reorder.mockRejectedValue(new Error('x'));
    svc.list.mockResolvedValue([foto('a'), foto('b')]);
    await act(() => h.result.current.mover('imagens', 'b', 'a'));
    expect(toast.error).toHaveBeenCalledWith('Não deu pra salvar a ordem. Tente de novo.');
    expect(svc.list).toHaveBeenCalledTimes(2);
  });

  it('enviar recusa arquivo ruim, sobe o resto sem tipo e põe vídeo no fim', async () => {
    const h = await montar([foto('a'), video('v')]);
    const ok = new File(['x'], 'n.jpg', { type: 'image/jpeg' });
    const ruim = new File(['x'], 'n.exe', { type: 'application/x-msdownload' });
    svc.upload.mockResolvedValue([foto('n')]);
    svc.reorder.mockResolvedValue([foto('a'), foto('n'), video('v')]);
    await act(() => h.result.current.enviar([ok, ruim]));
    expect(toast.error).toHaveBeenCalledWith('n.exe: tipo de arquivo não aceito');
    const [, arquivos, opts] = svc.upload.mock.calls[0];
    expect(arquivos).toEqual([ok]);
    expect(opts.photoType).toBeUndefined();
    expect(svc.reorder).toHaveBeenCalledWith('p1', [
      { id: 'a', position: 0 }, { id: 'n', position: 1 }, { id: 'v', position: 2 },
    ]);
    expect(h.result.current.fotos.map(p => p.id)).toEqual(['a', 'n', 'v']);
  });

  it('enviar sem precisar arrumar a ordem não grava ordem', async () => {
    const h = await montar([foto('a')]);
    svc.upload.mockResolvedValue([foto('n')]);
    await act(() => h.result.current.enviar([new File(['x'], 'n.jpg', { type: 'image/jpeg' })]));
    expect(svc.reorder).not.toHaveBeenCalled();
  });

  it('emLote ocultar pula a capa', async () => {
    const h = await montar([foto('a'), foto('b'), foto('c')]);
    svc.update.mockImplementation(async (_p: string, id: string) => foto(id, { published: false }));
    svc.list.mockResolvedValue([foto('a'), foto('b', { published: false }), foto('c', { published: false })]);
    let r!: { feitos: number; falhas: number; pulouCapa: boolean };
    await act(async () => { r = await h.result.current.emLote(['a', 'b', 'c'], 'ocultar'); });
    expect(svc.update).toHaveBeenCalledTimes(2);
    expect(svc.update).not.toHaveBeenCalledWith('p1', 'a', expect.anything());
    expect(r).toEqual({ feitos: 2, falhas: 0, pulouCapa: true });
  });

  it('emLote conta as falhas e relê', async () => {
    const h = await montar([foto('a'), foto('b'), foto('c')]);
    svc.delete.mockImplementation(async (_p: string, id: string) => { if (id === 'b') throw new Error('x'); });
    svc.list.mockResolvedValue([foto('a'), foto('b')]);
    let r!: { feitos: number; falhas: number; pulouCapa: boolean };
    await act(async () => { r = await h.result.current.emLote(['b', 'c'], 'excluir'); });
    expect(r).toEqual({ feitos: 1, falhas: 1, pulouCapa: false });
    expect(h.result.current.fotos.map(p => p.id)).toEqual(['a', 'b']);
  });

  it('usar como capa leva pra frente', async () => {
    const h = await montar([foto('a'), foto('b')]);
    svc.setAsCover.mockResolvedValue(foto('b', { is_cover: true }));
    await act(() => h.result.current.usarComoCapa('b'));
    expect(h.result.current.capaId).toBe('b');
    expect(h.result.current.fotos.map(p => p.id)).toEqual(['b', 'a']);
  });
});
