import { describe, expect, it } from 'vitest';

import type { HealthReport, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { motivoSemAtendimento, pendenciasDaIa, restricaoDosGatilhos, situacaoDaIa } from './situacao';

// O veredito é LEITURA: o que o servidor faria com esta configuração. Cada caso
// aqui é uma IA real do levantamento de 05/10/2026 ou um item do checklist §6.
const ia = (extra: Partial<SalesAgent> = {}) =>
  ({ id: 'ia-1', enabled: true, inbox_id: 'inbox-1', triggers: [], trigger_keyword: null, trigger_match_mode: 'any', ...extra }) as SalesAgent;

const diag = (...items: [string, 'ok' | 'warning' | 'error', string?][]): HealthReport => ({
  status: items.some(([, s]) => s === 'error') ? 'error' : items.some(([, s]) => s === 'warning') ? 'warning' : 'ok',
  items: items.map(([key, status, detail]) => ({ key, label: key, status, detail: detail ?? key })),
});

describe('situacaoDaIa', () => {
  it('ligada, com número e sem gatilho: atendendo', () => {
    expect(situacaoDaIa(ia())).toEqual({ tipo: 'atendendo', frase: 'Atendendo' });
  });

  // "IA Vendedora LM Flow - Demo": ligada sem número. Era a bolinha verde.
  it('ligada sem número: parada, falta o número, corrigir em Configurar', () => {
    expect(situacaoDaIa(ia({ inbox_id: null }))).toEqual({ tipo: 'parada', frase: 'Parada: falta o número', corrigir: { tela: 'configurar' } });
  });

  // As duas "Nova IA Vendedora" vazias e as IAs de fábrica nunca configuradas.
  it('desligada e sem número: rascunho', () => {
    expect(situacaoDaIa(ia({ enabled: false, inbox_id: null })).tipo).toBe('rascunho');
  });

  it('desligada com número: desligada', () => {
    expect(situacaoDaIa(ia({ enabled: false })).frase).toBe('Desligada');
  });

  // Checklist §6: "Canal de WhatsApp — O canal vinculado não existe mais" com "IA ligada" verde em cima.
  it('número apagado (erro no item inbox do Diagnóstico): parada', () => {
    expect(situacaoDaIa(ia(), diag(['enabled', 'ok'], ['inbox', 'error'])).frase).toBe('Parada: o número desta IA não existe mais');
  });

  it('WhatsApp desconectado: parada, corrigir no Diagnóstico', () => {
    const s = situacaoDaIa(ia(), diag(['credentials', 'error']));
    expect(s).toEqual({ tipo: 'parada', frase: 'Parada: o WhatsApp do número está desconectado', corrigir: { tela: 'diagnostico' } });
  });

  it('"só follow-up" para a resposta ao vivo, mesmo sem Diagnóstico', () => {
    expect(situacaoDaIa(ia({ followup_only: true })).tipo).toBe('parada');
  });

  it('erro que não para a IA (base de conhecimento) não muda o veredito', () => {
    expect(situacaoDaIa(ia(), diag(['knowledge', 'error'])).tipo).toBe('atendendo');
  });

  // Checklist §6: o gatilho de teste "call" esquecido, que o Diagnóstico mostrava verde.
  it('gatilho de palavra: atendendo com restrição, com a palavra escrita', () => {
    const s = situacaoDaIa(ia({ triggers: [{ type: 'keyword', value: 'call', match_type: 'contains' }] }));
    expect(s).toEqual({ tipo: 'restricao', frase: 'Atendendo com restrição: só quem escrever "call"', corrigir: { tela: 'configurar' } });
  });

  it('a palavra-chave antiga também restringe', () => {
    expect(situacaoDaIa(ia({ trigger_keyword: ' fluxoimob ' })).frase).toBe('Atendendo com restrição: só quem escrever "fluxoimob"');
  });
});

describe('restricaoDosGatilhos (espelho do TriggerGate)', () => {
  it('lista com gatilho de palavra ignora a palavra-chave antiga, como o servidor', () => {
    const r = restricaoDosGatilhos(ia({ trigger_keyword: 'velha', triggers: [{ type: 'keyword', value: 'nova' }] }));
    expect(r?.frase).toBe('só quem escrever "nova"');
  });

  it('com OU, "Origem: todos os leads" deixa todo mundo passar', () => {
    expect(restricaoDosGatilhos(ia({ triggers: [{ type: 'keyword', value: 'x' }, { type: 'origin', mode: 'all' }] }))).toBeNull();
  });

  it('vários gatilhos: OU vira "ou", E vira "e"', () => {
    const triggers = [{ type: 'origin' as const, mode: 'ads' }, { type: 'tag' as const, value: 'vip' }, { type: 'property' as const, mode: 'code', code: 'ap12' }];
    expect(restricaoDosGatilhos(ia({ triggers }))?.frase).toBe('só lead de anúncio, quem tem a etiqueta "vip" ou lead do imóvel AP12');
    expect(restricaoDosGatilhos(ia({ triggers, trigger_match_mode: 'all' }))?.frase).toBe('só lead de anúncio, quem tem a etiqueta "vip" e lead do imóvel AP12');
  });

  it('gatilho em branco: com OU some da frase; sozinho, ninguém passa', () => {
    expect(restricaoDosGatilhos(ia({ triggers: [{ type: 'keyword', value: '' }, { type: 'pipeline', mode: 'any', pipeline_id: '' }] }))?.frase).toBe('só quem tem card no funil');
    expect(restricaoDosGatilhos(ia({ triggers: [{ type: 'form', form_ids: [] }] }))).toEqual({ frase: 'os gatilhos estão em branco e não deixam ninguém passar', parada: true });
  });

  it('com E, um gatilho em branco trava todo mundo e o veredito vira parada', () => {
    const agente = ia({ trigger_match_mode: 'all', triggers: [{ type: 'origin', mode: 'ads' }, { type: 'tag', value: ' ' }] });
    expect(situacaoDaIa(agente)).toEqual({ tipo: 'parada', frase: 'Parada: um gatilho está em branco e não deixa ninguém passar', corrigir: { tela: 'configurar' } });
  });
});

describe('pendenciasDaIa', () => {
  it('itens do Diagnóstico fora do ok, graves primeiro, cada um com onde corrigir', () => {
    const p = pendenciasDaIa(ia(), diag(['enabled', 'ok'], ['knowledge', 'warning', 'Nenhum documento pronto.'], ['inbox', 'error', 'O canal vinculado não existe mais.'], ['api_key', 'error']));
    expect(p.map((x) => x.chave)).toEqual(['inbox', 'api_key', 'knowledge']);
    expect(p[0]).toMatchObject({ grave: true, corrigir: { tela: 'configurar' }, detalhe: 'O canal vinculado não existe mais.' });
    expect(p[1].corrigir).toBeUndefined();
    expect(p[2]).toMatchObject({ grave: false, corrigir: { tela: 'ensinar' } });
  });

  it('"IA ligada" desligada não vira pendência (já é o veredito)', () => {
    expect(pendenciasDaIa(ia({ enabled: false }), diag(['enabled', 'error'])).map((x) => x.chave)).toEqual([]);
  });

  it('gatilho restringindo vira pendência laranja mesmo com o servidor dizendo ok', () => {
    const p = pendenciasDaIa(ia({ triggers: [{ type: 'keyword', value: 'call' }] }), diag(['triggers', 'ok']));
    expect(p).toEqual([{ chave: 'triggers', titulo: 'Quem ela atende', detalhe: 'Só quem escrever "call".', grave: false, corrigir: { tela: 'configurar' } }]);
  });

  it('aviso do servidor sobre o gatilho não se repete', () => {
    const p = pendenciasDaIa(ia({ trigger_keyword: 'call' }), diag(['triggers', 'warning', 'A palavra-chave "call" está preenchida']));
    expect(p.filter((x) => x.chave === 'triggers')).toHaveLength(1);
  });

  // Caso real do levantamento de 05/10: follow-up ligado com máximo 0.
  it('follow-up ligado com máximo 0 vira aviso laranja', () => {
    const p = pendenciasDaIa(ia({ followup_enabled: true, followup_max_attempts: 0 }), diag());
    expect(p).toEqual([expect.objectContaining({ chave: 'followup_sem_limite', titulo: 'Follow-up sem limite de tentativas', grave: false })]);
  });

  it('sem o Diagnóstico ainda, falta de número aparece pela própria IA', () => {
    expect(pendenciasDaIa(ia({ inbox_id: null }))[0]).toMatchObject({ chave: 'inbox', grave: true });
  });
});

// Checklist §6 (aba Resultados): "Tudo 0 e Nenhum atendimento registrado" sem dizer que faltava o número.
describe('motivoSemAtendimento', () => {
  it('parada: o motivo sem o "Parada:"', () => {
    expect(motivoSemAtendimento({ tipo: 'parada', frase: 'Parada: falta o número' })).toBe('falta o número');
  });

  it('desligada e rascunho têm motivo; atendendo (com ou sem restrição) não', () => {
    expect(motivoSemAtendimento({ tipo: 'desligada', frase: 'Desligada' })).toBe('ela está desligada');
    expect(motivoSemAtendimento({ tipo: 'rascunho', frase: 'Rascunho: falta escolher o número' })).toBe('ela ainda é um rascunho, sem número');
    expect(motivoSemAtendimento({ tipo: 'atendendo', frase: 'Atendendo' })).toBeNull();
    expect(motivoSemAtendimento({ tipo: 'restricao', frase: 'x' })).toBeNull();
  });
});
