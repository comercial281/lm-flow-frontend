import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PortalDetailPage from './PortalDetailPage';
import type { PortalDetail } from '@/services/portals/portalsService';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/portals/portalsService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/portals/portalsService');
  return {
    ...actual,
    portalsService: { get: (...a: unknown[]) => mocks.get(...a) },
  };
});

// Os três cards têm spec próprio; aqui a pergunta é só o que a PÁGINA monta.
vi.mock('./PortalPropertiesSelector', () => ({ default: () => <div data-testid="seletor" /> }));
vi.mock('./PortalAdPlanCard', () => ({ default: () => <div data-testid="plano" /> }));
vi.mock('./PortalSettingsCard', () => ({
  default: ({ onSaved }: { onSaved?: () => void }) => (
    <div data-testid="configurar"><button type="button" onClick={onSaved}>salvou</button></div>
  ),
}));

vi.mock('sonner', () => ({
  toast: { error: (...a: unknown[]) => mocks.toastError(...a), success: vi.fn(), warning: vi.fn() },
}));

const detalhe = (over: Partial<PortalDetail>): PortalDetail => ({
  portal_key: 'portal_zap',
  name: 'ZAP Imóveis (Canal Pro)',
  feed_format: 'vrsync',
  capabilities: ['feed', 'webhook_leads', 'highlight'],
  onboarding: ['Cadastre a URL do feed no Canal Pro'],
  connected: true,
  is_enabled: true,
  integration_id: 'int-1',
  sent_count: 3,
  featured_count: 1,
  last_accessed_at: null,
  active: false,
  feed_url: 'https://api.lmflow.com.br/feeds/vrsync/abc123.xml',
  lead_webhook_url: 'https://api.lmflow.com.br/webhooks/portal_leads/abc',
  property_ids: [],
  featured_property_ids: [],
  ...over,
});

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/settings/portals/portal_zap']}>
      <Routes>
        <Route path="/settings/portals/:portalKey" element={<PortalDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('PortalDetailPage — histórico de cargas e Abrir feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista as leituras do portal, da mais recente para a mais antiga', async () => {
    const usuario = userEvent.setup();
    mocks.get.mockResolvedValue(detalhe({
      feed_access_log: [
        { at: '2026-09-13T12:00:00Z', listings: 1 },
        { at: '2026-09-14T19:00:00Z', listings: 394 },
      ],
    }));
    montar();

    const cabecalho = await screen.findByRole('button', { name: /Histórico de cargas/ });
    expect(cabecalho).toHaveAttribute('aria-expanded', 'false');
    expect(cabecalho).toHaveTextContent('2 leituras');
    expect(screen.queryByText('394 imóveis')).toBeNull();

    await usuario.click(cabecalho);

    expect(cabecalho).toHaveAttribute('aria-expanded', 'true');
    const lista = screen.getByRole('list', { name: 'Leituras do feed' });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('394 imóveis');
    expect(itens[1]).toHaveTextContent('1 imóvel');
    // Data em pt-BR (dia/mês/ano), sem o formato cru do servidor.
    expect(itens[0]).toHaveTextContent(/\d{2}\/\d{2}\/2026/);
    expect(itens[0]).not.toHaveTextContent('2026-09-14T');
  });

  it('sem leitura nenhuma diz que o portal ainda não baixou o feed', async () => {
    const usuario = userEvent.setup();
    mocks.get.mockResolvedValue(detalhe({ feed_access_log: [] }));
    montar();

    const cabecalho = await screen.findByRole('button', { name: /Histórico de cargas/ });
    expect(cabecalho).toHaveTextContent('O portal ainda não baixou o feed.');
    await usuario.click(cabecalho);
    expect(screen.getAllByText('O portal ainda não baixou o feed.')).toHaveLength(2);
    expect(screen.queryByRole('list', { name: 'Leituras do feed' })).toBeNull();
  });

  it('o botão Abrir feed abre a URL do feed em outra aba', async () => {
    mocks.get.mockResolvedValue(detalhe({}));
    montar();

    const link = await screen.findByRole('link', { name: 'Abrir feed' });
    expect(link).toHaveAttribute('href', 'https://api.lmflow.com.br/feeds/vrsync/abc123.xml');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    // O webhook só copia — não é endereço para abrir no navegador.
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Copiar' })).toHaveLength(2);
  });

  it('recarregar depois de salvar mantém os cards no lugar, sem voltar ao "Carregando..."', async () => {
    mocks.get.mockResolvedValue(detalhe({
      ad_types: [{ key: 'standard', label: 'Padrão', feed_value: 'STANDARD', limit: null, count: 3 }],
    }));
    montar();
    const configurar = await screen.findByTestId('configurar');
    expect(mocks.get).toHaveBeenCalledTimes(1);

    // O card *Configurar* chama `onSaved` (= recarregar o portal): o mesmo nó
    // continua montado — desmontar aqui voltaria a rolagem ao topo e refaria a
    // busca dos imóveis do seletor a cada salvar.
    await userEvent.setup().click(within(configurar).getByRole('button', { name: 'salvou' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Carregando...')).toBeNull();
    expect(screen.getByTestId('configurar')).toBe(configurar);
  });

  it('com o portal conectado monta Configurar, plano e seletor; desconectado, só o Como ativar', async () => {
    mocks.get.mockResolvedValueOnce(detalhe({
      ad_types: [{ key: 'standard', label: 'Padrão', feed_value: 'STANDARD', limit: null, count: 3 }],
    }));
    const { unmount } = montar();
    await screen.findByTestId('configurar');
    expect(screen.getByTestId('plano')).toBeInTheDocument();
    expect(screen.getByTestId('seletor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Histórico de cargas/ })).toBeInTheDocument();
    unmount();

    mocks.get.mockResolvedValueOnce(detalhe({ connected: false, integration_id: null, feed_url: null, lead_webhook_url: null }));
    montar();
    await screen.findByRole('button', { name: 'Conectar portal' });
    expect(screen.queryByTestId('configurar')).toBeNull();
    expect(screen.queryByTestId('plano')).toBeNull();
    expect(screen.queryByTestId('seletor')).toBeNull();
    expect(screen.queryByRole('button', { name: /Histórico de cargas/ })).toBeNull();
    const comoAtivar = screen.getByText('Como ativar').parentElement as HTMLElement;
    expect(within(comoAtivar).getByText('Cadastre a URL do feed no Canal Pro')).toBeInTheDocument();
  });
});
