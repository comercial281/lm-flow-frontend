import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TelaMarcaDagua from './TelaMarcaDagua';
import { propertiesService } from '@/services/properties/propertiesService';

vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: vi.fn() } }));
vi.mock('@/services/siteBuilder/siteBuilderService', () => ({
  siteBuilderService: { uploadWatermarkLogo: vi.fn(), removeWatermarkLogo: vi.fn() },
}));

const site = { id: 's1', watermark: { enabled: true, position: 'center', opacity: 60, logo_url: 'https://x/logo.png' } } as never;
const montar = () => render(
  <TelaMarcaDagua site={site} siteForm={{ name: 'Imob', watermark: { enabled: true, position: 'center', opacity: 60 } }}
    setF={vi.fn()} onLogoAtualizado={vi.fn()} />,
);
const fotoDoPreview = () => document.querySelector('img[src^="https://cdn/"]')?.getAttribute('src');

describe('TelaMarcaDagua', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preview usa a capa de um imóvel publicado no site', async () => {
    vi.mocked(propertiesService.list).mockResolvedValue({
      data: [
        { id: '1', cover_photo_url: null, published_on_site: true },
        { id: '2', cover_photo_url: 'https://cdn/fora.jpg', published_on_site: false },
        { id: '3', cover_photo_url: 'https://cdn/no-site.jpg', published_on_site: true },
      ],
      meta: { total: 3, page: 1, per_page: 20 },
    } as never);
    montar();
    await waitFor(() => expect(fotoDoPreview()).toBe('https://cdn/no-site.jpg'));
    expect(screen.queryByText('Foto de exemplo')).toBeNull();
    expect(propertiesService.list).toHaveBeenCalledWith(expect.objectContaining({ per_page: expect.any(Number) }));
  });

  it('sem imóvel publicado, usa o primeiro com capa', async () => {
    vi.mocked(propertiesService.list).mockResolvedValue({
      data: [{ id: '2', cover_photo_url: 'https://cdn/fora.jpg', published_on_site: false }],
      meta: { total: 1, page: 1, per_page: 20 },
    } as never);
    montar();
    await waitFor(() => expect(fotoDoPreview()).toBe('https://cdn/fora.jpg'));
  });

  it('falha ou nenhuma foto: fica o quadro cinza "Foto de exemplo"', async () => {
    vi.mocked(propertiesService.list).mockRejectedValue(new Error('x'));
    montar();
    await waitFor(() => expect(propertiesService.list).toHaveBeenCalled());
    expect(screen.getByText('Foto de exemplo')).toBeTruthy();
  });
});
