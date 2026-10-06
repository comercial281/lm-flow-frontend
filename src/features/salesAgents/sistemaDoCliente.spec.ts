import { describe, expect, it } from 'vitest';
import type { WebhookDelivery } from '@/services/salesAgents/salesAgentsService';
import {
  dataHora,
  fraseDaResposta,
  hora,
  linhaNoPainelDoLead,
  problemaNoEndereco,
  segundos,
  situacaoDoEnvio,
  webhookDisponivel,
} from './sistemaDoCliente';

// Sistema do cliente (05/10/2026): o 4º destino do lead. O servidor é quem manda
// (confere de novo com DNS em cada envio); aqui a tela só avisa cedo o que é óbvio.
describe('problemaNoEndereco', () => {
  it('endereço https público passa', () => {
    expect(problemaNoEndereco(' https://crm.imobiliaria-exemplo.com.br/lmflow ')).toBeNull();
  });

  it('vazio, sem https, malformado, interno e longo demais avisam', () => {
    expect(problemaNoEndereco('')).toBe('Preencha o endereço do sistema do cliente.');
    expect(problemaNoEndereco('http://crm.exemplo.com.br')).toBe('O endereço precisa começar com https://');
    expect(problemaNoEndereco('https://')).toBe('Este endereço não é válido.');
    expect(problemaNoEndereco('https://localhost/x')).toBe('Endereço de rede interna não é aceito.');
    expect(problemaNoEndereco('https://10.0.0.5/x')).toBe('Endereço de rede interna não é aceito.');
    expect(problemaNoEndereco('https://api.railway.internal/x')).toBe('Endereço de rede interna não é aceito.');
    expect(problemaNoEndereco(`https://crm.exemplo.com.br/${'a'.repeat(500)}`)).toBe(
      'Endereço longo demais (máximo 500 caracteres).',
    );
  });
});

describe('webhookDisponivel', () => {
  it('na persona corretor o lead vai sempre pro dono do número', () => {
    expect(webhookDisponivel('broker')).toBe(false);
    expect(webhookDisponivel('owner')).toBe(true);
    expect(webhookDisponivel('assistant')).toBe(true);
  });
});

describe('horários e tempos, no fuso de São Paulo', () => {
  it('formata', () => {
    expect(hora('2026-10-05T17:32:00Z')).toBe('14:32');
    expect(dataHora('2026-10-05T17:32:00Z')).toBe('05/10 14:32');
    expect(segundos(312)).toBe('0,3 s');
    expect(hora(null)).toBe('');
  });
});

describe('fraseDaResposta', () => {
  it('diz em português o que o código significa', () => {
    expect(fraseDaResposta(200)).toBe('recebeu (código 200)');
    expect(fraseDaResposta(401)).toContain('confira se a chave secreta');
    expect(fraseDaResposta(301)).toContain('cadastre o endereço final');
    expect(fraseDaResposta(404)).toBe('não achou o endereço (código 404)');
    expect(fraseDaResposta(503)).toBe('deu erro do lado dele (código 503)');
    expect(fraseDaResposta(null)).toBe('não respondeu');
  });
});

const envio = (parcial: Partial<WebhookDelivery>): WebhookDelivery => ({
  id: 'd1',
  created_at: '2026-10-05T17:32:00Z',
  mode: 'real',
  status: 'pending',
  attempts: 0,
  max_attempts: 5,
  next_attempt_at: null,
  response_code: null,
  response_excerpt: null,
  last_error: null,
  duration_ms: null,
  delivered_at: null,
  failed_at: null,
  contact_name: 'Mariana Souza',
  conversation_path: '/conversations/4821',
  ...parcial,
});

describe('situacaoDoEnvio', () => {
  it('entregue, entregue depois de tentar, não entregue, tentando e enviando', () => {
    expect(situacaoDoEnvio(envio({ status: 'delivered', attempts: 1 }))).toEqual({ tom: 'ok', texto: 'Entregue' });
    expect(situacaoDoEnvio(envio({ status: 'delivered', attempts: 3 }))).toEqual({ tom: 'ok', texto: 'Entregue na 3ª tentativa' });
    expect(situacaoDoEnvio(envio({ status: 'failed', attempts: 5 }))).toEqual({ tom: 'erro', texto: 'Não entregue (5 tentativas)' });
    expect(situacaoDoEnvio(envio({ attempts: 2, next_attempt_at: '2026-10-05T17:47:00Z' }))).toEqual({
      tom: 'alerta',
      texto: 'Tentando de novo às 14:47 (2 de 5)',
    });
    expect(situacaoDoEnvio(envio({}))).toEqual({ tom: 'alerta', texto: 'Enviando…' });
  });
});

describe('linhaNoPainelDoLead', () => {

  it('no CVCRM diz CVCRM e, entregue, pra quem foi', () => {
    const cv = (extra: Record<string, unknown>) => ({ sales_agent_handoff_webhook: { system: 'cvcrm', at: '2026-10-06T17:32:00Z', ...extra } });
    expect(linhaNoPainelDoLead(cv({ status: 'pending' }))).toEqual({ tom: 'alerta', texto: 'Enviando ao CVCRM…' });
    expect(linhaNoPainelDoLead(cv({ status: 'delivered', owner: 'José da Silva' })))
      .toEqual({ tom: 'ok', texto: 'Entregue no CVCRM às 14:32 para José da Silva.' });
    expect(linhaNoPainelDoLead(cv({ status: 'delivered' })))
      .toEqual({ tom: 'ok', texto: 'Entregue no CVCRM às 14:32, na distribuição do CVCRM.' });
    expect(linhaNoPainelDoLead(cv({ status: 'failed', error: 'O CVCRM recusou o e-mail ou o token.' }))?.texto)
      .toBe('O envio ao CVCRM falhou: O CVCRM recusou o e-mail ou o token. A gestão foi avisada; o lead não foi pra roleta.');
  });
  it('lê o espelho do envio gravado na conversa', () => {
    expect(linhaNoPainelDoLead({})).toBeNull();
    expect(linhaNoPainelDoLead({ sales_agent_handoff_webhook: { status: 'pending' } })).toEqual({
      tom: 'alerta',
      texto: 'Enviando ao sistema do cliente…',
    });
    expect(linhaNoPainelDoLead({ sales_agent_handoff_webhook: { status: 'delivered', at: '2026-10-05T17:32:00Z' } })).toEqual({
      tom: 'ok',
      texto: 'Enviado ao sistema do cliente às 14:32.',
    });
    expect(
      linhaNoPainelDoLead({ sales_agent_handoff_webhook: { status: 'failed', error: 'o sistema do cliente deu erro (500)' } }),
    ).toEqual({
      tom: 'erro',
      texto:
        'O envio ao sistema do cliente falhou: o sistema do cliente deu erro (500). A gestão foi avisada; o lead não foi pra roleta.',
    });
  });
});
