import { describe, expect, it } from 'vitest';
import { donoEmTexto, fraseDeMover, opcoesDaTela, podeTirar } from './qualIaAtende';
import type { IaDaCampanha, OpcaoDeIa } from '@/services/campanhas/campanhasService';

const op = (o: Partial<OpcaoDeIa>): OpcaoDeIa => ({ sales_agent_id: 'a', number_id: null, label: 'Agente A', serves_all: false, locked: null, enabled: true, ...o });
const dono = (o: Partial<IaDaCampanha>): IaDaCampanha => ({ sales_agent_id: 'a', name: 'Agente A', sales_agent_number_id: null, number_label: null, whole_number: false, note: null, ...o });

describe('opcoesDaTela (só arruma o que o servidor devolveu)', () => {
  it('mantém a ordem e o rótulo do servidor; IA desligada avisa', () => {
    const r = opcoesDaTela([op({}), op({ sales_agent_id: 'b', label: 'Agente B', enabled: false })], []);
    expect(r.map((o) => o.rotulo)).toEqual(['Agente A', 'Agente B (desligada)']);
  });

  it('a que atende todo lead do número vem fixa, sem poder escolher', () => {
    const [o] = opcoesDaTela([op({ serves_all: true, label: 'Agente A · Ana' })], []);
    expect(o.rotulo).toBe('Agente A · Ana · atende todo lead do número');
    expect(o.fixa).toBe(true);
  });

  it('marca quem já atende a campanha', () => {
    const r = opcoesDaTela([op({}), op({ sales_agent_id: 'b', label: 'Agente B' })], [dono({})]);
    expect(r.map((o) => o.jaAtende)).toEqual([true, false]);
  });
});

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
  it('"depende" não conta como quem já atende: a IA continua na lista de escolha', () => {
    const r = opcoesDaTela([op({})], [dono({ kind: 'depends', reason: 'pode atender se a conversa trouxer a palavra X', removable: false })]);
    expect(r[0].jaAtende).toBe(false);
  });
  it('"broad" e "campaign" contam como quem já atende; servidor antigo (kind ausente) também', () => {
    expect(opcoesDaTela([op({})], [dono({ kind: 'broad' })])[0].jaAtende).toBe(true);
    expect(opcoesDaTela([op({})], [dono({ kind: 'campaign', removable: true })])[0].jaAtende).toBe(true);
    expect(opcoesDaTela([op({})], [dono({})])[0].jaAtende).toBe(true);
  });
  it('donoEmTexto usa o motivo com a primeira letra maiúscula', () => {
    expect(donoEmTexto(dono({ kind: 'broad', reason: 'atende todo lead que entra no funil Leads (Marketing)' })))
      .toBe('Agente A · Atende todo lead que entra no funil Leads (Marketing)');
  });
  it('podeTirar: só campaign removível; sem kind, a regra de antes', () => {
    expect(podeTirar(dono({ kind: 'campaign', removable: true }))).toBe(true);
    expect(podeTirar(dono({ kind: 'campaign', removable: false }))).toBe(false);
    expect(podeTirar(dono({ kind: 'broad', removable: true }))).toBe(false);
    expect(podeTirar(dono({ kind: 'depends' }))).toBe(false);
    expect(podeTirar(dono({}))).toBe(true);
    expect(podeTirar(dono({ note: 'x' }))).toBe(false);
    expect(podeTirar(dono({ whole_number: true }))).toBe(false);
  });
});
