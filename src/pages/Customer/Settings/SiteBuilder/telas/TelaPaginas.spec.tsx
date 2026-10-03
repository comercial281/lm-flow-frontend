import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelaPaginas from './TelaPaginas';
import { siteBuilderService } from '@/services/siteBuilder/siteBuilderService';

vi.mock('@/services/siteBuilder/siteBuilderService', () => ({
  siteBuilderService: { listPages: vi.fn(), createPage: vi.fn(), updatePage: vi.fn(), deletePage: vi.fn() },
}));

const site = { id: 's1' } as never;
const pagina = {
  id: 'p1', site_id: 's1', title: 'Sobre nós', slug: 'sobre-nos', page_kind: 'portal_static',
  content_html: '<p>Somos a XYZ</p>', active: true, in_menu: true, menu_position: 0,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
};

describe('TelaPaginas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(siteBuilderService.listPages).mockResolvedValue([pagina] as never);
    vi.mocked(siteBuilderService.updatePage).mockResolvedValue(pagina as never);
  });

  it('editar uma página mostra o content_html dela e salva com o mesmo nome', async () => {
    render(<TelaPaginas site={site} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar página' }));
    const corpo = screen.getByPlaceholderText('<h1>...</h1>') as HTMLTextAreaElement;
    expect(corpo.value).toBe('<p>Somos a XYZ</p>');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(siteBuilderService.updatePage).toHaveBeenCalledWith(
      's1', 'p1', expect.objectContaining({ content_html: '<p>Somos a XYZ</p>' }),
    ));
    expect(vi.mocked(siteBuilderService.updatePage).mock.calls[0][2]).not.toHaveProperty('content');
  });
});
