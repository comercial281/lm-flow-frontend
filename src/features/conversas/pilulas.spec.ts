import { describe, it, expect } from 'vitest';
import type { BaseFilter } from '@/types/core';
import {
  PILULAS,
  filtrosComPilula,
  mostraArquivadas,
  deveAvisarNumero,
} from './pilulas';

const f = (attributeKey: string, values: string, filterOperator = 'equal_to'): BaseFilter => ({
  attributeKey,
  filterOperator,
  values,
  queryOperator: 'and',
  attributeModel: 'standard',
});

const aberta = f('status', 'open');

describe('PILULAS', () => {
  it('tem as quatro pílulas, na ordem da tela', () => {
    expect(PILULAS.map((p) => p.rotulo)).toEqual(['Todas', 'Minhas', 'Sem resposta', 'Arquivadas']);
  });
});

describe('filtrosComPilula', () => {
  it('todas e arquivadas não alteram os filtros do popover', () => {
    const popover = [aberta, f('labels', 'quente')];
    expect(filtrosComPilula(popover, 'todas')).toEqual(popover);
    expect(filtrosComPilula(popover, 'arquivadas')).toEqual(popover);
  });

  it('minhas troca o responsável do popover pelo id de quem está logado', () => {
    const r = filtrosComPilula([aberta, f('assignee_id', '42')], 'minhas', '7');
    expect(r.filter((x) => x.attributeKey === 'assignee_id')).toEqual([f('assignee_id', '7')]);
    expect(r).toContainEqual(aberta);
  });

  it('minhas sem responsável no popover acrescenta o id de quem está logado', () => {
    expect(filtrosComPilula([aberta], 'minhas', '7')).toEqual([aberta, f('assignee_id', '7')]);
    expect(filtrosComPilula([aberta], 'minhas', 'b1c2-uuid')).toEqual([aberta, f('assignee_id', 'b1c2-uuid')]);
  });

  it('minhas sem usuário carregado cai em "me"', () => {
    expect(filtrosComPilula([aberta], 'minhas')).toEqual([aberta, f('assignee_id', 'me')]);
    expect(filtrosComPilula([aberta], 'minhas', null)).toEqual([aberta, f('assignee_id', 'me')]);
  });

  it('sem_resposta acrescenta waiting e mantém as etiquetas', () => {
    const r = filtrosComPilula([aberta, f('labels', 'quente')], 'sem_resposta');
    expect(r).toEqual([aberta, f('labels', 'quente'), f('waiting', 'true')]);
  });

  it('não repete waiting se já estiver no popover', () => {
    const r = filtrosComPilula([f('waiting', 'true')], 'sem_resposta');
    expect(r.filter((x) => x.attributeKey === 'waiting')).toHaveLength(1);
  });

  it('não muda o array recebido', () => {
    const popover = [f('assignee_id', '42')];
    filtrosComPilula(popover, 'minhas');
    expect(popover).toEqual([f('assignee_id', '42')]);
  });
});

describe('mostraArquivadas', () => {
  it('só na pílula arquivadas', () => {
    expect(PILULAS.filter((p) => mostraArquivadas(p.id)).map((p) => p.id)).toEqual(['arquivadas']);
  });
});

describe('deveAvisarNumero', () => {
  const base = { pilula: 'todas' as const, showArchived: false, busca: '', filtros: [aberta] };

  it('avisa só em todas, sem busca e com o filtro padrão', () => {
    expect(deveAvisarNumero(base)).toBe(true);
    expect(deveAvisarNumero({ ...base, filtros: [] })).toBe(true);
  });

  it.each(['minhas', 'sem_resposta', 'arquivadas'] as const)('não avisa na pílula %s', (pilula) => {
    expect(deveAvisarNumero({ ...base, pilula })).toBe(false);
  });

  it('não avisa com busca, arquivadas na tela ou filtro extra', () => {
    expect(deveAvisarNumero({ ...base, busca: 'maria' })).toBe(false);
    expect(deveAvisarNumero({ ...base, showArchived: true })).toBe(false);
    expect(deveAvisarNumero({ ...base, filtros: [aberta, f('labels', 'quente')] })).toBe(false);
  });
});
