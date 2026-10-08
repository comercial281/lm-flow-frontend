import { describe, expect, it } from 'vitest';
import type { PipelineItem } from '@/types/analytics';
import {
  FILTROS_VAZIOS, escreverNoEndereco, lerAba, lerFiltros, pertenceAAba, podeArrastarNaAba,
} from './enderecoDoQuadro';

const p = (s: string) => new URLSearchParams(s);
const item = (extra: Partial<PipelineItem>) => ({ id: 'i1', ...extra }) as PipelineItem;

describe('endereço do quadro', () => {
  it('aba: Abertos é a padrão; valor estranho também cai nela', () => {
    expect(lerAba(p(''))).toBe('abertos');
    expect(lerAba(p('aba=perdidos'))).toBe('perdidos');
    expect(lerAba(p('aba=lixo'))).toBe('abertos');
  });

  it('lê os filtros (listas repetidas, datas e dias válidos)', () => {
    const f = lerFiltros(p('de=2026-10-01&ate=2026-10-31&etapas=s1&etapas=s2&etiq=Tráfego%20pago&etiq=Meta&resp=nenhum&largados=14&tarefas=atrasada&tarefas=xyz&colunas=s2'));
    expect(f).toEqual({
      ...FILTROS_VAZIOS,
      de: '2026-10-01', ate: '2026-10-31', etapas: ['s1', 's2'], etiq: ['Tráfego pago', 'Meta'],
      resp: ['nenhum'], largados: 14, tarefas: ['atrasada'], colunas: ['s2'],
    });
    expect(lerFiltros(p('de=ontem&largados=-3')).de).toBe('');
    expect(lerFiltros(p('largados=0')).largados).toBeNull();
  });

  it('escrever mantém card, etapa e o que mais houver; Abertos e filtro vazio não aparecem', () => {
    const n = escreverNoEndereco(p('card=i9&etapa=s2&aba=ganhos&etiq=Velha'), 'abertos', { ...FILTROS_VAZIOS, etiq: ['Meta'], largados: 7 });
    expect(n.get('card')).toBe('i9');
    expect(n.get('etapa')).toBe('s2');
    expect(n.has('aba')).toBe(false);
    expect(n.getAll('etiq')).toEqual(['Meta']);
    expect(n.get('largados')).toBe('7');
    expect(n.has('de')).toBe(false);
    expect(escreverNoEndereco(p(''), 'arquivados', FILTROS_VAZIOS).toString()).toBe('aba=arquivados');
  });

  it('ler(escrever(x)) devolve x', () => {
    const f = { ...FILTROS_VAZIOS, de: '2026-10-01', origens: ['meta_lead_ads'], motivos: ['m1', 'm2'], tarefas: ['hoje' as const] };
    expect(lerFiltros(escreverNoEndereco(p(''), 'perdidos', f))).toEqual(f);
  });

  it('cada aba tem os seus cards; arquivado só em Arquivados', () => {
    const aberto = item({ status: 'open' });
    const ganho = item({ status: 'won' });
    const arquivado = item({ status: 'lost', archived_at: '2026-10-07T10:00:00Z' });
    expect(pertenceAAba('abertos', aberto)).toBe(true);
    expect(pertenceAAba('abertos', ganho)).toBe(false);
    expect(pertenceAAba('ganhos', ganho)).toBe(true);
    expect(pertenceAAba('todos', ganho)).toBe(true);
    expect(pertenceAAba('perdidos', arquivado)).toBe(false);
    expect(pertenceAAba('todos', arquivado)).toBe(false);
    expect(pertenceAAba('arquivados', arquivado)).toBe(true);
    expect(pertenceAAba('arquivados', aberto)).toBe(false);
  });

  // Review Focus 1: Ganhos e Perdidos não arrastam; em Todos, só o aberto.
  it('só arrasta card aberto, em Abertos ou Todos', () => {
    expect(podeArrastarNaAba('abertos', item({ status: 'open' }))).toBe(true);
    expect(podeArrastarNaAba('todos', item({ status: 'open' }))).toBe(true);
    expect(podeArrastarNaAba('todos', item({ status: 'won' }))).toBe(false);
    expect(podeArrastarNaAba('ganhos', item({ status: 'won' }))).toBe(false);
    expect(podeArrastarNaAba('perdidos', item({ status: 'lost' }))).toBe(false);
    expect(podeArrastarNaAba('arquivados', item({ status: 'open', archived_at: '2026-10-07T10:00:00Z' }))).toBe(false);
  });
});
