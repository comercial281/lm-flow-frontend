import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Site } from '@/services/siteBuilder/siteBuilderService';

// A casca do Meu site: qual tela abre pelo endereço, o caminho de criar o site
// e a BarraSalvar única. As telas em si são o JSX que já existia, só movido.

const mocks = vi.hoisted(() => ({
  listSites: vi.fn(),
  updateSite: vi.fn(),
  createSite: vi.fn(),
  listPages: vi.fn(),
}));

vi.mock('@/services/siteBuilder/siteBuilderService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/siteBuilder/siteBuilderService')>();
  return {
    ...real,
    siteBuilderService: {
      ...real.siteBuilderService,
      listSites: mocks.listSites,
      updateSite: mocks.updateSite,
      createSite: mocks.createSite,
      listPages: mocks.listPages,
    },
  };
});
vi.mock('@/components/pipelines/useLeadDestinationOptions', () => ({
  useLeadDestinationOptions: () => ({ pipelines: null, roletas: null, users: null, labels: null }),
}));
vi.mock('@/contexts/TenantFeaturesContext', () => ({
  useTenantFeatures: () => ({ archivedKeys: [] }),
  useClientToggle: () => false,
}));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
vi.mock('@/services/core/tenant', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/core/tenant')>()),
  getTenantSlug: () => 'imob',
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import SiteBuilder from './SiteBuilder';

const SITE = {
  id: 's1', name: 'Imob', slug: 'imob', active: true, published: true,
  branding: {}, contact: {}, seo: {}, tracking: {},
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
} as unknown as Site;

function abrir(url = '/settings/site-builder') {
  return render(<MemoryRouter initialEntries={[url]}><SiteBuilder /></MemoryRouter>);
}

describe('SiteBuilder (casca do Meu site)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listSites.mockResolvedValue([SITE]);
    mocks.listPages.mockResolvedValue([]);
  });

  it('sem site, abre só a criação, com o botão Criar site e sem a barra de topo', async () => {
    mocks.listSites.mockResolvedValue([]);
    abrir('/settings/site-builder?tela=blog');
    expect(await screen.findByRole('heading', { name: 'Criar o site' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar site' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Menu do Meu site' })).toBeNull();
  });

  it('o endereço antigo ?tab=config cai em Aparência', async () => {
    abrir('/settings/site-builder?tab=config');
    expect(await screen.findByRole('heading', { name: 'Aparência' })).toBeTruthy();
    // A trilha acima do título diz de qual grupo da barra a tela é.
    expect(screen.getByText('Personalizar', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('No ar')).toBeTruthy();
  });

  it('a tela Páginas carrega a própria lista', async () => {
    abrir('/settings/site-builder?tela=paginas');
    expect(await screen.findByRole('heading', { name: 'Páginas' })).toBeTruthy();
    await waitFor(() => expect(mocks.listPages).toHaveBeenCalledWith('s1'));
  });

  it('editar um campo mostra a barra de salvar, e salvar grava', async () => {
    mocks.updateSite.mockResolvedValue({ ...SITE, contact: { phone: '11999990000' } });
    abrir('/settings/site-builder?tela=dados');
    await screen.findByRole('heading', { name: 'Dados de contato' });
    expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('(11) 9999-9999'), { target: { value: '11999990000' } });
    expect(screen.getByRole('region', { name: 'Alterações não salvas' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mocks.updateSite).toHaveBeenCalled());
    expect(mocks.updateSite.mock.calls[0][0]).toBe('s1');
    expect(mocks.updateSite.mock.calls[0][1]).toMatchObject({ contact_phone: '11999990000' });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).toBeNull());
  });
});
