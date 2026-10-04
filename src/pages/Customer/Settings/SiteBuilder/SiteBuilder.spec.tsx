import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Site } from '@/services/siteBuilder/siteBuilderService';

// A casca do Meu site: qual tela abre pelo endereço, o caminho de criar o site
// e a BarraSalvar única. As telas em si são o JSX que já existia, só movido.

const mocks = vi.hoisted(() => ({
  listSites: vi.fn(),
  updateSite: vi.fn(),
  createSite: vi.fn(),
  listPages: vi.fn(),
  getDashboard: vi.fn(),
  listLeads: vi.fn(),
  uploadAsset: vi.fn(),
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
      getDashboard: mocks.getDashboard,
      listLeads: mocks.listLeads,
      uploadAsset: mocks.uploadAsset,
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
vi.mock('@/features/siteBuilder/HeroImagePicker', () => ({ default: () => null }));

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
    mocks.getDashboard.mockRejectedValue(new Error('sem painel nos testes da casca'));
    mocks.listLeads.mockResolvedValue({ data: [], meta: { total: 0 } });
  });

  it('?tela=anuncios sem a função liberada cai no Painel', async () => {
    abrir('/settings/site-builder?tela=anuncios');
    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Páginas de anúncio' })).toBeNull();
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
    mocks.updateSite.mockResolvedValue({ ...SITE, contact: { phone: '(11) 99999-0000' } });
    abrir('/settings/site-builder?tela=dados');
    await screen.findByRole('heading', { name: 'Dados de contato' });
    expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).toBeNull();

    await userEvent.type(screen.getByLabelText('Telefone'), '11999990000');
    expect(screen.getByRole('region', { name: 'Alterações não salvas' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mocks.updateSite).toHaveBeenCalled());
    expect(mocks.updateSite.mock.calls[0][0]).toBe('s1');
    expect(mocks.updateSite.mock.calls[0][1]).toMatchObject({ contact_phone: '(11) 99999-0000' });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).toBeNull());
  });

  it('salvar sem mexer na página inicial não manda home', async () => {
    mocks.updateSite.mockResolvedValue(SITE);
    abrir('/settings/site-builder?tela=dados');
    await screen.findByRole('heading', { name: 'Dados de contato' });
    await userEvent.type(screen.getByLabelText('Telefone'), '11999990000');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mocks.updateSite).toHaveBeenCalled());
    expect(mocks.updateSite.mock.calls[0][1]).not.toHaveProperty('home');
  });

  it('depois de mexer na Busca rápida o home inteiro viaja', async () => {
    mocks.updateSite.mockResolvedValue(SITE);
    abrir('/settings/site-builder?tela=busca');
    await screen.findByRole('heading', { name: 'Busca rápida' });
    fireEvent.click(screen.getByLabelText('Alugar'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mocks.updateSite).toHaveBeenCalled());
    const home = mocks.updateSite.mock.calls[0][1].home;
    expect(home.search.tabs).toEqual({ sale: true, rent: false, launch: true });
    expect(home.showcases).toHaveLength(2);
    expect(home.most_searched.mode).toBe('auto');
  });

  it('atalho sem rótulo some da tela depois de salvar (servidor devolve sem ele)', async () => {
    mocks.listSites.mockResolvedValue([{ ...SITE, home: { most_searched: { enabled: true, mode: 'manual', items: [] } } }]);
    mocks.updateSite.mockResolvedValue({ ...SITE, home: { most_searched: { enabled: true, mode: 'manual', items: [] } } });
    abrir('/settings/site-builder?tela=buscados');
    await screen.findByRole('heading', { name: 'Mais buscados' });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar atalho/ }));
    expect(screen.getAllByRole('button', { name: /Remover/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mocks.updateSite).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /Remover/ })).toHaveLength(0));
  });

  it('Aparência mostra o ícone da aba que veio do servidor', async () => {
    mocks.listSites.mockResolvedValue([{ ...SITE, branding: { favicon_url: 'https://cdn/icone.png' } }]);
    abrir('/settings/site-builder?tela=aparencia');
    const img = await screen.findByRole('img', { name: 'Ícone da aba' }) as HTMLImageElement;
    expect(img.src).toBe('https://cdn/icone.png');
  });

  it('enviar o ícone e salvar leva o favicon_url', async () => {
    mocks.uploadAsset.mockResolvedValue({ url: 'https://cdn/novo.png' });
    mocks.updateSite.mockResolvedValue({ ...SITE, branding: { favicon_url: 'https://cdn/novo.png' } });
    abrir('/settings/site-builder?tela=aparencia');
    await screen.findByRole('heading', { name: 'Aparência' });
    await userEvent.upload(screen.getByLabelText('Escolher arquivo: ícone da aba'), new File(['x'], 'i.png', { type: 'image/png' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mocks.updateSite).toHaveBeenCalled());
    expect(mocks.updateSite.mock.calls[0][1]).toMatchObject({ favicon_url: 'https://cdn/novo.png' });
  });

  it('remover o logo e salvar grava null', async () => {
    mocks.listSites.mockResolvedValue([{ ...SITE, branding: { logo_url: 'https://cdn/logo.png' } }]);
    mocks.updateSite.mockResolvedValue(SITE);
    abrir('/settings/site-builder?tela=aparencia');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover logo do site' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mocks.updateSite).toHaveBeenCalled());
    expect(mocks.updateSite.mock.calls[0][1].logo_url).toBeNull();
  });

  it('remover o ícone da aba e salvar grava null', async () => {
    mocks.listSites.mockResolvedValue([{ ...SITE, branding: { favicon_url: 'https://cdn/icone.png' } }]);
    mocks.updateSite.mockResolvedValue(SITE);
    abrir('/settings/site-builder?tela=aparencia');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover ícone da aba' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mocks.updateSite).toHaveBeenCalled());
    expect(mocks.updateSite.mock.calls[0][1].favicon_url).toBeNull();
  });

  it('abrir Dados com telefone de ramal não mostra a barra de salvar', async () => {
    mocks.listSites.mockResolvedValue([{ ...SITE, contact: { phone: '(11) 3333-4444 ramal 21', whatsapp: '11987654321' } }]);
    abrir('/settings/site-builder?tela=dados');
    await screen.findByRole('heading', { name: 'Dados de contato' });
    expect((screen.getByLabelText('Telefone') as HTMLInputElement).value).toBe('(11) 3333-4444 ramal 21');
    expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).toBeNull();
  });
});

