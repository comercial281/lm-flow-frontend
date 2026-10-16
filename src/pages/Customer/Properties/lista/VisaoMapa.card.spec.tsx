import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VisaoMapa from './VisaoMapa';

const mapBounds = vi.hoisted(() => vi.fn());
vi.mock('@/services/properties/propertiesService', async orig => {
  const real = await orig<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, mapBounds } };
});
vi.mock('@/services/core/tenant', async orig => ({ ...(await orig<object>()), getTenantSlug: () => 'barones' }));
// O alfinete de mentira repassa os eventos do Leaflet (mouseover/mouseout/click).
type Eventos = Record<string, (e: unknown) => void>;
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  Marker: ({ title, eventHandlers }: { title: string; eventHandlers: Eventos }) => (
    <div
      data-testid={`pino-${title}`}
      onMouseOver={e => eventHandlers.mouseover({ target: { getElement: () => e.currentTarget } })}
      onMouseOut={() => eventHandlers.mouseout({})}
      onClick={e => eventHandlers.click({ target: { getElement: () => e.currentTarget } })}
    />
  ),
  useMap: () => ({ fitBounds: vi.fn() }),
  useMapEvents: () => null,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const base = { lat: -23.5, lng: -46.6, transaction_type: 'sale', property_type: 'house', display_price: 'R$ 500.000' };
const noSite = { ...base, id: 'p1', title: 'Casa Azul', code: 'CA1', published_on_site: true, cover_photo_url: 'https://cdn.test/capa.jpg' };
const fora = { ...base, id: 'p2', title: 'Casa Verde', code: 'CA2', published_on_site: false };

let abrir: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mapBounds.mockReset().mockResolvedValue([noSite, fora]);
  abrir = vi.spyOn(window, 'open').mockReturnValue(null);
});
afterEach(() => { vi.useRealTimers(); abrir.mockRestore(); });

const mapa = (podeEditar = false) => render(<VisaoMapa kind={'resale' as never} podeEditar={podeEditar} />, { wrapper: MemoryRouter });
// O jsdom não tem PointerEvent: o tipo do ponteiro vai pendurado num MouseEvent.
const ponteiro = (tipo: string, pointerType: string) =>
  fireEvent(screen.getByTestId('mapa'), Object.assign(new MouseEvent(tipo, { bubbles: true }), { pointerType }));
const comMouse = () => ponteiro('pointermove', 'mouse');
const comDedo = () => ponteiro('pointerdown', 'touch');

describe('Mapa · card do imóvel no alfinete', () => {
  it('mouse parado 0,3 s no alfinete abre o card com foto, preço e o destino', async () => {
    mapa();
    const pino = await screen.findByTestId('pino-Casa Azul');
    comMouse();
    fireEvent.mouseOver(pino);
    expect(screen.queryByRole('region', { name: 'Resumo de Casa Azul' })).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(300));
    const card = screen.getByRole('region', { name: 'Resumo de Casa Azul' });
    expect(card).toHaveTextContent('R$ 500.000');
    expect(card.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/capa.jpg');
    expect(screen.getByRole('link', { name: /Ver página no site/ })).toHaveAttribute('href', `${window.location.origin}/imovel/barones/CA1`);
  });

  it('fora do site e sem poder editar: o card avisa e não é link', async () => {
    mapa(false);
    comMouse();
    fireEvent.mouseOver(await screen.findByTestId('pino-Casa Verde'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByRole('region', { name: 'Resumo de Casa Verde' })).toHaveTextContent('Este imóvel não está no site');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('fora do site e pode editar: o card leva ao cadastro', async () => {
    mapa(true);
    comMouse();
    fireEvent.mouseOver(await screen.findByTestId('pino-Casa Verde'));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByRole('link', { name: /Abrir cadastro/ })).toHaveAttribute('href', '/properties/p2/editar');
  });

  it('clique de mouse no alfinete já abre a página do site', async () => {
    mapa();
    comMouse();
    fireEvent.click(await screen.findByTestId('pino-Casa Azul'));
    expect(abrir).toHaveBeenCalledWith(`${window.location.origin}/imovel/barones/CA1`, '_blank', 'noopener');
  });

  it('no dedo: o toque no alfinete mostra o card e não sai da tela', async () => {
    mapa();
    const pino = await screen.findByTestId('pino-Casa Azul');
    comDedo();
    fireEvent.mouseOver(pino);
    fireEvent.click(pino);
    expect(abrir).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Resumo de Casa Azul' })).toBeInTheDocument();
  });

  it('sair do alfinete fecha o card depois da folga', async () => {
    mapa();
    const pino = await screen.findByTestId('pino-Casa Azul');
    comMouse();
    fireEvent.mouseOver(pino);
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.mouseOut(pino);
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.queryByRole('region', { name: 'Resumo de Casa Azul' })).toBeNull();
  });
});
