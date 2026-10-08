import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
const toastInfo = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: { info: (...a: unknown[]) => toastInfo(...a), success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() },
}));
import CapiConversionPanel from './CapiConversionPanel';

// Conversão Meta: o completo é o do card do lead; o compacto (Proposta B, 02/10)
// é a linha logo abaixo dos selos no painel do lead em Conversas.

const status = vi.fn();
const send = vi.fn();
vi.mock('@/services/capi/capiEventsService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/capi/capiEventsService')>();
  return { ...real, capiEventsService: { status: (...a: unknown[]) => status(...a), send: (...a: unknown[]) => send(...a) } };
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
  beforeEach(() => {
    status.mockReset();
    send.mockReset();
    toastInfo.mockReset();
    toastSuccess.mockReset();
  });

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
  // Trocar de conversa (revisão de 02/10): o painel do lead não remonta a Meta.
  const adiada = () => {
    let resolver: (v: unknown) => void = () => {};
    const promessa = new Promise(r => { resolver = r; });
    return { promessa, resolver };
  };

  it('compacto: trocando de lead, a linha guarda o lugar enquanto carrega (nada pula)', async () => {
    status.mockResolvedValueOnce(pronto);
    const { rerender } = render(<CapiConversionPanel contactId="c1" variante="compacto" className="linha-meta" />);
    expect(await screen.findByText('Meta')).toBeTruthy();

    const c2 = adiada();
    status.mockReturnValueOnce(c2.promessa);
    rerender(<CapiConversionPanel contactId="c2" variante="compacto" className="linha-meta" />);

    // Carregando o c2: a linha ocupa o mesmo lugar, sem os botões do lead anterior.
    const reserva = screen.getByTestId('conversao-meta-carregando');
    expect(reserva.className).toContain('linha-meta');
    expect(screen.queryByRole('button', { name: 'Qualificado' })).toBeNull();

    await act(async () => { c2.resolver(pronto); });
    expect(await screen.findByRole('button', { name: 'Qualificado' })).toBeTruthy();
    expect(screen.queryByTestId('conversao-meta-carregando')).toBeNull();
  });

  it('resposta atrasada do lead anterior não cai no lead novo', async () => {
    const c1 = adiada();
    status.mockReturnValueOnce(c1.promessa);
    const { rerender } = render(<CapiConversionPanel contactId="c1" variante="compacto" />);

    const sentNoC2 = {
      ...pronto,
      events: pronto.events.map(e => (e.event_name === 'Qualificado' ? { ...e, sent_at: '2026-10-02T12:00:00Z' } : e)),
    };
    status.mockResolvedValueOnce(sentNoC2);
    rerender(<CapiConversionPanel contactId="c2" variante="compacto" />);
    expect(await screen.findByRole('button', { name: 'Qualificado' })).toBeTruthy();

    // A resposta do c1 chega depois: "não pode enviar". Não vale mais.
    await act(async () => { c1.resolver({ ...pronto, can_send: false }); });
    expect(screen.getByRole('button', { name: 'Qualificado' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Qualificado' }).getAttribute('title')).toMatch(/enviado em/);
  });

  // Ajuste de 08/10: Compra e Desqualificado vão uma vez só por lead (botão ou
  // situação do card). Já foi: o botão trava e diz "enviado". Qualificado não.
  const jaEnviados = {
    ...pronto,
    events: [
      { event_name: 'Qualificado', intent: null, once: false, sent_at: '2026-10-08T12:00:00Z', sent_by: 'Ana' },
      { event_name: 'Desqualificado', intent: null, once: true, sent_at: null, sent_by: null },
      { event_name: 'Purchase', intent: null, once: true, sent_at: '2026-10-08T12:00:00Z', sent_by: null },
    ],
  };

  it('compacto: Venda já enviada trava com "enviado"; Desqualificado e Qualificado seguem clicáveis', async () => {
    status.mockResolvedValue(jaEnviados);
    render(<CapiConversionPanel contactId="c1" variante="compacto" />);

    expect(await screen.findByRole('button', { name: 'Venda · enviado' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Desqualificado' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Qualificado' })).toBeEnabled();
  });

  it('completo (card do lead): "Venda realizada · enviado" travado', async () => {
    status.mockResolvedValue(jaEnviados);
    render(<CapiConversionPanel contactId="c1" />);

    expect(await screen.findByRole('button', { name: 'Venda realizada · enviado' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Qualificado' })).toBeEnabled();
  });

  // D-4: estado velho na tela; o servidor responde 200 "já enviado" sem enviar.
  it('POST de evento já enviado: mostra a mensagem do servidor, não "enviado ao Meta", e atualiza o botão', async () => {
    status.mockResolvedValue(pronto);
    send.mockResolvedValue({ ...jaEnviados, message: 'Este evento já foi enviado para este lead.' });
    render(<CapiConversionPanel contactId="c1" variante="compacto" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Venda' }));

    await vi.waitFor(() => expect(toastInfo).toHaveBeenCalledWith('Este evento já foi enviado para este lead.'));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Venda · enviado' })).toBeDisabled();
  });
});
