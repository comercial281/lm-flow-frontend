import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';

const svc = vi.hoisted(() => ({
  list: vi.fn(), upload: vi.fn(), create: vi.fn(), update: vi.fn(),
  delete: vi.fn(), setAsCover: vi.fn(), reorder: vi.fn(),
}));
vi.mock('@/services/propertyPhotos/propertyPhotosService', async orig => ({
  ...(await orig<typeof import('@/services/propertyPhotos/propertyPhotosService')>()),
  propertyPhotosService: svc,
}));
const props = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async orig => ({
  ...(await orig<typeof import('@/services/properties/propertiesService')>()),
  propertiesService: props,
}));
const permitido = vi.hoisted(() => ({ fn: (_r: string, _a: string) => true }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => (r: string, a: string) => permitido.fn(r, a) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import FotosDoImovel from './FotosDoImovel';

const foto = (id: string, extra: Partial<PropertyPhoto> = {}) =>
  ({ id, property_id: 'p1', file_url: `https://x/${id}.jpg`, photo_type: 'main', content_type: 'image/jpeg',
     position: 0, is_cover: false, published: true, created_at: '', ...extra }) as PropertyPhoto;
const video = (id: string, extra: Partial<PropertyPhoto> = {}) =>
  foto(id, { photo_type: 'video', content_type: 'video/mp4', file_size_bytes: 5_000_000, file_name: `${id}.mp4`, ...extra });

function abrir(lista: PropertyPhoto[], endereco = '/properties/p1/fotos') {
  svc.list.mockResolvedValue(lista);
  props.get.mockResolvedValue({ id: 'p1', code: 'AP0566', title: 'Apto no Cambuí', listing_kind: 'resale' });
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/properties/:id/fotos" element={<FotosDoImovel />} />
        <Route path="/properties/:id/editar" element={<p>cadastro aberto</p>} />
        <Route path="/properties" element={<p>lista aberta</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(svc).forEach(f => f.mockReset());
  props.get.mockReset();
  permitido.fn = () => true;
});

describe('FotosDoImovel', () => {
  it('mostra título, imóvel, capa e as abas com contagem', async () => {
    abrir([foto('a'), foto('b', { published: false }), video('v')]);
    expect(await screen.findByText('AP0566 · Apto no Cambuí')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Fotos e vídeos/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Capa' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tudo 3' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Fotos 2' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Vídeos e áudios 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ocultas 1' })).toBeInTheDocument();
  });

  it('vindo do cadastro, volta pro cadastro', async () => {
    abrir([foto('a')], '/properties/p1/fotos?de=cadastro');
    await userEvent.click(await screen.findByRole('link', { name: /Voltar ao cadastro/ }));
    expect(screen.getByText('cadastro aberto')).toBeInTheDocument();
  });

  it('erro de leitura mostra Tentar de novo', async () => {
    svc.list.mockRejectedValue(new Error('x'));
    props.get.mockResolvedValue({ id: 'p1', code: 'AP0566', title: 'Apto', listing_kind: 'resale' });
    render(
      <MemoryRouter initialEntries={['/properties/p1/fotos']}>
        <Routes><Route path="/properties/:id/fotos" element={<FotosDoImovel />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('imóvel sem foto mostra o vazio', async () => {
    abrir([]);
    expect(await screen.findByText('Nenhuma foto ainda')).toBeInTheDocument();
  });

  it('capa oculta mostra o aviso', async () => {
    abrir([foto('a', { is_cover: true, published: false }), foto('b')]);
    expect(await screen.findByText('A capa está oculta. No site e nos portais aparece a próxima foto visível.')).toBeInTheDocument();
  });
});
