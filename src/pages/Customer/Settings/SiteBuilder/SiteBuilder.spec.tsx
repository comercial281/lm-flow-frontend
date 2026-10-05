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
  previewLink: vi.fn(),
  getBookFlow: vi.fn(),
  putBookFlow: vi.fn(),
}));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ default: { list: () => Promise.resolve([]) } }));
vi.mock('@/components/numbers/SendFromField', () => ({ default: () => null }));

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
      previewLink: mocks.previewLink,
      getBookFlow: mocks.getBookFlow,
      putBookFlow: mocks.putBookFlow,
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

  describe('Página do imóvel e Lista de imóveis', () => {
    // A barra abre a lista suspensa no ponteiro (Radix): userEvent, como no MeuSiteBarra.spec.
    const navegar = async (grupo: RegExp, item: RegExp) => {
      await userEvent.click(screen.getByRole('button', { name: grupo }));
      await userEvent.click(await screen.findByRole('menuitem', { name: item }));
    };
    const salvar = async (vez = 1) => {
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(mocks.updateSite).toHaveBeenCalledTimes(vez));
      return mocks.updateSite.mock.calls[vez - 1][1];
    };
    const barra = () => screen.queryByRole('region', { name: 'Alterações não salvas' });

    const FLUXO = { ligado: true, fluxo_id: 'f1', personalizado: false, fluxo_ligado: true, send_from: 'owner', send_from_inbox_id: null, mensagem: 'Oi', ia_assume: true, existe: true };

    it('liga o book e edita o e-mail: o Salvar leva book_button:true e os e-mails, e o PUT do book não vai junto', async () => {
      mocks.listSites.mockResolvedValue([{ ...SITE, property_page: { email_copy: ['dono@imob.com'] } }]);
      mocks.updateSite.mockResolvedValue(SITE);
      mocks.getBookFlow.mockResolvedValue({ ...FLUXO, ligado: false, existe: false });
      mocks.putBookFlow.mockResolvedValue(FLUXO);
      abrir('/settings/site-builder?tela=ficha');
      await screen.findByRole('heading', { name: 'Página do imóvel' });
      await userEvent.click(screen.getByRole('tab', { name: 'Empreendimentos' }));
      await userEvent.click(await screen.findByRole('switch', { name: 'Receber o book no WhatsApp' }));
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Receber o book no WhatsApp' })).toHaveAttribute('aria-checked', 'true'));
      expect(barra()).toBeNull(); // a chave sozinha não suja a ficha

      await userEvent.type(screen.getByLabelText('E-mail 1'), '.br');
      const payload = await salvar();

      expect(payload.property_page.development.book_button).toBe(true);
      expect(payload.property_page.email_copy).toEqual(['dono@imob.com.br']);
    });

    it('edição feita enquanto o PUT do book está pendente sobrevive à resposta e vai no Salvar', async () => {
      mocks.listSites.mockResolvedValue([{ ...SITE, property_page: { email_copy: ['dono@imob.com'] } }]);
      mocks.updateSite.mockResolvedValue(SITE);
      mocks.getBookFlow.mockResolvedValue({ ...FLUXO, ligado: false, existe: false });
      let resolver!: (v: unknown) => void;
      mocks.putBookFlow.mockReturnValue(new Promise(r => { resolver = r; }));
      abrir('/settings/site-builder?tela=ficha');
      await screen.findByRole('heading', { name: 'Página do imóvel' });
      await userEvent.click(screen.getByRole('tab', { name: 'Empreendimentos' }));
      await userEvent.click(await screen.findByRole('switch', { name: 'Receber o book no WhatsApp' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'Mapa' })); // edição durante o PUT
      await userEvent.type(screen.getByLabelText('E-mail 1'), '.br');

      resolver(FLUXO);
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Receber o book no WhatsApp' })).toHaveAttribute('aria-checked', 'true'));
      const payload = await salvar();

      expect(payload.property_page.development).toMatchObject({ book_button: true, map: false });
      expect(payload.property_page.email_copy).toEqual(['dono@imob.com.br']);
    });

    it('abrir as duas telas sem mexer não mostra o Salvar, e salvar outra coisa não leva os blocos', async () => {
      mocks.updateSite.mockResolvedValue(SITE);
      abrir('/settings/site-builder?tela=ficha');
      await screen.findByRole('heading', { name: 'Página do imóvel' });
      expect(barra()).toBeNull();

      await navegar(/Personalizar/, /Lista de imóveis/);
      await screen.findByRole('heading', { name: 'Lista de imóveis' });
      expect(barra()).toBeNull();

      await navegar(/Configurações/, /Dados de contato/);
      await userEvent.type(await screen.findByLabelText('Telefone'), '11999990000');
      const payload = await salvar();
      expect(payload).not.toHaveProperty('property_page');
      expect(payload).not.toHaveProperty('listing');
    });

    it('carrega os e-mails da cópia; mexer numa caixinha leva o property_page inteiro, com os e-mails em lista', async () => {
      mocks.listSites.mockResolvedValue([{ ...SITE, property_page: { resale: { map: false }, email_copy: ['dono@imob.com'] } }]);
      mocks.updateSite.mockResolvedValue(SITE);
      abrir('/settings/site-builder?tela=ficha');
      await screen.findByRole('heading', { name: 'Página do imóvel' });
      expect((screen.getByLabelText('E-mail 1') as HTMLInputElement).value).toBe('dono@imob.com');
      expect(screen.getByRole('checkbox', { name: 'Mapa' })).toHaveAttribute('aria-checked', 'false');

      await userEvent.click(screen.getByRole('checkbox', { name: 'Você também pode gostar' }));
      expect(barra()).toBeTruthy();
      const payload = await salvar();

      expect(payload.property_page).toEqual({
        resale: { map: false, popular_badge: true, values: true, similar: false },
        development: { map: true, popular_badge: true, stage_and_forecast: true, typologies: true, builder: true, similar: true, book_button: false },
        financing_badges: true,
        email_copy: ['dono@imob.com'],
      });
      expect(payload).not.toHaveProperty('listing');
      expect(payload).not.toHaveProperty('home');
    });

    it('e-mail com espaço nas pontas sai aparado e campo em branco não viaja', async () => {
      mocks.updateSite.mockResolvedValue(SITE);
      abrir('/settings/site-builder?tela=ficha');
      await screen.findByRole('heading', { name: 'Página do imóvel' });
      await userEvent.click(screen.getByRole('button', { name: /Adicionar e-mail/ }));
      await userEvent.type(screen.getByLabelText('E-mail 1'), ' novo@imob.com ');
      await userEvent.click(screen.getByRole('button', { name: /Adicionar e-mail/ }));

      const payload = await salvar();
      expect(payload.property_page.email_copy).toEqual(['novo@imob.com']);
    });

    it('depois de salvar, a tela mostra o que o servidor gravou e a flag zera', async () => {
      mocks.updateSite.mockResolvedValue({ ...SITE, property_page: { email_copy: ['ok@imob.com'] } });
      abrir('/settings/site-builder?tela=ficha');
      await screen.findByRole('heading', { name: 'Página do imóvel' });
      await userEvent.click(screen.getByRole('button', { name: /Adicionar e-mail/ }));
      await userEvent.type(screen.getByLabelText('E-mail 1'), 'ok@imob.com');
      await userEvent.click(screen.getByRole('button', { name: /Adicionar e-mail/ }));
      await userEvent.type(screen.getByLabelText('E-mail 2'), 'errado@');
      expect((await salvar()).property_page.email_copy).toEqual(['ok@imob.com', 'errado@']);

      // O servidor descartou o inválido: a tela relê o gravado.
      await waitFor(() => expect(screen.queryByLabelText('E-mail 2')).toBeNull());
      expect((screen.getByLabelText('E-mail 1') as HTMLInputElement).value).toBe('ok@imob.com');

      await navegar(/Configurações/, /Dados de contato/);
      await userEvent.type(await screen.findByLabelText('Telefone'), '11999990000');
      expect(await salvar(2)).not.toHaveProperty('property_page');
    });

    it('Descartar zera a alteração da Página do imóvel', async () => {
      mocks.updateSite.mockResolvedValue(SITE);
      abrir('/settings/site-builder?tela=ficha');
      await screen.findByRole('heading', { name: 'Página do imóvel' });
      await userEvent.click(screen.getByRole('checkbox', { name: 'Mapa' }));
      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
      await waitFor(() => expect(mocks.listSites).toHaveBeenCalledTimes(2));
      expect(await screen.findByRole('checkbox', { name: 'Mapa' })).toHaveAttribute('aria-checked', 'true');

      await navegar(/Configurações/, /Dados de contato/);
      await userEvent.type(await screen.findByLabelText('Telefone'), '11999990000');
      expect(await salvar()).not.toHaveProperty('property_page');
    });

    it('Lista de imóveis: a miniatura leva o listing inteiro, sem o property_page', async () => {
      mocks.listSites.mockResolvedValue([{ ...SITE, listing: { default_sort: 'price_asc', card_layout: 'grid' } }]);
      mocks.updateSite.mockResolvedValue({ ...SITE, listing: { default_sort: 'price_asc', card_layout: 'rows' } });
      abrir('/settings/site-builder?tela=lista');
      await screen.findByRole('heading', { name: 'Lista de imóveis' });
      expect((screen.getByLabelText('Ordem padrão') as HTMLSelectElement).value).toBe('price_asc');

      await userEvent.click(screen.getByRole('button', { name: 'Linhas largas' }));
      const payload = await salvar();
      expect(payload.listing).toEqual({ default_sort: 'price_asc', card_layout: 'rows' });
      expect(payload).not.toHaveProperty('property_page');

      await waitFor(() => expect(barra()).toBeNull());
      expect(screen.getByRole('button', { name: 'Linhas largas' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Ver site, Ver prévia e Aparecer no Google', () => {
    const barra = () => screen.queryByRole('region', { name: 'Alterações não salvas' });

    it('sem domínio, "Ver site" abre o endereço lmflow (/portal/<cliente>)', async () => {
      abrir();
      const link = await screen.findByRole('link', { name: /Ver site/ });
      expect(link.getAttribute('href')).toBe(`${window.location.origin}/portal/imob`);
    });

    it('com domínio ativo, "Ver site" abre o domínio e a barra mostra o domínio', async () => {
      mocks.listSites.mockResolvedValue([{ ...SITE, domain: 'imobteste.com.br', primary_domain: 'imobteste.com.br' }]);
      abrir();
      const link = await screen.findByRole('link', { name: /Ver site/ });
      expect(link.getAttribute('href')).toBe('https://imobteste.com.br');
      expect(screen.getByText('imobteste.com.br')).toBeTruthy();
    });

    it('domínio configurado mas ainda pendente (domain null) não é aberto', async () => {
      mocks.listSites.mockResolvedValue([{ ...SITE, domain: null, primary_domain: 'imobteste.com.br' }]);
      abrir();
      const link = await screen.findByRole('link', { name: /Ver site/ });
      expect(link.getAttribute('href')).toBe(`${window.location.origin}/portal/imob`);
    });

    it('em manutenção, "Ver prévia" pede o link e abre a URL com ?previa=, com o aviso de 24 horas', async () => {
      mocks.listSites.mockResolvedValue([{ ...SITE, published: false, domain: 'imobteste.com.br' }]);
      mocks.previewLink.mockResolvedValue({ token: 'tok+a/b==--9f', expires_at: '2026-10-05T12:00:00Z' });
      const aba = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
      const abrirJanela = vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);
      abrir();
      expect(screen.queryByRole('link', { name: /Ver site/ })).toBeNull();
      await userEvent.click(await screen.findByRole('button', { name: /Ver prévia/ }));

      await waitFor(() => expect(aba.location.href).not.toBe(''));
      expect(mocks.previewLink).toHaveBeenCalledWith('s1');
      expect(abrirJanela).toHaveBeenCalledTimes(1);
      const url = new URL(aba.location.href);
      expect(url.origin).toBe('https://imobteste.com.br');
      expect(url.searchParams.get('previa')).toBe('tok+a/b==--9f');
      expect(aba.opener).toBeNull();
      // Só a frase é anunciada (role status), não o campo e os botões junto.
      expect(screen.getByRole('status')).toHaveTextContent(/^Esse link vale 24 horas\. Pode mandar pro dono aprovar\.$/);
      expect((screen.getByLabelText('Link da prévia') as HTMLInputElement).value).toBe(aba.location.href);
      abrirJanela.mockRestore();
    });

    it('a prévia sem domínio abre o endereço lmflow com ?previa=', async () => {
      mocks.listSites.mockResolvedValue([{ ...SITE, active: false }]);
      mocks.previewLink.mockResolvedValue({ token: 'tok-1', expires_at: '2026-10-05T12:00:00Z' });
      const aba = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
      const abrirJanela = vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);
      abrir();
      await userEvent.click(await screen.findByRole('button', { name: /Ver prévia/ }));
      await waitFor(() => expect(aba.location.href).toBe(`${window.location.origin}/portal/imob?previa=tok-1`));
      abrirJanela.mockRestore();
    });

    it('falha ao pedir o link fecha a aba e não mostra o aviso', async () => {
      mocks.listSites.mockResolvedValue([{ ...SITE, published: false }]);
      mocks.previewLink.mockRejectedValue(new Error('500'));
      const aba = { opener: {} as unknown, location: { href: '' }, close: vi.fn() };
      const abrirJanela = vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);
      abrir();
      await userEvent.click(await screen.findByRole('button', { name: /Ver prévia/ }));
      await waitFor(() => expect(aba.close).toHaveBeenCalled());
      expect(screen.queryByText(/vale 24 horas/)).toBeNull();
      abrirJanela.mockRestore();
    });

    it('abrir Aparecer no Google sem mexer não mostra o Salvar, e salvar outra coisa não leva google', async () => {
      mocks.listSites.mockResolvedValue([{ ...SITE, google: { indexable: true } }]);
      mocks.updateSite.mockResolvedValue(SITE);
      abrir('/settings/site-builder?tela=google');
      await screen.findByRole('heading', { name: 'Aparecer no Google' });
      expect(screen.getByRole('checkbox', { name: 'Aparecer no Google' })).toHaveAttribute('aria-checked', 'true');
      expect(barra()).toBeNull();

      await userEvent.type(screen.getByLabelText('Título'), 'X');
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(mocks.updateSite).toHaveBeenCalled());
      expect(mocks.updateSite.mock.calls[0][1]).not.toHaveProperty('google');
    });

    it('a caixinha vem desligada de fábrica; ligar marca alterado e o Salvar leva google inteiro', async () => {
      mocks.updateSite.mockResolvedValue({ ...SITE, google: { indexable: true } });
      abrir('/settings/site-builder?tela=google');
      await screen.findByRole('heading', { name: 'Aparecer no Google' });
      const caixa = screen.getByRole('checkbox', { name: 'Aparecer no Google' });
      expect(caixa).toHaveAttribute('aria-checked', 'false');
      // O leitor de tela lê as duas frases junto com a caixinha.
      expect(caixa).toHaveAccessibleDescription(/Liga quando o site estiver pronto\..*O Google lê o site pelo endereço imob\.lmflow\.com\.br/);

      await userEvent.click(caixa);
      expect(barra()).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(mocks.updateSite).toHaveBeenCalled());
      expect(mocks.updateSite.mock.calls[0][1].google).toEqual({ indexable: true });
      await waitFor(() => expect(barra()).toBeNull());
      expect(screen.getByRole('checkbox', { name: 'Aparecer no Google' })).toHaveAttribute('aria-checked', 'true');
    });

    it('a frase diz onde o Google lê o site: subdomínio do cliente sem domínio, o domínio com ele', async () => {
      const { unmount } = abrir('/settings/site-builder?tela=google');
      expect(await screen.findByText('imob.lmflow.com.br')).toBeTruthy();
      expect(screen.queryByText(/app\.lmflow/)).toBeNull();
      unmount();

      mocks.listSites.mockResolvedValue([{ ...SITE, domain: 'imobteste.com.br' }]);
      abrir('/settings/site-builder?tela=google');
      await screen.findByRole('heading', { name: 'Aparecer no Google' });
      expect(screen.getAllByText('imobteste.com.br').length).toBeGreaterThan(0);
      expect(screen.getByText(/pelo seu domínio/)).toBeTruthy();
    });
  });
});
