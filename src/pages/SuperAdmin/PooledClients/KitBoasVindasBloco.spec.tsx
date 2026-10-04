import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const kit = vi.hoisted(() => ({ tenantState: vi.fn(), preview: vi.fn(), deliver: vi.fn() }));
vi.mock('@/services/superAdmin/welcomeKitService', () => ({ welcomeKitService: kit }));

import KitBoasVindasBloco from './KitBoasVindasBloco';
import type { KitDelivery } from '@/services/superAdmin/welcomeKitService';

const grupo = { jid: '1@g.us', name: 'APTO x Leal Mídia', source: 'nome' as const, found: true };
const andamento = (state: 'running' | 'done', status: 'queued' | 'sent' = 'queued'): KitDelivery => ({
  state, started_at: '2026-10-04T17:32:00Z', finished_at: state === 'done' ? '2026-10-04T17:33:00Z' : null,
  by: 'Tony', group: grupo,
  items: [
    { kind: 'text', label: 'Mensagem', status: 'sent' },
    { kind: 'video', label: 'Vídeo', status },
  ],
  sent: status === 'sent' ? 2 : 1, total: 2,
});
const previa = {
  configured: true, target: grupo, reason: null, last: null,
  pieces: [
    { kind: 'text' as const, label: 'Mensagem', text: 'Oi APTO: https://apto.lmflow.com.br' },
    { kind: 'video' as const, label: 'Vídeo', url: 'https://x/rails/active_storage/v.mp4', name: 'app.mp4' },
  ],
};

const abrir = () => render(<MemoryRouter><KitBoasVindasBloco tenantId="t-1" /></MemoryRouter>);

describe('Funções → Kit de boas-vindas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    kit.tenantState.mockResolvedValue({ configured: true, last: null, progress: null });
    kit.preview.mockResolvedValue(previa);
  });
  afterEach(() => vi.useRealTimers());

  it('ao abrir mostra o último envio e não busca o grupo', async () => {
    abrir();
    expect(await screen.findByText('Ainda não enviado.')).toBeInTheDocument();
    expect(kit.preview).not.toHaveBeenCalled();
  });

  it('kit nunca montado: manda para a Plataforma e não deixa preparar', async () => {
    kit.tenantState.mockResolvedValue({ configured: false, last: null, progress: null });
    abrir();
    expect(await screen.findByText(/O kit ainda não foi montado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparar envio' })).toBeDisabled();
  });

  it('envio em andamento ao abrir: acompanha até terminar, sem enviar de novo', async () => {
    kit.tenantState
      .mockResolvedValueOnce({ configured: true, last: null, progress: andamento('running') })
      .mockResolvedValue({ configured: true, last: andamento('done', 'sent'), progress: andamento('done', 'sent') });
    abrir();
    expect(await screen.findByText('Enviando 2 de 2…')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(3100); });
    expect(await screen.findByText(/2 de 2 peças/)).toBeInTheDocument();
    expect(kit.deliver).not.toHaveBeenCalled();
  });

  it('envio interrompido: mostra o registro e deixa preparar de novo', async () => {
    const parado = { ...andamento('done', 'queued'), state: 'interrupted' as const };
    kit.tenantState.mockResolvedValue({ configured: true, last: parado, progress: parado });
    abrir();
    expect(await screen.findByText(/^Envio interrompido em/)).toBeInTheDocument();
    expect(screen.queryByText(/Enviando/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparar envio' })).toBeEnabled();
  });

  it('grupo mudou desde a prévia: mostra o motivo e pede para preparar de novo', async () => {
    kit.deliver.mockRejectedValue({
      response: { status: 422, data: { error: 'O grupo do cliente mudou desde a prévia. Prepare o envio de novo.' } },
    });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Preparar envio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar no grupo (2 peças)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(/O grupo do cliente mudou/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar no grupo/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparar envio' })).toBeInTheDocument();
  });

  it('sem destino: mostra o motivo e não deixa enviar', async () => {
    kit.preview.mockResolvedValue({ ...previa, target: null, reason: 'Esta imobiliária tem 2 grupos.' });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Preparar envio' }));
    expect(await screen.findByText('Esta imobiliária tem 2 grupos.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar no grupo/ })).not.toBeInTheDocument();
  });

  it('com destino: mostra para onde vai e só envia depois da confirmação', async () => {
    kit.deliver.mockResolvedValue(andamento('running'));
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Preparar envio' }));
    expect(await screen.findByText('APTO x Leal Mídia')).toBeInTheDocument();
    expect(screen.getByText('Oi APTO: https://apto.lmflow.com.br')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar no grupo (2 peças)' }));
    expect(kit.deliver).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(kit.deliver).toHaveBeenCalledWith('t-1', '1@g.us'));
    expect(await screen.findByText('Enviando 2 de 2…')).toBeInTheDocument();
  });

  it('409 (já tem envio rodando): acompanha o que está rodando, sem segundo envio', async () => {
    kit.deliver.mockRejectedValue({
      response: { status: 409, data: { error: 'Já tem um envio em andamento para este cliente.', progress: andamento('running') } },
    });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Preparar envio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar no grupo (2 peças)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Enviando 2 de 2…')).toBeInTheDocument();
    expect(kit.deliver).toHaveBeenCalledTimes(1);
  });
});
