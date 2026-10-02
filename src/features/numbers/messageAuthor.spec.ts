import { describe, it, expect } from 'vitest';
import { DEVICE_SENT_LABEL, agentDisplayNameFor, isFollowupMessage } from './messageAuthor';

// O nome ao lado do selo "Atendente" (fase 2b.2, E41). Mensagem nossa nunca é
// assinada pelo lead; automática não leva nome; digitada no celular de número
// sem dono diz "· pelo celular" — nunca um nome inventado.
describe('agentDisplayNameFor', () => {
  it('pessoa da equipe: o nome dela', () => {
    expect(agentDisplayNameFor({ sender: { type: 'user', name: 'Ana' }, content_attributes: {} })).toBe('Ana');
  });

  it('autor gravado como o contato: sem nome', () => {
    expect(agentDisplayNameFor({ sender: { type: 'contact', name: 'Maria' }, content_attributes: {} })).toBe('');
  });

  it('automática: sem nome, mesmo com autor gravado', () => {
    expect(agentDisplayNameFor({ sender: { type: 'user', name: 'Admin' }, content_attributes: { automated: true } })).toBe('');
  });

  it('pelo celular, em número sem dono', () => {
    expect(agentDisplayNameFor({ sender: null, content_attributes: { device_sent: true } })).toBe('· pelo celular');
    expect(DEVICE_SENT_LABEL).toBe('· pelo celular');
  });

  it('sem autor e sem marca: sem nome', () => {
    expect(agentDisplayNameFor({ sender: null, content_attributes: null })).toBe('');
  });
});

describe('isFollowupMessage', () => {
  it('follow-up de funil (marca followup_job_id)', () => {
    expect(isFollowupMessage({ content_attributes: { automated: true, followup_job_id: 'abc' } })).toBe(true);
  });

  it('follow-up da IA Vendedora (marca followup)', () => {
    expect(isFollowupMessage({ content_attributes: { sales_agent: true, followup: true } })).toBe(true);
  });

  it('resposta normal da IA, automação e mensagem de gente: não', () => {
    expect(isFollowupMessage({ content_attributes: { sales_agent: true } })).toBe(false);
    expect(isFollowupMessage({ content_attributes: { automated: true } })).toBe(false);
    expect(isFollowupMessage({ sender: { type: 'user', name: 'Ana' }, content_attributes: null })).toBe(false);
  });
});
