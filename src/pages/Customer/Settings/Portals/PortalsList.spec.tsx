import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PortalsList from './PortalsList';
import type { Portal } from '@/services/portals/portalsService';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock('@/services/portals/portalsService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/portals/portalsService');
  return {
    ...actual,
    portalsService: { list: (...a: unknown[]) => mocks.list(...a) },
  };
});

const portal = (over: Partial<Portal>): Portal => ({
  portal_key: 'portal_zap',
  name: 'ZAP Imóveis (Canal Pro)',
  feed_format: 'vrsync',
  capabilities: ['feed', 'webhook_leads', 'highlight'],
  onboarding: [],
  connected: true,
  is_enabled: true,
  integration_id: 'int-1',
  sent_count: 395,
  featured_count: 44,
  last_accessed_at: null,
  active: false,
  feed_url: null,
  lead_webhook_url: null,
  integration_status: 'validated',
  ...over,
});

const montar = () => render(<MemoryRouter><PortalsList /></MemoryRouter>);

const zapComCota = portal({
  active: true,
  last_accessed_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  ad_types: [
    { key: 'standard', label: 'Padrão', feed_value: 'STANDARD', limit: 456, count: 351 },
    { key: 'premium', label: 'Destaque', feed_value: 'PREMIUM', limit: 40, count: 40 },
    { key: 'super_premium', label: 'Super Destaque', feed_value: 'SUPER_PREMIUM', limit: null, count: 0 },
  ],
});

/** Lista de Portais (redesenho de 12/10): conectados em cima, uma situação por portal; o resto pra conectar. */
describe('PortalsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('separa conectados de disponíveis, cada um com uma situação só', async () => {
    mocks.list.mockResolvedValue([
      zapComCota,
      portal({
        portal_key: 'portal_vivareal', name: 'Viva Real (Canal Pro)',
        last_accessed_at: new Date(Date.now() - 13 * 86_400_000).toISOString(),
      }),
      portal({ portal_key: 'portal_olx', name: 'OLX (Canal Pro)' }),
      portal({ portal_key: 'portal_buskaza', name: 'Buskaza', connected: false, integration_id: null, sent_count: 0, integration_status: 'adapted' }),
      portal({ portal_key: 'portal_imovelweb', name: 'Imóvel Web', connected: false, integration_id: null, sent_count: 0 }),
    ]);
    montar();

    const conectados = await screen.findByRole('region', { name: /Conectados/ });
    const zap = within(conectados).getByRole('link', { name: /ZAP Imóveis/ });
    expect(zap).toHaveAttribute('href', '/settings/portals/portal_zap');
    expect(within(zap).getByText('Recebendo')).toBeInTheDocument();
    expect(within(zap).getByText('Leu o feed há 2 h')).toBeInTheDocument();
    expect(within(zap).getByText('395 imóveis')).toBeInTheDocument();
    expect(within(zap).getByText('Destaque no limite')).toBeInTheDocument();

    const vr = within(conectados).getByRole('link', { name: /Viva Real/ });
    expect(within(vr).getByText('Parou de ler')).toBeInTheDocument();
    expect(within(vr).getByText('Última leitura há 13 dias')).toBeInTheDocument();

    const olx = within(conectados).getByRole('link', { name: /OLX/ });
    expect(within(olx).getByText('Esperando 1ª leitura')).toBeInTheDocument();

    const adicionar = screen.getByRole('region', { name: 'Adicionar portal' });
    const buskaza = within(adicionar).getByRole('link', { name: /Buskaza/ });
    expect(within(buskaza).getByText('Formato a confirmar')).toBeInTheDocument();
    expect(within(buskaza).getByText('Conectar')).toBeInTheDocument();
    const iw = within(adicionar).getByRole('link', { name: /Imóvel Web/ });
    expect(within(iw).queryByText('Formato a confirmar')).toBeNull();
  });

  it('não mostra mais os sinais antigos: selo de formato, INATIVO e contadores zerados', async () => {
    mocks.list.mockResolvedValue([
      zapComCota,
      portal({ portal_key: 'portal_homer', name: 'Homer', connected: false, integration_id: null }),
    ]);
    montar();
    await screen.findByRole('region', { name: /Conectados/ });
    expect(screen.queryByText('Formato validado')).toBeNull();
    expect(screen.queryByText('INATIVO')).toBeNull();
    expect(screen.queryByText(/Super Destaque/)).toBeNull();
    expect(screen.queryByText('Não conectado — clique para configurar')).toBeNull();
  });

  it('cliente sem portal conectado vê só "Adicionar portal"', async () => {
    mocks.list.mockResolvedValue([portal({ connected: false, integration_id: null })]);
    montar();
    expect(await screen.findByRole('region', { name: 'Adicionar portal' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Conectados/ })).toBeNull();
  });

  it('servidor antigo (sem ad_types): a linha mostra os imóveis e nenhuma frase de cota', async () => {
    mocks.list.mockResolvedValue([portal({ integration_status: undefined })]);
    montar();
    const zap = await screen.findByRole('link', { name: /ZAP Imóveis/ });
    expect(within(zap).getByText('395 imóveis')).toBeInTheDocument();
    expect(within(zap).queryByText(/limite|cota/)).toBeNull();
  });

  it('erro ao carregar não vira lista vazia: mostra o erro e tenta de novo', async () => {
    mocks.list.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce([zapComCota]);
    montar();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(NO_ACCESS_MESSAGE)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('link', { name: /ZAP Imóveis/ })).toBeInTheDocument();
  });

  it('recusa do servidor mostra o aviso do cargo, sem lista', async () => {
    mocks.list.mockRejectedValue({ response: { status: 403, data: { required_permission: 'portals.read' } } });
    montar();
    expect(await screen.findByText(NO_ACCESS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText('Não deu pra carregar')).toBeNull();
  });
});
