import { describe, expect, it } from 'vitest';
import { donoEmTexto, fraseDeMover } from './qualIaAtende';
import type { IaDaCampanha, OpcaoDeIa } from '@/services/campanhas/campanhasService';

const op = (o: Partial<OpcaoDeIa>): OpcaoDeIa => ({ sales_agent_id: 'a', number_id: null, label: 'Agente A', serves_all: false, locked: null, enabled: true, ...o });
const dono = (o: Partial<IaDaCampanha>): IaDaCampanha => ({ sales_agent_id: 'a', name: 'Agente A', sales_agent_number_id: null, number_label: null, whole_number: false, note: null, ...o });

describe('fraseDeMover', () => {
  const opcoes = [op({}), op({ sales_agent_id: 'b', number_id: 'n1', label: 'Agente B · Ana' })];
  it('diz de qual IA a campanha sai', () => {
    expect(fraseDeMover([{ sales_agent_id: 'a', number_id: null }], opcoes)).toBe('Esta campanha sai da IA Agente A.');
  });
  it('junta duas e usa o nome da IA, sem o número', () => {
    expect(fraseDeMover([{ sales_agent_id: 'a', number_id: null }, { sales_agent_id: 'b', number_id: 'n1' }], opcoes))
      .toBe('Esta campanha sai da IA Agente A e da IA Agente B.');
  });
  it('IA que não está nas opções vira "outra IA"', () => {
    expect(fraseDeMover([{ sales_agent_id: 'zz', number_id: null }], opcoes)).toBe('Esta campanha sai de outra IA.');
  });
});

describe('donoEmTexto', () => {
  it('nome, número e o que o servidor escreveu', () => {
    expect(donoEmTexto(dono({}))).toBe('Agente A');
    expect(donoEmTexto(dono({ number_label: 'Ana, Bia' }))).toBe('Agente A · Ana, Bia');
    expect(donoEmTexto(dono({ whole_number: true }))).toBe('Agente A · atende todo lead do número');
    expect(donoEmTexto(dono({ note: 'atende todo anúncio' }))).toBe('Agente A · atende todo anúncio');
  });
});

describe('donos com kind (servidor novo)', () => {
  it('donoEmTexto usa o motivo com a primeira letra maiúscula', () => {
    expect(donoEmTexto(dono({ kind: 'broad', reason: 'atende todo lead que entra no funil Leads (Marketing)' })))
      .toBe('Agente A · Atende todo lead que entra no funil Leads (Marketing)');
  });
});
