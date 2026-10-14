import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';

const svc = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/services/propertyPhotos/propertyPhotosService', async orig => ({
  ...(await orig<typeof import('@/services/propertyPhotos/propertyPhotosService')>()),
  propertyPhotosService: svc,
}));

import SecaoMidia from './SecaoMidia';
import { CamposTravadosContext } from '@/features/properties/cadastro/travasDoSite';

const foto = (id: string, extra: Partial<PropertyPhoto> = {}) =>
  ({ id, file_url: `https://x/${id}.jpg`, photo_type: 'main', content_type: 'image/jpeg', published: true, is_cover: false, ...extra }) as PropertyPhoto;

const base = {
  form: { video_url: null, virtual_tour_url: null, listing_kind: 'resale' } as never,
  setF: vi.fn(),
  arquivos: [], aoMudarArquivos: vi.fn(), enviando: false,
  book: null, aoMudarBook: vi.fn(), aoMudarImovel: vi.fn(),
};

describe('SecaoMidia com vídeo vindo do site', () => {
  it('trava só o link do vídeo; tour, fotos e book seguem livres', async () => {
    svc.list.mockResolvedValue([]);
    render(<CamposTravadosContext.Provider value={['video_url']}>
      <SecaoMidia {...base} editando={{ id: 'p1', photos_count: 0, feed: { source_id: 's', external_url: null, locked_fields: ['video_url'] } } as never}
        aoGerenciarFotos={vi.fn()} />
    </CamposTravadosContext.Provider>);
    expect(screen.getByLabelText('Link do vídeo (YouTube)')).toBeDisabled();
    expect(screen.getByLabelText('Link do tour virtual')).toBeEnabled();
    expect(screen.getByRole('button', { name: /Gerenciar fotos e vídeos/ })).toBeEnabled();
  });
});

describe('SecaoMidia na edição', () => {
  it('mostra as primeiras fotos visíveis e leva pra página de fotos', async () => {
    svc.list.mockResolvedValue([
      foto('1'), foto('2', { published: false }), foto('3'), foto('4'), foto('5'), foto('6'), foto('7'), foto('8'),
      foto('v', { photo_type: 'video', content_type: 'video/mp4' }),
    ]);
    const aoGerenciarFotos = vi.fn();
    const { container } = render(<SecaoMidia {...base} editando={{ id: 'p1', photos_count: 9 } as never} aoGerenciarFotos={aoGerenciarFotos} />);
    // As miniaturas são decorativas (alt=""), fora da árvore de acessibilidade.
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(6));
    expect(screen.getByText('+1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Gerenciar fotos e vídeos/ }));
    expect(aoGerenciarFotos).toHaveBeenCalled();
  });
});
