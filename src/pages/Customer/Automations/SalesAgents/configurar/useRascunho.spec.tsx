import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const update = vi.fn();
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => {
  const real = await orig<typeof import('@/services/salesAgents/salesAgentsService')>();
  return { ...real, salesAgentsService: { ...real.salesAgentsService, update: (...a: unknown[]) => update(...a) } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useRascunho } from './useRascunho';

beforeEach(() => vi.clearAllMocks());

describe('useRascunho', () => {
  it('começa sem pendência; mudar cria o patch só do que é do passo', () => {
    const agente = agenteDeTeste();
    const { result } = renderHook(() => useRascunho(agente, ['greeting', 'transfer_config.mode'], vi.fn()));
    expect(result.current.pendente).toBe(false);
    act(() => result.current.mudar({ greeting: 'Oi!', name: 'Outro nome' }));
    expect(result.current.patch).toEqual({ greeting: 'Oi!' });
    expect(result.current.pendente).toBe(true);
  });

  it('salvar manda só o patch e entrega o agente que voltou', async () => {
    const agente = agenteDeTeste();
    const voltou = agenteDeTeste({ greeting: 'Oi!' });
    update.mockResolvedValue(voltou);
    const aoSalvo = vi.fn();
    const { result } = renderHook(() => useRascunho(agente, ['greeting'], aoSalvo));
    act(() => result.current.mudar({ greeting: 'Oi!' }));
    await act(async () => { await result.current.salvar(); });
    expect(update).toHaveBeenCalledWith('ia-1', { greeting: 'Oi!' });
    expect(aoSalvo).toHaveBeenCalledWith(voltou);
  });

  it('recusa do servidor vira a frase dele', async () => {
    update.mockRejectedValue({ response: { data: { error: { message: 'Este número não tem corretor dono.' } } } });
    // A IA nasce FORA do render: objeto novo a cada render recomeçaria o rascunho sem fim.
    const agente = agenteDeTeste();
    const { result } = renderHook(() => useRascunho(agente, ['greeting'], vi.fn()));
    act(() => result.current.mudar({ greeting: 'Oi!' }));
    await act(async () => { await result.current.salvar(); });
    await waitFor(() => expect(result.current.erro).toBe('Este número não tem corretor dono.'));
  });

  it('descartar volta ao salvo', () => {
    // A IA nasce FORA do render: objeto novo a cada render recomeçaria o rascunho sem fim.
    const agente = agenteDeTeste();
    const { result } = renderHook(() => useRascunho(agente, ['greeting'], vi.fn()));
    act(() => result.current.mudar({ greeting: 'Oi!' }));
    act(() => result.current.descartar());
    expect(result.current.pendente).toBe(false);
  });
});
