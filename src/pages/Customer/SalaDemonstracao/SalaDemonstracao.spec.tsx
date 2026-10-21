import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SalaDemonstracao from './SalaDemonstracao';

const s = vi.hoisted(() => ({
  get: vi.fn(), start: vi.fn(), followupNow: vi.fn(), reset: vi.fn(), admin: { value: true },
}));
vi.mock('@/services/demoRoom/demoRoomService', () => ({
  demoRoomService: { get: s.get, start: s.start, followupNow: s.followupNow, reset: s.reset },
}));
vi.mock('./useEhAdmin', () => ({ useEhAdmin: () => s.admin.value }));

const config = { agent_id: 'a1', agent_name: 'Ana', followup_flow_id: 'f1', property_code: 'AP1', wa_number: '5511900000000' };
const sessao = (status: 'waiting' | 'live') => ({
  id: 's1', code: 'ABC', lead_name: 'Maria', status, conversation_id: status === 'live' ? 'c1' : null,
  contact_id: null, started_at: '2026-10-21T12:00:00Z', wa_link: 'https://wa.me/x',
});
const estado = (session: unknown) => ({ config, session, behind: null, followup: [] });

const tela = () => render(<MemoryRouter><SalaDemonstracao /></MemoryRouter>);

beforeEach(() => {
  for (const f of [s.get, s.start, s.followupNow, s.reset]) f.mockReset();
  s.admin.value = true;
});
afterEach(() => { vi.useRealTimers(); });

describe('SalaDemonstracao', () => {
  it('sem sessão mostra o bloco Preparar', async () => {
    s.get.mockResolvedValue(estado(null));
    tela();
    expect(await screen.findByTestId('preparar')).toBeInTheDocument();
    expect(screen.queryByTestId('qr-da-sala')).toBeNull();
  });

  it('com sessão waiting mostra o QR', async () => {
    s.get.mockResolvedValue(estado(sessao('waiting')));
    tela();
    expect(await screen.findByTestId('qr-da-sala')).toBeInTheDocument();
    expect(screen.queryByTestId('preparar')).toBeNull();
  });

  it('com sessão live mostra conversa, bastidores e follow-up', async () => {
    s.get.mockResolvedValue(estado(sessao('live')));
    tela();
    expect(await screen.findByTestId('conversa-ao-vivo')).toBeInTheDocument();
    expect(screen.getByTestId('bastidores')).toBeInTheDocument();
    expect(screen.getByTestId('followup-da-sala')).toBeInTheDocument();
  });

  it('404 mostra o aviso de espaço de demonstração', async () => {
    s.get.mockRejectedValue({ response: { status: 404 } });
    tela();
    expect(await screen.findByText('A Sala de demonstração só existe no espaço de demonstração')).toBeInTheDocument();
  });

  it('quem não é administrador recebe o aviso do cargo e nada é consultado', async () => {
    s.admin.value = false;
    tela();
    expect(await screen.findByText(/Seu cargo não tem acesso/)).toBeInTheDocument();
    expect(s.get).not.toHaveBeenCalled();
  });

  it('com sessão consulta a cada 3 s, no evento realtime com 500 ms de espera, e para ao sair', async () => {
    vi.useFakeTimers();
    s.get.mockResolvedValue(estado(sessao('live')));
    const { unmount } = tela();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(s.get).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(s.get).toHaveBeenCalledTimes(2);

    // rajada de eventos vira uma consulta só
    await act(async () => {
      window.dispatchEvent(new Event('lmflow:realtime'));
      window.dispatchEvent(new Event('lmflow:realtime'));
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(s.get).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(s.get).toHaveBeenCalledTimes(3);

    unmount();
    await act(async () => {
      window.dispatchEvent(new Event('lmflow:realtime'));
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(s.get).toHaveBeenCalledTimes(3);
  });

  it('sem sessão não fica consultando', async () => {
    vi.useFakeTimers();
    s.get.mockResolvedValue(estado(null));
    tela();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(s.get).toHaveBeenCalledTimes(1);
  });
});
