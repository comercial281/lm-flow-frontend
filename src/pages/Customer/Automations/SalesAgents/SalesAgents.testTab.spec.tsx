import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Fix round 1, item 1 (30/09/26): o painel Testar mandava SEMPRE o código do
// CAMPO na hora do clique em "Mandar pra mim" — não o código do imóvel que
// gerou aquela bolha. Como o token das FOTOS só faz sentido dentro do imóvel
// que o gerou, uma bolha antiga (imóvel A) clicada depois de trocar o campo
// pro imóvel B mandava o token de A junto do property_code de B: o servidor
// resolveria as fotos de OUTRO imóvel (ou "material não disponível").
const testRun = vi.hoisted(() => vi.fn());
const testSend = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({
  salesAgentsService: { testRun, testSend },
}));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

import { TestTab } from './telas/TelaTestar';
import type { SalesAgent, SalesAgentTestResult } from '@/services/salesAgents/salesAgentsService';

const agent = { id: 'agent-1' } as unknown as SalesAgent;

function baseResult(overrides: Partial<SalesAgentTestResult>): SalesAgentTestResult {
  return {
    reply: 'oi',
    temperature: 'warm',
    should_transfer: false,
    transfer_reason: null,
    collected: {},
    lead_summary: '',
    ...overrides,
  };
}

beforeEach(() => {
  testRun.mockReset();
  testSend.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  localStorage.clear();
});

describe('TestTab — "Mandar pra mim" usa o imóvel do TURNO, não o do campo', () => {
  it('bolha antiga manda o property_code de quando foi gerada, mesmo com o campo já noutro imóvel', async () => {
    const user = userEvent.setup();
    testRun
      .mockResolvedValueOnce(baseResult({
        reply_parts: ['Segue as fotos do AP1'],
        media: [{ type: 'photos', token: 'tok-ap1', urls: ['https://cdn/ap1-1.jpg'] }],
      }))
      .mockResolvedValueOnce(baseResult({
        reply_parts: ['Segue as fotos do AP2'],
        media: [{ type: 'photos', token: 'tok-ap2', urls: ['https://cdn/ap2-1.jpg'] }],
      }));
    testSend.mockResolvedValue({ message: 'Mandado!' });

    render(<TestTab agent={agent} />);

    const messageInput = screen.getByPlaceholderText('Mensagem do lead...');
    const propertyInput = screen.getByPlaceholderText('Código do imóvel (ex: AP123)') as HTMLInputElement;

    // Turno 1: imóvel AP1.
    await user.type(propertyInput, 'AP1');
    await user.type(messageInput, 'me manda as fotos{Enter}');
    await waitFor(() => expect(testRun).toHaveBeenCalledTimes(1));
    await screen.findByText('Segue as fotos do AP1');

    // Troca o campo pro imóvel AP2 e manda outro turno — SEM apagar a bolha
    // do AP1, que continua na tela com a mídia dela.
    await user.clear(propertyInput);
    await user.type(propertyInput, 'AP2');
    await user.type(messageInput, 'e as do AP2?{Enter}');
    await waitFor(() => expect(testRun).toHaveBeenCalledTimes(2));
    await screen.findByText('Segue as fotos do AP2');

    // Campo agora mostra AP2. Clica em "Mandar pra mim" na bolha MAIS ANTIGA
    // (a do AP1) — tem que mandar o property_code AP1, não o AP2 do campo.
    expect(propertyInput.value).toBe('AP2');
    const sendButtons = screen.getAllByRole('button', { name: /mandar pra mim/i });
    expect(sendButtons).toHaveLength(2);
    await user.click(sendButtons[0]);

    await user.type(screen.getByPlaceholderText('Seu WhatsApp (com DDD)'), '11999998888{Enter}');

    await waitFor(() => expect(testSend).toHaveBeenCalledWith('agent-1', {
      phone: '11999998888',
      token: 'tok-ap1',
      property_code: 'AP1',
    }));
  });
});
