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
