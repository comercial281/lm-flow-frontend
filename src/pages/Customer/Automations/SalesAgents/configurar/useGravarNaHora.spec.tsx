import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const update = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { update } }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import {
  TOAST_SALVO, camposDaMudanca, esquecerSalvos, registrarSalvo, ultimoSalvoDa, useGravarNaHora,
} from './useGravarNaHora';

// Uma promessa que o teste resolve quando quiser (pra provar a ordem da fila).
function adiada<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((r, j) => { resolver = r; rejeitar = j; });
  return { promessa, resolver, rejeitar };
}

const salvo = (a: SalesAgent, extra: Partial<SalesAgent>, quando: string) => ({ ...a, ...extra, updated_at: quando });

beforeEach(() => {
  update.mockReset();
  toast.mockReset();
  toast.error.mockReset();
  esquecerSalvos();
});

function montar(agent = agenteDeTeste()) {
  const aoSalvo = vi.fn();
  const r = renderHook(({ a }) => useGravarNaHora(a, aoSalvo), { initialProps: { a: agent } });
  return { ...r, aoSalvo, agent };
}

describe('camposDaMudanca', () => {
  it('campo solto vai pelo nome; jsonb dividido só com subchave', () => {
    expect(camposDaMudanca({ greeting: 'Oi' })).toEqual(['greeting']);
    expect(camposDaMudanca({ transfer_config: { mode: 'checklist' } }, ['transfer_config.mode'])).toEqual(['transfer_config.mode']);
    expect(() => camposDaMudanca({ transfer_config: { mode: 'checklist' } })).toThrow(/transfer_config/);
  });

  it('recusa o que saiu da tela', () => {
    expect(() => camposDaMudanca({ enabled: true })).toThrow(/enabled/);
    expect(() => camposDaMudanca({ crm_policy: { capture: true } }, ['crm_policy.capture'])).toThrow(/crm_policy.capture/);
  });

  // A raiz passada como "subchave" levaria o jsonb inteiro da página e apagaria o
  // que saiu da tela (crm_policy.invalid, crm_policy.capture).
  it('recusa a raiz dividida passada como subchave', () => {
    expect(() => camposDaMudanca({ crm_policy: { cold: true } }, ['crm_policy'])).toThrow(/crm_policy/);
  });
});

