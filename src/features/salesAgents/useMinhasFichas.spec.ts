import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const svc = vi.hoisted(() => ({ minhasFichas: vi.fn() }));
const chaves = vi.hoisted(() => ({ atual: new Set<string>() }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: svc }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => (r: string, a: string) => chaves.atual.has(`${r}.${a}`) }));

import { aplicarMinhaFichaNoMenu, ROTA_MINHA_FICHA, useMinhaFichaNoMenu, useMinhasFichas } from './useMinhasFichas';

const FICHA = {
  id: 'n1', inbox_id: 'i1', phone: null, inbox_name: 'Ana', agent_id: 'a1', agent_name: 'Agente A',
  voice: { kind: 'corretor' as const }, house_voice: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  chaves.atual = new Set();
});

describe('useMinhasFichas', () => {
  it('lê as fichas e diz que tem número', async () => {
    svc.minhasFichas.mockResolvedValue([FICHA]);
    const { result } = renderHook(() => useMinhasFichas(true));
    expect(result.current.estado).toBe('carregando');
    await waitFor(() => expect(result.current.estado).toBe('ok'));
    expect(result.current.fichas).toEqual([FICHA]);
    expect(result.current.temNumero).toBe(true);
  });

  it('lista vazia = sem número', async () => {
    svc.minhasFichas.mockResolvedValue([]);
    const { result } = renderHook(() => useMinhasFichas(true));
    await waitFor(() => expect(result.current.estado).toBe('ok'));
    expect(result.current.temNumero).toBe(false);
  });

  it('inativo não pergunta nada', () => {
    const { result } = renderHook(() => useMinhasFichas(false));
    expect(svc.minhasFichas).not.toHaveBeenCalled();
    expect(result.current.temNumero).toBe(false);
  });

  it('erro ao ler vira estado erro, sem número', async () => {
    svc.minhasFichas.mockRejectedValue(new Error('rede'));
    const { result } = renderHook(() => useMinhasFichas(true));
    await waitFor(() => expect(result.current.estado).toBe('erro'));
    expect(result.current.temNumero).toBe(false);
  });

  it('trocar uma ficha salva troca só ela', async () => {
    svc.minhasFichas.mockResolvedValue([FICHA, { ...FICHA, id: 'n2' }]);
    const { result } = renderHook(() => useMinhasFichas(true));
    await waitFor(() => expect(result.current.estado).toBe('ok'));
    act(() => result.current.trocar({ ...FICHA, voice: { kind: 'corretor', name: 'Bia' } }));
    expect(result.current.fichas[0].voice?.name).toBe('Bia');
    expect(result.current.fichas[1].voice?.name).toBeUndefined();
  });
});

describe('useMinhaFichaNoMenu', () => {
  it('com own_ficha, sem sales_agents.read e com número: visível', async () => {
    chaves.atual = new Set(['sales_agent_numbers.own_ficha']);
    svc.minhasFichas.mockResolvedValue([FICHA]);
    const { result } = renderHook(() => useMinhaFichaNoMenu());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('sem número: some', async () => {
    chaves.atual = new Set(['sales_agent_numbers.own_ficha']);
    svc.minhasFichas.mockResolvedValue([]);
    const { result } = renderHook(() => useMinhaFichaNoMenu());
    await waitFor(() => expect(svc.minhasFichas).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('quem lê a IA (gestor) já tem a tela completa: não pergunta e não mostra', () => {
    chaves.atual = new Set(['sales_agent_numbers.own_ficha', 'sales_agents.read']);
    const { result } = renderHook(() => useMinhaFichaNoMenu());
    expect(result.current).toBe(false);
    expect(svc.minhasFichas).not.toHaveBeenCalled();
  });

  it('sem a chave own_ficha: não pergunta', () => {
    const { result } = renderHook(() => useMinhaFichaNoMenu());
    expect(result.current).toBe(false);
    expect(svc.minhasFichas).not.toHaveBeenCalled();
  });
});

describe('aplicarMinhaFichaNoMenu', () => {
  const item = { name: 'Minha ficha da IA', href: ROTA_MINHA_FICHA } as never;
  const outro = { name: 'Disparos', href: '/disparos' } as never;
  const secoes = [{ id: 'vendas', itens: [outro, item] }] as never[];

  it('invisível tira o item e deixa o resto', () => {
    const r = aplicarMinhaFichaNoMenu(secoes, false) as { itens: { href: string }[] }[];
    expect(r[0].itens.map((i) => i.href)).toEqual(['/disparos']);
  });
  it('visível passa intacto', () => {
    expect(aplicarMinhaFichaNoMenu(secoes, true)).toBe(secoes);
  });
});
