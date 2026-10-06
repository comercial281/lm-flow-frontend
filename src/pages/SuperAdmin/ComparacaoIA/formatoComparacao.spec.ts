import { describe, it, expect } from 'vitest';
import { corpoDoItem, filaDeAvaliacao, nota, resumo, resumoEmTexto, veredito } from './formatoComparacao';
import type { ComparisonResult, ComparisonScores } from '@/services/superAdmin/superAgentsService';

const cheia: ComparisonScores = { obrigatorias: null, repasse: null, persona: 2, configuracao: 2, puxou_conversa: 2, seguranca: 2 };

function par(antigo: Partial<ComparisonScores>, novo: Partial<ComparisonScores>, disagreement = true): ComparisonResult {
  const lado = (s: Partial<ComparisonScores>) => ({ version: 1, turn: { kind: 'reply' as const, at: '', messages: [], reaction: null, note: null, media: [], outcome: null }, scores: { ...cheia, ...s }, comment: null });
  return { history_tail: '', real_reply: null, baseline: lado(antigo), candidate: lado(novo), judge_model: 'm', disagreement };
}

describe('formatoComparacao', () => {
  it('fila: cada ponto de cada conversa, depois os cenários', () => {
    const fila = filaDeAvaliacao([{ id: 'c1', points: 2 }, { id: 'c2', points: 1 }], [{ id: 'ctwa', firstMessage: 'oi', history: [] }]);
    expect(fila.map(corpoDoItem)).toEqual([
      { conversation_id: 'c1', point_index: 0 },
      { conversation_id: 'c1', point_index: 1 },
      { conversation_id: 'c2', point_index: 0 },
      { scenario: { id: 'ctwa', message: 'oi', history: [] } },
    ]);
  });

  it('nota nula vira travessão', () => {
    expect(nota(null)).toBe('—');
    expect(nota(2)).toBe('2');
  });

  it('resumo: média por item ignorando "não se aplica", quebras e discordâncias', () => {
    const r = resumo([par({}, { puxou_conversa: 0 }), par({}, {}, false)]);
    const puxou = r.itens.find((i) => i.chave === 'puxou_conversa');
    expect(puxou).toMatchObject({ mediaAntigo: 2, mediaNovo: 1 });
    expect(r.itens.find((i) => i.chave === 'repasse')).toMatchObject({ mediaAntigo: null, mediaNovo: null });
    expect(r).toMatchObject({ total: 2, discordancias: 1, quebrasAntigo: 0, quebrasNovo: 0 });
  });

  // A regra da spec pra ligar o roteiro novo: empata ou ganha em TODOS os itens e
  // não quebra regra de segurança.
  it('veredito segue a regra de ligar', () => {
    expect(veredito(resumo([par({}, {}, false)]))).toBe('O novo empata ou ganha em todos os itens e não quebra regra de segurança.');
    expect(veredito(resumo([par({}, { puxou_conversa: 0 })]))).toBe('O novo perde em: Terminou puxando a conversa.');
    expect(veredito(resumo([par({}, { seguranca: 0 })]))).toBe('O novo quebrou regra de segurança em 1 resposta.');
  });

  it('resumo em texto pra colar no PR ou na memória', () => {
    const texto = resumoEmTexto(resumo([par({}, {}, false)]), 'IA Panamby', 1, 1);
    expect(texto).toContain('IA Panamby — roteiro 1 × roteiro 1 — 1 respostas');
    expect(texto).toContain('| Quem ela é | 2,0 | 2,0 |');
  });
});
