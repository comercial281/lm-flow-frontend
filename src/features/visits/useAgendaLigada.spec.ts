import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const getSettings = vi.fn();
vi.mock('@/services/visits/agendaService', () => ({
  agendaService: { getSettings: (...a: unknown[]) => getSettings(...a) },
}));

// A imobiliária vem do subdomínio; aqui, trocada por teste.
let slug: string | null = 'imob-teste';
vi.mock('@/services/core/tenant', () => ({ getTenantSlug: () => slug }));

import { esquecerAgendaLigada, useAgendaLigada } from './useAgendaLigada';

const LIGADA = { enabled: true, days: [1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00', closed_dates: ['2026-12-25'], seeded_from: { agent_name: 'IA Teste' } };

beforeEach(() => {
  vi.clearAllMocks();
  getSettings.mockReset();
  esquecerAgendaLigada();
  slug = 'imob-teste';
});

describe('useAgendaLigada', () => {
  it('null enquanto o servidor não responde; true com o horário quando `enabled: true`', async () => {
    let responder: (v: unknown) => void = () => {};
    getSettings.mockReturnValue(new Promise(r => { responder = r; }));
    const { result } = renderHook(() => useAgendaLigada());

    expect(result.current).toEqual({ ligada: null, ajustes: null });
    responder(LIGADA);

    await waitFor(() => expect(result.current.ligada).toBe(true));
    expect(result.current.ajustes).toEqual({
      days: [1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00', closed_dates: ['2026-12-25'], seeded_from: { agent_name: 'IA Teste' },
    });
  });

  it('false com `enabled: false` (o servidor de hoje)', async () => {
    getSettings.mockResolvedValue({ enabled: false });
    const { result } = renderHook(() => useAgendaLigada());
    await waitFor(() => expect(result.current.ligada).toBe(false));
    expect(result.current.ajustes).toBeNull();
  });

  it('false com 403 ou erro, e o erro não fica guardado', async () => {
    getSettings.mockRejectedValueOnce(Object.assign(new Error('403'), { response: { status: 403 } }));
    const primeira = renderHook(() => useAgendaLigada());
    await waitFor(() => expect(primeira.result.current.ligada).toBe(false));

    getSettings.mockResolvedValue(LIGADA);
    const segunda = renderHook(() => useAgendaLigada());
    await waitFor(() => expect(segunda.result.current.ligada).toBe(true));
    expect(getSettings).toHaveBeenCalledTimes(2);
  });

  it('um pedido só para várias telas; a segunda já nasce com a resposta', async () => {
    getSettings.mockResolvedValue(LIGADA);
    const a = renderHook(() => useAgendaLigada());
    const b = renderHook(() => useAgendaLigada());
    await waitFor(() => expect(a.result.current.ligada).toBe(true));
    await waitFor(() => expect(b.result.current.ligada).toBe(true));

    const c = renderHook(() => useAgendaLigada());
    expect(c.result.current.ligada).toBe(true);
    expect(getSettings).toHaveBeenCalledTimes(1);
  });

  it('inativo não pergunta; ao ativar, pergunta', async () => {
    getSettings.mockResolvedValue(LIGADA);
    const { result, rerender } = renderHook(({ ativo }) => useAgendaLigada(ativo), { initialProps: { ativo: false } });
    expect(getSettings).not.toHaveBeenCalled();
    expect(result.current.ligada).toBeNull();

    rerender({ ativo: true });
    await waitFor(() => expect(result.current.ligada).toBe(true));
    expect(getSettings).toHaveBeenCalledTimes(1);
  });

  it('esquecerAgendaLigada: o próximo pergunta de novo', async () => {
    getSettings.mockResolvedValue({ enabled: false });
    const a = renderHook(() => useAgendaLigada());
    await waitFor(() => expect(a.result.current.ligada).toBe(false));

    esquecerAgendaLigada();
    getSettings.mockResolvedValue(LIGADA);
    const b = renderHook(() => useAgendaLigada());
    await waitFor(() => expect(b.result.current.ligada).toBe(true));
    expect(getSettings).toHaveBeenCalledTimes(2);
  });

  it('getSettings estourando na hora (síncrono): false, sem erro solto', async () => {
    getSettings.mockImplementation(() => { throw new Error('sem servidor'); });
    const { result } = renderHook(() => useAgendaLigada());
    await waitFor(() => expect(result.current.ligada).toBe(false));
    expect(result.current.ajustes).toBeNull();
  });

  it('getSettings devolvendo undefined: false', async () => {
    getSettings.mockReturnValue(undefined);
    const { result } = renderHook(() => useAgendaLigada());
    await waitFor(() => expect(result.current.ligada).toBe(false));
  });

  it('trocou de imobiliária: a resposta guardada não vale, pergunta de novo', async () => {
    getSettings.mockResolvedValue(LIGADA);
    const a = renderHook(() => useAgendaLigada());
    await waitFor(() => expect(a.result.current.ligada).toBe(true));

    slug = 'outra-imob';
    getSettings.mockResolvedValue({ enabled: false });
    const b = renderHook(() => useAgendaLigada());
    expect(b.result.current.ligada).toBeNull();
    await waitFor(() => expect(b.result.current.ligada).toBe(false));
    expect(getSettings).toHaveBeenCalledTimes(2);
  });
});