describe('useGravarNaHora', () => {
  it('mostra na hora (otimista), grava só o que mudou e oferece "Salvo · Desfazer"', async () => {
    const { result, aoSalvo, agent } = montar();
    const resposta = adiada<SalesAgent>();
    update.mockReturnValueOnce(resposta.promessa);
    let ok: Promise<boolean>;
    act(() => { ok = result.current.gravar({ greeting: 'Oi!' }); });
    expect(aoSalvo).toHaveBeenLastCalledWith(expect.objectContaining({ greeting: 'Oi!' }));
    await act(async () => { resposta.resolver(salvo(agent, { greeting: 'Oi!' }, '2026-10-06T10:00:00Z')); await ok!; });
    expect(update).toHaveBeenCalledWith('ia-1', { greeting: 'Oi!' });
    expect(toast).toHaveBeenCalledWith('Salvo', expect.objectContaining({ id: TOAST_SALVO, action: expect.objectContaining({ label: 'Desfazer' }) }));
  });

  // Review Focus 2: dois cliques rápidos no mesmo jsonb.
  it('dois cliques rápidos vão EM ORDEM, o segundo montado sobre a resposta do primeiro', async () => {
    const { result, agent } = montar();
    const primeira = adiada<SalesAgent>();
    update.mockReturnValueOnce(primeira.promessa);
    update.mockImplementationOnce(async (_id: string, patch: Partial<SalesAgent>) => salvo(agent, patch, '2026-10-06T10:00:02Z'));
    let a: Promise<boolean>;
    let b: Promise<boolean>;
    await act(async () => {
      a = result.current.gravar({ transfer_config: { ...agent.transfer_config, mode: 'temperatura', min_temperature: 'hot' } }, ['transfer_config.mode', 'transfer_config.min_temperature']);
      b = result.current.gravar({ transfer_config: { ...agent.transfer_config, briefing_enabled: false } }, ['transfer_config.briefing_enabled']);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(update).toHaveBeenCalledTimes(1); // o segundo espera o primeiro
    await act(async () => {
      primeira.resolver(salvo(agent, { transfer_config: { ...agent.transfer_config, mode: 'temperatura', min_temperature: 'hot' } }, '2026-10-06T10:00:01Z'));
      await a!; await b!;
    });
    expect(update).toHaveBeenCalledTimes(2);
    // O segundo PATCH leva a temperatura do primeiro (já salva) + o resumo desligado + a voz de antes.
    expect(update.mock.calls[1][1]).toEqual({
      transfer_config: { mode: 'temperatura', min_temperature: 'hot', required_questions: ['Renda'], voice: 'first_person', briefing_enabled: false },
    });
  });

  // Review Focus 3: erro do servidor volta a tela e diz o motivo.
  it('erro: volta ao último salvo, mostra o motivo do servidor e devolve false', async () => {
    const { result, aoSalvo, agent } = montar();
    update.mockRejectedValueOnce({ response: { data: { error: { message: 'Escolha a roleta.' } } } });
    let ok = true;
    await act(async () => { ok = await result.current.gravar({ greeting: 'Oi!' }); });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Escolha a roleta.');
    expect(aoSalvo).toHaveBeenLastCalledWith(expect.objectContaining({ greeting: agent.greeting }));
    expect(toast).not.toHaveBeenCalledWith('Salvo', expect.anything());
  });

  it('mudança que não muda nada não chama o servidor', async () => {
    const { result } = montar();
    await act(async () => { await result.current.gravar({ greeting: null }); });
    expect(update).not.toHaveBeenCalled();
  });

  // Review Focus 4: Desfazer depois de sair da página (outra tela gravou no mesmo jsonb).
  it('Desfazer monta sobre o salvo MAIS NOVO: não apaga o que outra tela gravou no mesmo jsonb', async () => {
    const { result, agent, unmount } = montar();
    update.mockImplementationOnce(async (_id: string, patch: Partial<SalesAgent>) => salvo(agent, patch, '2026-10-06T10:00:01Z'));
    await act(async () => { await result.current.gravar({ transfer_config: { ...agent.transfer_config, mode: 'temperatura' } }, ['transfer_config.mode']); });
    const desfazer = toast.mock.calls.find((c) => c[0] === 'Salvo')![1].action.onClick as () => void;
    unmount(); // saiu da página
    // Outra tela (o Destino) desligou o resumo depois.
    registrarSalvo(salvo(agent, { transfer_config: { ...agent.transfer_config, mode: 'temperatura', briefing_enabled: false } }, '2026-10-06T10:00:05Z'));
    update.mockImplementationOnce(async (_id: string, patch: Partial<SalesAgent>) => salvo(agent, patch, '2026-10-06T10:00:06Z'));
    await act(async () => { desfazer(); await new Promise((r) => setTimeout(r, 0)); });
    expect(update).toHaveBeenLastCalledWith('ia-1', {
      transfer_config: { mode: 'checklist', required_questions: ['Renda'], voice: 'first_person', briefing_enabled: false },
    });
  });

  // Revisão final da onda 3 (M5): a onda 2 recusa gravação NOVA de `inbox_roleta` e
  // `owner`. O Desfazer de uma IA antiga volta pro equivalente de hoje.
  it('Desfazer numa IA antiga não regrava inbox_roleta nem a persona owner', async () => {
    const { result, agent } = montar(agenteDeTeste({ handoff_target: 'inbox_roleta', persona_kind: 'owner', handoff_user_id: null }));
    update.mockImplementationOnce(async (_id: string, patch: Partial<SalesAgent>) => salvo(agent, patch, '2026-10-06T10:00:01Z'));
    await act(async () => { await result.current.gravar({ persona_kind: 'broker', handoff_target: 'number_owner' }); });
    const desfazer = toast.mock.calls.find((c) => c[0] === 'Salvo')![1].action.onClick as () => void;
    update.mockImplementationOnce(async (_id: string, patch: Partial<SalesAgent>) => salvo(agent, patch, '2026-10-06T10:00:02Z'));
    await act(async () => { desfazer(); await new Promise((r) => setTimeout(r, 0)); });
    expect(update).toHaveBeenLastCalledWith('ia-1', { persona_kind: 'assistant', handoff_target: 'roleta' });
  });

  it('o registro guarda o mais novo e ignora a cópia otimista', async () => {
    const { result, agent } = montar();
    const resposta = adiada<SalesAgent>();
    update.mockReturnValueOnce(resposta.promessa);
    let ok: Promise<boolean>;
    act(() => { ok = result.current.gravar({ greeting: 'Oi!' }); });
    expect(ultimoSalvoDa('ia-1')?.greeting).toBe(agent.greeting); // a otimista não entra
    await act(async () => { resposta.resolver(salvo(agent, { greeting: 'Oi!' }, '2026-10-06T10:00:00Z')); await ok!; });
    expect(ultimoSalvoDa('ia-1')?.greeting).toBe('Oi!');
    registrarSalvo(salvo(agent, { greeting: 'velho' }, '2026-10-01T00:00:00Z'));
    expect(ultimoSalvoDa('ia-1')?.greeting).toBe('Oi!');
  });
});
