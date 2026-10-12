import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const svc = vi.hoisted(() => ({ meus: vi.fn(), vistos: vi.fn(), clicou: vi.fn() }));
vi.mock('@/services/dashboard/bannersService', () => ({ bannersService: svc }));
const navegar = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navegar }));

import BannerDaDashboard, { TROCA_MS } from './BannerDaDashboard';

const detalhes = {
  id: 'b1', desktop_url: 'https://x/d1.png', mobile_url: 'https://x/m1.png', click_action: 'details' as const,
  details: { title: 'Mensagens prontas', body: 'Agora na lateral.\nNo celular, como antes.', image_url: null, button_path: '/conversations' },
  link_url: null, clicked: false,
};
const link = { ...detalhes, id: 'b2', click_action: 'link' as const, details: null, link_url: 'https://lealmidia.com.br' };

const abrir = () => render(<MemoryRouter><BannerDaDashboard /></MemoryRouter>);

describe('Banner da Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.vistos.mockResolvedValue(undefined);
    svc.clicou.mockResolvedValue(undefined);
    Element.prototype.scrollTo = vi.fn();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('sem banner (ou com falha) não desenha nada', async () => {
    svc.meus.mockRejectedValue(new Error('x'));
    const { container } = abrir();
    await waitFor(() => expect(svc.meus).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra a arte certa pra cada tela e registra que apareceu', async () => {
    svc.meus.mockResolvedValue([detalhes]);
    abrir();
    const img = await screen.findByRole('img', { name: 'Mensagens prontas' });
    expect(img).toHaveAttribute('src', 'https://x/d1.png');
    expect(img.parentElement?.querySelector('source')).toHaveAttribute('srcset', 'https://x/m1.png');
    await waitFor(() => expect(svc.vistos).toHaveBeenCalledWith(['b1']));
    // Um banner só: sem bolinhas.
    expect(screen.queryByRole('button', { name: /Mostrar o banner/ })).not.toBeInTheDocument();
  });

  it('clicar abre os detalhes; Ver agora leva à tela da novidade', async () => {
    svc.meus.mockResolvedValue([detalhes]);
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Mensagens prontas: ver detalhes' }));
    expect(svc.clicou).toHaveBeenCalledWith('b1');
    expect(await screen.findByRole('dialog')).toHaveTextContent('No celular, como antes.');
    await userEvent.click(screen.getByRole('button', { name: 'Ver agora' }));
    expect(navegar).toHaveBeenCalledWith('/conversations');
  });

  it('link de fora abre em aba nova', async () => {
    const abrirJanela = vi.spyOn(window, 'open').mockReturnValue(null);
    svc.meus.mockResolvedValue([link]);
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: /abrir/ }));
    expect(abrirJanela).toHaveBeenCalledWith('https://lealmidia.com.br', '_blank', 'noopener,noreferrer');
  });

  it('com dois, passa sozinho e as bolinhas trocam', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    svc.meus.mockResolvedValue([detalhes, link]);
    abrir();
    const primeira = await screen.findByRole('button', { name: 'Mostrar o banner 1 de 2' });
    expect(primeira).toHaveAttribute('aria-current', 'true');
    await act(async () => { vi.advanceTimersByTime(TROCA_MS + 10); });
    expect(screen.getByRole('button', { name: 'Mostrar o banner 2 de 2' })).toHaveAttribute('aria-current', 'true');
    await waitFor(() => expect(svc.vistos).toHaveBeenCalledWith(['b2']));
  });
});
