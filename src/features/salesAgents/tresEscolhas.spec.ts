import { describe, expect, it } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { escolhasParaPatch, lerEscolhas, novaIaRascunho, PERGUNTAS_SUGERIDAS } from './tresEscolhas';

const ia = (extra: Partial<SalesAgent> = {}) =>
  ({ transfer_config: {}, booking_enabled: true, handoff_target: 'inbox_roleta', handoff_roleta_config_id: null, handoff_user_id: null, ...extra }) as SalesAgent;

describe('lerEscolhas', () => {
  it('lê as colunas novas quando vêm do servidor', () => {
    expect(lerEscolhas(ia({ persona_kind: 'owner', reach: 'qualify', handoff_target: 'roleta' }))).toEqual({
      persona: 'owner', alcance: 'qualify', destino: 'roleta',
    });
  });

  // Servidor antigo (sem as colunas): a mesma derivação do SalesAgent#persona_kind_value.
  it('sem coluna, deriva da voz e do agendar visita', () => {
    expect(lerEscolhas(ia({ transfer_config: { voice: 'first_person' } }))).toMatchObject({ persona: 'broker', alcance: 'visit' });
    expect(lerEscolhas(ia({ booking_enabled: false }))).toMatchObject({ persona: 'assistant', alcance: 'qualify' });
  });
});

describe('escolhasParaPatch', () => {
  it('o próprio corretor: destino travado no dono do número, alvos limpos, voz gravada, resto do repasse intacto', () => {
    const agente = ia({ transfer_config: { mode: 'checklist', required_questions: ['Renda'] }, handoff_target: 'user', handoff_user_id: 'u1' });
    expect(escolhasParaPatch({ persona: 'broker', alcance: 'visit', destino: 'user' }, agente)).toEqual({
      persona_kind: 'broker',
      reach: 'visit',
      booking_enabled: true,
      transfer_config: { mode: 'checklist', required_questions: ['Renda'], voice: 'first_person' },
      handoff_target: 'number_owner',
      handoff_roleta_config_id: null,
      handoff_user_id: null,
    });
  });

  // Roleta nova: "a roleta do número" não existe; o servidor recusa gravar.
  it('saindo do corretor: tira a voz e vira "Uma roleta" em branco', () => {
    const agente = ia({ transfer_config: { voice: 'first_person', mode: 'checklist' }, handoff_target: 'number_owner' });
    expect(escolhasParaPatch({ persona: 'owner', alcance: 'visit', destino: 'number_owner' }, agente)).toMatchObject({
      persona_kind: 'owner',
      transfer_config: { mode: 'checklist' },
      handoff_target: 'roleta', handoff_roleta_config_id: null, handoff_user_id: null,
    });
  });

  it('valor antigo "a roleta do número" nunca é gravado: vira "Uma roleta"', () => {
    expect(escolhasParaPatch({ persona: 'assistant', alcance: 'qualify', destino: 'inbox_roleta' }, ia())).toMatchObject({
      handoff_target: 'roleta', handoff_roleta_config_id: null,
    });
  });

  it('dono com roleta escolhida mantém a roleta', () => {
    const agente = ia({ handoff_target: 'roleta', handoff_roleta_config_id: 'r1' });
    expect(escolhasParaPatch({ persona: 'owner', alcance: 'qualify', destino: 'roleta' }, agente)).toMatchObject({
      handoff_target: 'roleta', handoff_roleta_config_id: 'r1', handoff_user_id: null, reach: 'qualify', booking_enabled: false,
    });
  });
});

describe('novaIaRascunho', () => {
  // A roleta do número não existe: nasce em "Uma roleta".
  it('nasce desligada, sem número, assistente, só qualifica, em "Uma roleta", com as 4 perguntas obrigatórias e follow-up de 3', () => {
    const p = novaIaRascunho();
    expect(p).toMatchObject({
      enabled: false, inbox_id: null, persona_kind: 'assistant', reach: 'qualify', booking_enabled: false,
      handoff_target: 'roleta', followup_max_attempts: 3, out_of_hours_reply: true,
      transfer_config: { mode: 'checklist', required_questions: PERGUNTAS_SUGERIDAS },
    });
    expect(p.qualification_questions).toEqual(PERGUNTAS_SUGERIDAS);
    expect(PERGUNTAS_SUGERIDAS).toHaveLength(4);
  });
});
