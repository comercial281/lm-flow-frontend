import { describe, expect, it } from 'vitest';
import type { PipelineStage } from '@/types/analytics';
import { csvDoFunil } from './csvDoFunil';

const STAGES = [
  { id: 's1', name: 'Novo', items: [
    { id: 'i1', status: 'open', entered_at: 1_791_298_800, value: 1500,
      contact: { name: 'Maria "Mari" Souza', email: 'maria@exemplo.com.br', phone_number: '+5511999990000' } },
  ] },
  { id: 's2', name: 'Proposta', items: [
    { id: 'i2', status: 'lost', entered_at: 1_790_866_800, lost_reason: { id: 'm1', label: 'Adiou a compra' },
      conversation: { contact: { name: 'João Lima', phone_number: '+5511988887777' } } },
    { id: 'i3', status: 'won', created_at: 1_790_866_800, contact: { name: 'Paula Reis' } },
  ] },
] as unknown as PipelineStage[];

describe('CSV do funil', () => {
  it('colunas novas: situação e motivo da perda; motivo só no perdido', () => {
    const { csv, linhas } = csvDoFunil(STAGES);
    const [cabecalho, ...resto] = csv.split('\n');
    expect(linhas).toBe(3);
    expect(cabecalho).toBe('nome,email,telefone,etapa,situacao,motivo_da_perda,valor,entrada');
    expect(resto[0]).toBe('"Maria ""Mari"" Souza","maria@exemplo.com.br","+5511999990000","Novo","Aberto","","1500","06/10/2026"');
    expect(resto[1]).toBe('"João Lima","","+5511988887777","Proposta","Perdido","Adiou a compra","","01/10/2026"');
    expect(resto[2]).toBe('"Paula Reis","","","Proposta","Ganho","","","01/10/2026"');
  });

  it('funil vazio: zero linhas', () => {
    expect(csvDoFunil([{ id: 's1', name: 'Novo', items: [] }] as unknown as PipelineStage[]).linhas).toBe(0);
  });
});
