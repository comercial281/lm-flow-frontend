import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VisaoMapa from './VisaoMapa';

const mapBounds = vi.hoisted(() => vi.fn());
vi.mock('@/services/properties/propertiesService', async orig => {
  const real = await orig<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, mapBounds } };
});
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="pino">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ fitBounds: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const pino = { id: 'p1', title: 'Casa Azul', code: 'CA1', lat: -23.5, lng: -46.6, transaction_type: 'sale', property_type: 'house' };

beforeEach(() => mapBounds.mockReset());

describe('VisaoMapa · erro de carga', () => {
  it('carga que falha mostra o erro com Tentar de novo, não o vazio', async () => {
    mapBounds.mockRejectedValueOnce(new Error('rede'));
    render(<VisaoMapa kind={'venda' as never} />);
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum imóvel desta aba/)).toBeNull();
    mapBounds.mockResolvedValueOnce([pino]);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findAllByTestId('pino')).toHaveLength(1);
    expect(screen.queryByText('Não deu pra carregar')).toBeNull();
  });

  it('Tentar de novo duas vezes seguidas não duplica os pinos', async () => {
    mapBounds.mockRejectedValueOnce(new Error('rede'));
    render(<VisaoMapa kind={'venda' as never} />);
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    mapBounds.mockResolvedValue([pino]);
    await userEvent.dblClick(botao);
    expect(await screen.findAllByTestId('pino')).toHaveLength(1);
  });
});
