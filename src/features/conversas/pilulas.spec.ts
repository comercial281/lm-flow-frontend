import { describe, it, expect } from 'vitest';
import type { BaseFilter } from '@/types/core';
import {
  PILULAS,
  filtrosComPilula,
  semFiltrosDaPilula,
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

  it('minhas troca o responsável do popover por "me"', () => {
    const r = filtrosComPilula([aberta, f('assignee_id', '42')], 'minhas');
    expect(r.filter((x) => x.attributeKey === 'assignee_id')).toEqual([f('assignee_id', 'me')]);
    expect(r).toContainEqual(aberta);
  });

  it('minhas sem responsável no popover acrescenta "me"', () => {
    expect(filtrosComPilula([aberta], 'minhas')).toEqual([aberta, f('assignee_id', 'me')]);
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

describe('semFiltrosDaPilula', () => {
  it('tira waiting e, em minhas, o responsável "me"', () => {
    expect(semFiltrosDaPilula([aberta, f('waiting', 'true')], 'sem_resposta')).toEqual([aberta]);
    expect(semFiltrosDaPilula([aberta, f('assignee_id', 'me')], 'minhas')).toEqual([aberta]);
  });

  it('em todas deixa o responsável escolhido no popover', () => {
    const popover = [aberta, f('assignee_id', 'me')];
    expect(semFiltrosDaPilula(popover, 'todas')).toEqual(popover);
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
