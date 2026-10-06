import { describe, expect, it } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { montarPatch } from './patchDoPasso';

// A cicatriz que isto fecha: o `saveAgent` montava o PATCH campo a campo, descartava
// calado o que não estava na lista e reenviava o agente inteiro. No passo a passo
// cada passo manda SÓ os campos dele que mudaram, e jsonb dividido entre passos vai
// mesclado por subchave sobre o último salvo.
const salvo = {
  id: 'ia-1',
  name: 'IA',
  greeting: 'Oi!',
  transfer_config: { mode: 'checklist', required_questions: ['Renda'], voice: 'first_person' },
  crm_policy: { cold: false, capture: false, invalid: true },
  playbook: { vocabulary: 'IMÓVEL', vars: { tipo_venda: 'usado', perguntas_situacao: ['Mora de aluguel?'] } },
} as unknown as SalesAgent;

const com = (extra: Record<string, unknown>) => ({ ...salvo, ...extra }) as unknown as SalesAgent;

describe('montarPatch', () => {
  it('nada mudou: patch vazio', () => {
    expect(montarPatch(salvo, { ...salvo }, ['name', 'greeting', 'transfer_config.mode'])).toEqual({});
  });

  it('só viaja o que mudou', () => {
    expect(montarPatch(salvo, com({ name: 'Bia' }), ['name', 'greeting'])).toEqual({ name: 'Bia' });
  });

  it('campo limpo viaja como null', () => {
    expect(montarPatch(salvo, com({ greeting: undefined }), ['greeting'])).toEqual({ greeting: null });
  });

  it('campo fora da lista nunca viaja, mesmo mudado', () => {
    expect(montarPatch(salvo, com({ name: 'Bia' }), ['greeting'])).toEqual({});
  });

  it('mexer em transfer_config.mode manda o transfer_config inteiro, com voice e required_questions preservados', () => {
    const rascunho = com({ transfer_config: { mode: 'temperatura' } });
    expect(montarPatch(salvo, rascunho, ['transfer_config.mode'])).toEqual({
      transfer_config: { mode: 'temperatura', required_questions: ['Renda'], voice: 'first_person' },
    });
  });

  it('subchave fora da lista atravessa intacta (crm_policy.invalid)', () => {
    // O rascunho mexeu até no `invalid` (que saiu da tela): ele não está na lista
    // do passo, então vale o último salvo.
    const rascunho = com({ crm_policy: { cold: true, capture: false, invalid: false } });
    expect(montarPatch(salvo, rascunho, ['crm_policy.cold', 'crm_policy.capture'])).toEqual({
      crm_policy: { cold: true, capture: false, invalid: true },
    });
  });

  it('subchave que virou undefined sai do objeto', () => {
    const rascunho = com({ transfer_config: { mode: 'checklist', required_questions: ['Renda'] } });
    expect(montarPatch(salvo, rascunho, ['transfer_config.voice'])).toEqual({
      transfer_config: { mode: 'checklist', required_questions: ['Renda'] },
    });
  });

  it('três níveis: playbook.vars.tipo_venda preserva o resto do roteiro', () => {
    const rascunho = com({ playbook: { vars: { tipo_venda: 'loteamento' } } });
    expect(montarPatch(salvo, rascunho, ['playbook.vars.tipo_venda'])).toEqual({
      playbook: { vocabulary: 'IMÓVEL', vars: { tipo_venda: 'loteamento', perguntas_situacao: ['Mora de aluguel?'] } },
    });
  });

  it('raiz que não existia no salvo nasce só com a subchave', () => {
    const semPolitica = { ...salvo, crm_policy: null } as unknown as SalesAgent;
    expect(montarPatch(semPolitica, { ...semPolitica, crm_policy: { cold: true } } as unknown as SalesAgent, ['crm_policy.cold'])).toEqual({
      crm_policy: { cold: true },
    });
  });
});
