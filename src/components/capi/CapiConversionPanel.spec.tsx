import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import CapiConversionPanel from './CapiConversionPanel';

// Conversão Meta: o completo é o do card do lead; o compacto (Proposta B, 02/10)
// é a linha logo abaixo dos selos no painel do lead em Conversas.

const status = vi.fn();
vi.mock('@/services/capi/capiEventsService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/capi/capiEventsService')>();
  return { ...real, capiEventsService: { status: (...a: unknown[]) => status(...a), send: vi.fn() } };
});

const pronto = {
  can_send: true,
  is_enabled: true,
  client_ready: true,
  events: [
    { event_name: 'Qualificado', intent: null, sent_at: null, sent_by: null },
    { event_name: 'Desqualificado', intent: null, sent_at: null, sent_by: null },
    { event_name: 'Purchase', intent: null, sent_at: null, sent_by: null },
  ],
};
const EXPLICACAO = /Isso alimenta os anúncios, não substitui o CRM/;

describe('CapiConversionPanel', () => {
  beforeEach(() => status.mockReset());

  it('compacto: "Meta" e os 3 botões numa linha; a explicação vai pro ⓘ', async () => {
    status.mockResolvedValue(pronto);
    render(<CapiConversionPanel contactId="c1" variante="compacto" />);

    expect(await screen.findByText('Meta')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Qualificado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Desqualificado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Venda' })).toBeTruthy();
    // O texto longo não aparece solto: é o nome do ⓘ (balão).
    expect(screen.queryByText(EXPLICACAO)).toBeNull();
    expect(screen.getByRole('button', { name: EXPLICACAO })).toBeTruthy();
  });

  it('completo (card do lead) continua igual: título, explicação à vista e "Venda realizada"', async () => {
    status.mockResolvedValue(pronto);
    render(<CapiConversionPanel contactId="c1" />);

    expect(await screen.findByText('Conversão Meta')).toBeTruthy();
    expect(screen.getByText(EXPLICACAO)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Venda realizada' })).toBeTruthy();
  });

  it('cliente sem Pixel/CAPI: o compacto some', async () => {
    status.mockResolvedValue({ ...pronto, can_send: false });
    const { container } = render(<CapiConversionPanel contactId="c1" variante="compacto" />);
    await vi.waitFor(() => expect(status).toHaveBeenCalled());
    // Deixa a resposta do status chegar (o carregando também não desenha nada).
    await act(() => new Promise(r => setTimeout(r, 0)));
    expect(container.innerHTML).toBe('');
  });
});
