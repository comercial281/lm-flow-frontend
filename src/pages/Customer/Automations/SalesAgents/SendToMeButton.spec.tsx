import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// "Mandar pra mim": manda a mídia pro WhatsApp do próprio dono, pela mesma rota
// do lead real (30/09/26). Primeiro clique sem número salvo pede o número;
// com número salvo, manda direto. O número fica no localStorage do navegador.
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

import SendToMeButton from './SendToMeButton';

const STORAGE_KEY = 'lmflow.salesAgents.testPhone';

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  localStorage.clear();
});

describe('SendToMeButton', () => {
  it('sem número salvo: pede o número e manda os dígitos digitados', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue('Mandado!');

    render(<SendToMeButton onSend={onSend} />);

    await user.click(screen.getByRole('button', { name: /mandar pra mim/i }));
    expect(onSend).not.toHaveBeenCalled();

    const input = screen.getByPlaceholderText('Seu WhatsApp (com DDD)');
    await user.type(input, '(11) 91234-5678');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('11912345678'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Mandado!'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('11912345678');
  });

  it('sem número salvo: Enter no campo também envia', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue('Mandado!');

    render(<SendToMeButton onSend={onSend} />);
    await user.click(screen.getByRole('button', { name: /mandar pra mim/i }));
    await user.type(screen.getByPlaceholderText('Seu WhatsApp (com DDD)'), '11999998888{Enter}');

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('11999998888'));
  });

  it('com número salvo: clicar manda direto, sem pedir de novo', async () => {
    localStorage.setItem(STORAGE_KEY, '11988887777');
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue('Mandado!');

    render(<SendToMeButton onSend={onSend} />);
    expect(screen.getByText(/para 11988887777/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /mandar pra mim/i }));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('11988887777'));
    expect(screen.queryByPlaceholderText('Seu WhatsApp (com DDD)')).toBeNull();
  });

  it('"trocar" reabre o campo mesmo com número salvo', async () => {
    localStorage.setItem(STORAGE_KEY, '11988887777');
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue('Mandado!');

    render(<SendToMeButton onSend={onSend} />);
    await user.click(screen.getByText('trocar'));

    expect(screen.getByPlaceholderText('Seu WhatsApp (com DDD)')).toBeInTheDocument();
  });

  it('falha: mostra o erro no toast', async () => {
    localStorage.setItem(STORAGE_KEY, '11988887777');
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValue(new Error('Limite de 10 testes por hora atingido'));

    render(<SendToMeButton onSend={onSend} />);
    await user.click(screen.getByRole('button', { name: /mandar pra mim/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Limite de 10 testes por hora atingido'));
  });

  it('sem storage disponível: não quebra', async () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('storage bloqueado'); },
    });

    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue('Mandado!');

    expect(() => render(<SendToMeButton onSend={onSend} />)).not.toThrow();
    await user.click(screen.getByRole('button', { name: /mandar pra mim/i }));
    await user.type(screen.getByPlaceholderText('Seu WhatsApp (com DDD)'), '11977776666');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('11977776666'));

    Object.defineProperty(window, 'localStorage', { configurable: true, value: original });
  });

  it('respeita o label customizado', () => {
    render(<SendToMeButton onSend={vi.fn()} label="Ver como chega" />);
    expect(screen.getByRole('button', { name: 'Ver como chega' })).toBeInTheDocument();
  });

  it('mostra o aviso de não responder, citando a resposta automática do WhatsApp Business', () => {
    render(<SendToMeButton onSend={vi.fn()} />);
    expect(screen.getByText(/não responda essa mensagem pelo seu whatsapp/i)).toBeInTheDocument();
    expect(screen.getByText(/inclusive a automática do whatsapp business/i)).toBeInTheDocument();
  });

  // Fix round 1, item 3: Enter segurado (ou repetido antes do 1º envio
  // terminar) não pode disparar onSend duas vezes — sem a trava, um teste em
  // dobro também dobra o consumo do limite de 10/hora por agente.
  it('Enter em sequência durante o envio não dispara onSend duas vezes', async () => {
    const user = userEvent.setup();
    let resolveSend: (message: string) => void = () => {};
    const onSend = vi.fn(() => new Promise<string>((resolve) => { resolveSend = resolve; }));

    render(<SendToMeButton onSend={onSend} />);
    await user.click(screen.getByRole('button', { name: /mandar pra mim/i }));

    const input = screen.getByPlaceholderText('Seu WhatsApp (com DDD)');
    await user.type(input, '11999998888');
    // Dois Enter em sequência, antes de o primeiro envio terminar.
    await user.type(input, '{Enter}{Enter}');

    expect(onSend).toHaveBeenCalledTimes(1);

    resolveSend('Mandado!');
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Mandado!'));
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
