import { describe, expect, it } from 'vitest';
import { linhasAutomaticas, linhaDoFluxo, linhaDoFollowup } from './automacaoRodando';
import type { RunningFlow } from '@/services/flowAutomations/flowAutomationInstancesService';
import { EMPTY_LEAD_FOLLOWUP_STATE } from '@/services/leadFollowup/leadFollowupService';

const agora = new Date(2026, 9, 3, 10, 0);
const epoch = (d: Date) => Math.floor(d.getTime() / 1000);
const fluxo = (over: Partial<RunningFlow> = {}): RunningFlow => ({
  id: 'i1', flow_automation_id: 'f1', flow_name: 'Primeiro contato', state: 'scheduled', active: true,
  phase: 'running', until: null, started_at: null, ...over,
});

describe('faixa de automação rodando', () => {
  it('fluxo aguardando resposta mostra a hora do fim da espera', () => {
    const l = linhaDoFluxo(fluxo({ phase: 'waiting_reply', until: epoch(new Date(2026, 9, 3, 14, 32)) }), agora);
    expect(l.texto).toBe('Fluxo "Primeiro contato" · aguardando resposta até 14:32');
    expect(l.podeParar).toBe(true);
  });

  it('espera em outro dia mostra o dia', () => {
    const l = linhaDoFluxo(fluxo({ phase: 'waiting', until: epoch(new Date(2026, 9, 4, 9, 0)) }), agora);
    expect(l.texto).toBe('Fluxo "Primeiro contato" · esperando até 04/10 às 09:00');
  });

  it('aguardando sem limite', () => {
    expect(linhaDoFluxo(fluxo({ phase: 'waiting_reply' }), agora).texto).toContain('aguardando resposta, sem limite');
  });

  it('follow-up rodando e pausado; parado não aparece', () => {
    const base = { ...EMPTY_LEAD_FOLLOWUP_STATE, sequence: { id: 's', slug: 's', name: 'Meta Ads' }, can_stop: true };
    expect(linhaDoFollowup({ ...base, status: 'running', next_run_at: epoch(new Date(2026, 9, 3, 15, 0)) }, agora)?.texto)
      .toBe('Follow-up "Meta Ads" · próxima mensagem às 15:00');
    expect(linhaDoFollowup({ ...base, status: 'paused' }, agora)?.texto).toBe('Follow-up "Meta Ads" · pausado');
    expect(linhaDoFollowup({ ...base, status: 'idle' }, agora)).toBeNull();
    expect(linhaDoFollowup({ ...base, status: 'done' }, agora)).toBeNull();
  });

  it('junta fluxos ativos e follow-up', () => {
    const linhas = linhasAutomaticas(
      [fluxo(), fluxo({ id: 'i2', active: false })],
      { ...EMPTY_LEAD_FOLLOWUP_STATE, status: 'running', can_stop: true },
      agora,
    );
    expect(linhas.map(l => l.tipo)).toEqual(['fluxo', 'followup']);
  });
});

describe('pergunta ao enviar', () => {
  it('rótulo do botão segue o que está rodando', async () => {
    const { rotuloDeParar } = await import('./automacaoRodando');
    const f = { key: 'fluxo-1', tipo: 'fluxo' as const, id: '1', texto: '', podeParar: true };
    const fu = { key: 'followup', tipo: 'followup' as const, id: '', texto: '', podeParar: true };
    expect(rotuloDeParar([f])).toBe('Enviar e tirar do fluxo');
    expect(rotuloDeParar([fu])).toBe('Enviar e parar o follow-up');
    expect(rotuloDeParar([f, fu])).toBe('Enviar e tirar das automações');
  });

  it('"manter" vale enquanto o mesmo conjunto estiver rodando', async () => {
    const { assinaturaDasLinhas } = await import('./automacaoRodando');
    const a = { key: 'fluxo-1', tipo: 'fluxo' as const, id: '1', texto: '', podeParar: true };
    const b = { key: 'followup', tipo: 'followup' as const, id: '', texto: '', podeParar: true };
    expect(assinaturaDasLinhas([a, b])).toBe(assinaturaDasLinhas([b, a]));
    expect(assinaturaDasLinhas([a])).not.toBe(assinaturaDasLinhas([a, b]));
  });
});

// Sprint 3 (03/10/2026): o follow-up virou fluxo do construtor. Na faixa ele
// aparece como "Follow-up "X"", e o Parar continua sendo o da instância.
describe('fluxo de follow-up na faixa', () => {
  it('kind followup vira "Follow-up "X"", e o comum continua "Fluxo"', () => {
    const fu = linhaDoFluxo(fluxo({ kind: 'followup', flow_name: 'Follow-up longo', phase: 'waiting_reply', until: epoch(new Date(2026, 9, 3, 14, 32)) }), agora);
    expect(fu.texto).toBe('Follow-up "Follow-up longo" · aguardando resposta até 14:32');
    expect(fu.tipo).toBe('followup');
    // O id da instância vai junto: é por ele que a faixa para o fluxo.
    expect(fu.id).toBe('i1');
    expect(linhaDoFluxo(fluxo({ kind: 'automation' }), agora).texto).toBe('Fluxo "Primeiro contato" · em andamento');
    expect(linhaDoFluxo(fluxo({ kind: undefined }), agora).tipo).toBe('fluxo');
  });

  it('o botão da pergunta fala de follow-up', async () => {
    const { rotuloDeParar } = await import('./automacaoRodando');
    expect(rotuloDeParar([linhaDoFluxo(fluxo({ kind: 'followup' }), agora)])).toBe('Enviar e parar o follow-up');
  });
});

// Sprint 4 (04/10/2026): o funil de conversa disparado no campo de mensagem
// aparece como "Funil "X"", com o Parar da instância.
describe('funil de conversa na faixa', () => {
  it('kind conversation vira "Funil "X""', async () => {
    const f = linhaDoFluxo(fluxo({ kind: 'conversation', flow_name: 'Apresentação do imóvel' }), agora);
    expect(f.texto).toBe('Funil "Apresentação do imóvel" · em andamento');
    expect(f.tipo).toBe('funil');
    expect(f.id).toBe('i1');
    const { rotuloDeParar } = await import('./automacaoRodando');
    expect(rotuloDeParar([f])).toBe('Enviar e parar o funil');
  });
});
