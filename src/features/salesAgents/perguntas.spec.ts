import { describe, expect, it } from 'vitest';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { perguntasDoAgente, perguntasParaPatch } from './perguntas';

const ia = (perguntas: string[], obrigatorias?: string[]) =>
  ({ qualification_questions: perguntas, transfer_config: { mode: 'checklist', voice: 'first_person', required_questions: obrigatorias } }) as SalesAgent;

describe('perguntasDoAgente', () => {
  // Lista de obrigatórias VAZIA no servidor = todas valem (handoffChecklist.ts).
  it('nenhuma marcada no servidor aparece tudo marcado', () => {
    expect(perguntasDoAgente(ia(['Renda', 'Quartos']))).toEqual([
      { texto: 'Renda', obrigatoria: true }, { texto: 'Quartos', obrigatoria: true },
    ]);
  });

  it('marca só as gravadas, e a obrigatória que saiu da lista volta no fim', () => {
    expect(perguntasDoAgente(ia(['Renda', 'Quartos'], ['Quartos', 'FGTS']))).toEqual([
      { texto: 'Renda', obrigatoria: false }, { texto: 'Quartos', obrigatoria: true }, { texto: 'FGTS', obrigatoria: true },
    ]);
  });
});

describe('perguntasParaPatch', () => {
  it('grava a ordem, as marcadas explícitas e preserva o resto do repasse', () => {
    const lista = [{ texto: ' Quartos ', obrigatoria: true }, { texto: '', obrigatoria: true }, { texto: 'Renda', obrigatoria: false }];
    expect(perguntasParaPatch(lista, ia(['Renda', 'Quartos']))).toEqual({
      qualification_questions: ['Quartos', 'Renda'],
      transfer_config: { mode: 'checklist', voice: 'first_person', required_questions: ['Quartos'] },
    });
  });
});
