import { describe, expect, it } from 'vitest';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import { FILTROS_VAZIOS } from './enderecoDoQuadro';
import { contarFiltros, filtrarEtapas, opcoesDeOrigem, opcoesDeResponsavel } from './filtrosDoFunil';

const AGORA = new Date(2026, 9, 7, 9, 0).getTime();
const DIA = 86_400_000;
const seg = (ms: number) => Math.floor(ms / 1000);

const card = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    status: 'open',
    entered_at: seg(new Date(2026, 9, 6, 12, 0).getTime()),
    created_at: seg(new Date(2026, 9, 6, 12, 0).getTime()),
    contact: { id: `c-${id}`, name: `Pessoa ${id}`, email: `${id}@exemplo.com.br`, phone_number: '+5511999990000', labels: [] },
    tasks_info: { pending_count: 0, overdue_count: 0, due_soon_count: 0, completed_count: 0, total_count: 0 },
    ...extra,
  }) as unknown as PipelineItem;

const STAGES = [
  { id: 's1', name: 'Novo', items: [
    card('a', { contact: { id: 'c-a', name: 'Maria Souza', labels: [{ name: 'Meta', color: '#000000' }] }, lead_origin: { source: 'meta_lead_ads' }, assignee: { id: 'u1', name: 'Ana' } }),
    card('b', { entered_at: seg(new Date(2026, 8, 20, 12).getTime()), conversation: { last_activity_at: seg(AGORA - 20 * DIA) } }),
  ] },
  { id: 's2', name: 'Proposta', items: [
    card('c', { status: 'lost', lost_reason: { id: 'm1', label: 'Adiou a compra' }, tasks_info: { overdue_count: 2 } }),
    card('d', { tasks_info: { overdue_count: 0, due_today_count: 1 }, assignee: { id: 'u2', name: 'Bruno' } }),
  ] },
] as unknown as PipelineStage[];

const ids = (stages: PipelineStage[]) => stages.flatMap(s => (s.items || []).map(i => i.id));
const filtrar = (f: Partial<typeof FILTROS_VAZIOS>, busca = '', aba: Parameters<typeof filtrarEtapas>[3] = 'todos') =>
  ids(filtrarEtapas(STAGES, { ...FILTROS_VAZIOS, ...f }, busca, aba, AGORA));

describe('filtros do funil', () => {
  it('sem filtro devolve as etapas como estão', () => {
    expect(filtrarEtapas(STAGES, FILTROS_VAZIOS, '', 'todos', AGORA)).toBe(STAGES);
  });

  it('busca por nome, e-mail ou telefone', () => {
    expect(filtrar({}, 'maria')).toEqual(['a']);
    expect(filtrar({}, 'b@exemplo')).toEqual(['b']);
  });

  it('Criado em: de/até pelo dia do calendário', () => {
    expect(filtrar({ de: '2026-10-01' })).toEqual(['a', 'c', 'd']);
    expect(filtrar({ ate: '2026-09-30' })).toEqual(['b']);
    expect(filtrar({ de: '2026-10-06', ate: '2026-10-06' })).toEqual(['a', 'c', 'd']);
  });

  it('Etapas, Origem, Responsável (com "sem responsável") e Etiquetas', () => {
    expect(filtrar({ etapas: ['s2'] })).toEqual(['c', 'd']);
    expect(filtrar({ origens: ['meta_lead_ads'] })).toEqual(['a']);
    expect(filtrar({ origens: ['unknown'] })).toEqual(['b', 'c', 'd']);
    expect(filtrar({ resp: ['u2'] })).toEqual(['d']);
    expect(filtrar({ resp: ['nenhum'] })).toEqual(['b', 'c']);
    expect(filtrar({ etiq: ['Meta'] })).toEqual(['a']);
  });

  it('Motivo da perda só vale em Perdidos e Todos', () => {
    expect(filtrar({ motivos: ['m1'] }, '', 'todos')).toEqual(['c']);
    expect(filtrar({ motivos: ['m1'] }, '', 'perdidos')).toEqual(['c']);
    expect(filtrar({ motivos: ['m1'] }, '', 'abertos')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('Largados: sem contato há N dias ou mais (quem nunca falou fica de fora)', () => {
    expect(filtrar({ largados: 14 })).toEqual(['b']);
    expect(filtrar({ largados: 30 })).toEqual([]);
  });

  it('Tarefas: atrasada e/ou vence hoje', () => {
    expect(filtrar({ tarefas: ['atrasada'] })).toEqual(['c']);
    expect(filtrar({ tarefas: ['hoje'] })).toEqual(['d']);
    expect(filtrar({ tarefas: ['atrasada', 'hoje'] })).toEqual(['c', 'd']);
  });

  it('Colunas visíveis esconde a etapa inteira', () => {
    const r = filtrarEtapas(STAGES, { ...FILTROS_VAZIOS, colunas: ['s2'] }, '', 'todos', AGORA);
    expect(r.map(s => s.id)).toEqual(['s2']);
  });

  it('conta um por grupo usado; motivo fora de Perdidos/Todos não conta', () => {
    expect(contarFiltros(FILTROS_VAZIOS, 'abertos')).toBe(0);
    expect(contarFiltros({ ...FILTROS_VAZIOS, de: '2026-10-01', ate: '2026-10-31', etapas: ['s1', 's2'], largados: 7 }, 'abertos')).toBe(3);
    expect(contarFiltros({ ...FILTROS_VAZIOS, motivos: ['m1'] }, 'abertos')).toBe(0);
    expect(contarFiltros({ ...FILTROS_VAZIOS, motivos: ['m1'] }, 'perdidos')).toBe(1);
  });

  it('opções de Origem e Responsável saem dos cards carregados', () => {
    expect(opcoesDeOrigem(STAGES)).toEqual([
      { valor: 'meta_lead_ads', rotulo: '📋 Formulário Meta Ads' },
      { valor: 'unknown', rotulo: 'Origem não identificada' },
    ]);
    expect(opcoesDeResponsavel(STAGES)).toEqual([
      { valor: 'u1', rotulo: 'Ana' },
      { valor: 'u2', rotulo: 'Bruno' },
      { valor: 'nenhum', rotulo: 'Sem responsável' },
    ]);
  });
});
