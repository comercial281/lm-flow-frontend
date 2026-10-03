import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/services/core/api';
import { siteBuilderService } from './siteBuilderService';

vi.mock('@/services/core/api', () => ({ default: { post: vi.fn(), put: vi.fn() } }));

// O `page_params` do servidor só aceita estes nomes: com `content`/`meta_title`
// o Rails descarta em silêncio e a página nasce vazia.
describe('siteBuilderService · páginas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'p1' } } } as never);
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: 'p1' } } } as never);
  });

  it('createPage manda content_html e seo_* aninhados em page', async () => {
    await siteBuilderService.createPage('s1', {
      title: 'Sobre', content_html: '<p>Oi</p>', seo_title: 'T', seo_description: 'D',
    });
    expect(api.post).toHaveBeenCalledWith('/sites/s1/pages', {
      page: { title: 'Sobre', content_html: '<p>Oi</p>', seo_title: 'T', seo_description: 'D' },
    });
  });

  it('updatePage manda content_html', async () => {
    await siteBuilderService.updatePage('s1', 'p1', { content_html: '<p>Novo</p>' });
    expect(api.put).toHaveBeenCalledWith('/sites/s1/pages/p1', { page: { content_html: '<p>Novo</p>' } });
  });
});
