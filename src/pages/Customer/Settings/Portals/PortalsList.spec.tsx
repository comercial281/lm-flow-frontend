import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PortalsList from './PortalsList';
import type { Portal } from '@/services/portals/portalsService';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/portals/portalsService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/portals/portalsService');
  return {
    ...actual,
    portalsService: { list: (...a: unknown[]) => mocks.list(...a) },
  };
});

vi.mock('sonner', () => ({
  toast: { error: (...a: unknown[]) => mocks.toastError(...a), success: vi.fn(), warning: vi.fn() },
}));

const portal = (over: Partial<Portal>): Portal => ({
  portal_key: 'portal_zap',
  name: 'ZAP Imóveis (Canal Pro)',
  feed_format: 'vrsync',
  capabilities: ['feed', 'webhook_leads', 'highlight'],
  onboarding: [],
  connected: true,
  is_enabled: true,
  integration_id: 'int-1',
  sent_count: 396,
  featured_count: 41,
  last_accessed_at: null,
  active: false,
  feed_url: null,
  lead_webhook_url: null,
  ...over,
});

const montar = () => render(<MemoryRouter><PortalsList /></MemoryRouter>);

/** A lista de portais: selo de formato e contadores por tipo, com o estourado em vermelho. */
describe('PortalsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra o selo de formato validado/adaptado e os contadores por tipo', async () => {
    mocks.list.mockResolvedValue([
      portal({
        integration_status: 'validated',
        ad_types: [
          { key: 'standard', label: 'Padrão', feed_value: 'STANDARD', limit: 456, count: 350 },
          { key: 'premium', label: 'Destaque', feed_value: 'PREMIUM', limit: 40, count: 41 },
        ],
      }),
      portal({
        portal_key: 'portal_buskaza',
        name: 'Buskaza',
        integration_status: 'adapted',
        status_note: 'Formato adaptado — confirme com o portal antes do primeiro envio',
        connected: false,
        ad_types: [{ key: 'standard', label: 'Padrão', feed_value: 'STANDARD', limit: null, count: 0 }],
      }),
    ]);
    montar();

    const zap = await screen.findByRole('button', { name: /ZAP Imóveis/ });
    expect(within(zap).getByText('Formato validado')).toBeInTheDocument();
    expect(within(zap).getByText('Padrão 350/456')).toBeInTheDocument();
    const destaque = within(zap).getByText('Destaque 41/40');
    expect(destaque.className).toContain('text-destructive');
    expect(within(zap).getByText('por tipo de anúncio')).toBeInTheDocument();
    expect(within(zap).queryByText('em destaque')).toBeNull();

    const buskaza = screen.getByRole('button', { name: /Buskaza/ });
    expect(within(buskaza).getByText('Formato adaptado')).toBeInTheDocument();
    expect(within(buskaza).getByText('Não conectado — clique para configurar')).toBeInTheDocument();
    // Sem cota, o contador mostra só a contagem.
    expect(within(buskaza).getByText('Padrão 0')).toBeInTheDocument();
  });

  it('portal com seis tipos: o nome continua no DOM e os seis rótulos aparecem', async () => {
    // Era o caso da tela em produção: com seis contadores numa linha só, o
    // bloco do nome ficava sem largura. Hoje os contadores moram na segunda linha.
    mocks.list.mockResolvedValue([
      portal({
        integration_status: 'validated',
        ad_types: [
          { key: 'standard', label: 'Padrão', feed_value: 'STANDARD', limit: 456, count: 350 },
          { key: 'premium', label: 'Destaque', feed_value: 'PREMIUM', limit: 40, count: 12 },
          { key: 'super_premium', label: 'Super Destaque', feed_value: 'SUPER_PREMIUM', limit: 10, count: 3 },
          { key: 'premiere_1', label: 'Destaque Exclusivo', feed_value: 'PREMIERE_1', limit: null, count: 0 },
          { key: 'premiere_2', label: 'Destaque Superior', feed_value: 'PREMIERE_2', limit: null, count: 0 },
          { key: 'triple', label: 'Destaque Triplo', feed_value: 'TRIPLE', limit: null, count: 0 },
        ],
      }),
    ]);
    montar();

    const zap = await screen.findByRole('button', { name: /ZAP Imóveis/ });
    expect(within(zap).getByText('ZAP Imóveis (Canal Pro)')).toBeInTheDocument();
    expect(within(zap).getByText('Formato validado')).toBeInTheDocument();
    for (const rotulo of ['Padrão 350/456', 'Destaque 12/40', 'Super Destaque 3/10',
      'Destaque Exclusivo 0', 'Destaque Superior 0', 'Destaque Triplo 0']) {
      expect(within(zap).getByText(rotulo)).toBeInTheDocument();
    }
    expect(within(zap).getByText('imóveis enviados')).toBeInTheDocument();
  });

  it('servidor antigo (sem ad_types): os dois contadores de sempre e nenhum selo', async () => {
    mocks.list.mockResolvedValue([portal({})]);
    montar();

    const zap = await screen.findByRole('button', { name: /ZAP Imóveis/ });
    expect(within(zap).getByText('396')).toBeInTheDocument();
    expect(within(zap).getByText('imóveis enviados')).toBeInTheDocument();
    expect(within(zap).getByText('41')).toBeInTheDocument();
    expect(within(zap).getByText('em destaque')).toBeInTheDocument();
    expect(within(zap).queryByText('por tipo de anúncio')).toBeNull();
    expect(within(zap).queryByText(/Formato/)).toBeNull();
  });

  it('erro ao carregar a lista avisa — é a tela inteira que não abre', async () => {
    mocks.list.mockRejectedValue(new Error('boom'));
    montar();
    await screen.findByText('Portais imobiliários');
    await vi.waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Erro ao carregar portais'));
  });
});
