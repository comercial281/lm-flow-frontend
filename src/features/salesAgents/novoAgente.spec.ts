import { describe, expect, it } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { avisoDoNumero, payloadDoNovo, podeSeguir, rascunhoVazio, type RascunhoDoNovo } from './novoAgente';

const agente = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({
    id, name, enabled: true, inbox_id: null, triggers: [], trigger_keyword: null, absorbed_into_id: null,
    numbers: [{ id: `n-${id}`, inbox_id: 'in-1', triggers: null }],
    ...extra,
  }) as unknown as SalesAgent;

const base = (extra: Partial<RascunhoDoNovo> = {}): RascunhoDoNovo => ({
  ...rascunhoVazio(), nome: 'Agente A', job: 'filtra_passa', serves: ['venda'], ...extra,
});

describe('payloadDoNovo', () => {
  it('nasce sempre desligado, com visita de próximo passo', () => {
    const p = payloadDoNovo(base());
    expect(p).toMatchObject({ name: 'Agente A', enabled: false, job: 'filtra_passa', next_steps: ['visita'], serves: ['venda'] });
    // O número entra depois, um a um (criarNumero): o corpo do agente não leva inbox.
    expect(p).not.toHaveProperty('inbox_id');
  });

  it('sem marca escolhida, usa as que têm imóvel', () => {
    expect(payloadDoNovo(base({ serves: [] }), ['venda', 'locacao']).serves).toEqual(['venda', 'locacao']);
  });

  it('sem marca e sem imóvel, não manda serves (o servidor decide)', () => {
    expect(payloadDoNovo(base({ serves: [] }), [])).not.toHaveProperty('serves');
  });

  it('a ficha da casa leva só o que foi preenchido', () => {
    const p = payloadDoNovo(base({ casa: { kind: 'corretor', name: ' Bia ', gender: 'ela', intro: '' } }));
    expect(p.house_voice).toEqual({ kind: 'corretor', name: 'Bia', gender: 'ela' });
  });

  it('o nome vai sem espaço nas pontas', () => {
    expect(payloadDoNovo(base({ nome: '  Agente B ' })).name).toBe('Agente B');
  });
});

describe('avisoDoNumero (seção 8 da spec)', () => {
  it('agente LIGADO sem gatilho no número: avisa que vai precisar de gatilhos', () => {
    expect(avisoDoNumero('in-1', [agente('a1', 'Agente B')])).toBe(
      'pra dividir este número, o agente Agente B vai precisar de gatilhos; ele não muda até você ligar este',
    );
  });

  it('agente desligado não muda nada', () => {
    expect(avisoDoNumero('in-1', [agente('a1', 'Agente B', { enabled: false })])).toBeNull();
  });

  it('rascunho (sem número ligado) e agente juntado não contam', () => {
    expect(avisoDoNumero('in-1', [agente('a1', 'Agente B', { enabled: false, numbers: [] })])).toBeNull();
    expect(avisoDoNumero('in-1', [agente('a1', 'Agente B', { absorbed_into_id: 'a9' })])).toBeNull();
  });

  it('agente ligado que já filtra por gatilho no número não precisa de aviso', () => {
    const comGatilho = agente('a1', 'Agente B', { numbers: [{ id: 'n1', inbox_id: 'in-1', triggers: [{ type: 'keyword', value: 'oi' }] }] });
    expect(avisoDoNumero('in-1', [comGatilho])).toBeNull();
  });

  it('número herdando os gatilhos do agente: vale o do agente', () => {
    const herda = agente('a1', 'Agente B', { triggers: [{ type: 'tag', value: 'x' }] });
    expect(avisoDoNumero('in-1', [herda])).toBeNull();
  });

  it('outro número não gera aviso', () => {
    expect(avisoDoNumero('in-2', [agente('a1', 'Agente B')])).toBeNull();
  });
});

describe('podeSeguir', () => {
  it('passo 1 pede modo e nome', () => {
    expect(podeSeguir(1, base({ job: null }))).toBe(false);
    expect(podeSeguir(1, base({ nome: '   ' }))).toBe(false);
    expect(podeSeguir(1, base())).toBe(true);
  });

  it('passos 2 e 3 sempre seguem; o 4 pede pelo menos uma marca', () => {
    expect(podeSeguir(2, base({ inboxIds: [] }))).toBe(true);
    expect(podeSeguir(3, base())).toBe(true);
    expect(podeSeguir(4, base({ serves: [] }))).toBe(false);
    expect(podeSeguir(4, base())).toBe(true);
  });
});
