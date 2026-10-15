// src/pages/Customer/Pipelines/quadro/paramsDoQuadro.ts
// Quadro em lotes (spec 2026-10-15-funil-em-lotes): a aba, a busca e os filtros
// viram parâmetros do servidor (PipelineItems::BoardQuery), e as contas que a
// tela faz com os lotes: até onde reler, totais nas ações locais, sem repetir card.
import type { BoardQueryParams, PipelineItem, PipelineStage } from '@/types/analytics';
import { STATUS_DA_ABA, type AbaDoQuadro, type FiltrosDoFunil } from './enderecoDoQuadro';
import { motivoNaAba } from './filtrosDoFunil';

export const POR_COLUNA = 30;
export const TETO_DA_RECARGA = 200;

export function paramsDoQuadro(aba: AbaDoQuadro, f: FiltrosDoFunil, busca: string): BoardQueryParams {
  const p: BoardQueryParams = { status: STATUS_DA_ABA[aba] };
  const q = busca.trim();
  if (q) p.q = q;
  if (f.de) p.de = f.de;
  if (f.ate) p.ate = f.ate;
  if (f.largados != null) p.largados = String(f.largados);
  const listas: Array<[string, string[]]> = [
    ['etapas', f.etapas], ['colunas', f.colunas], ['origens', f.origens], ['resp', f.resp],
    ['etiq', f.etiq], ['tarefas', f.tarefas], ['categ', f.categ],
  ];
  for (const [chave, valores] of listas) if (valores.length) p[chave] = valores;
  if (motivoNaAba(aba) && f.motivos.length) p.motivos = f.motivos;
  return p;
}

/** Igualdade de pedidos: muda quando a aba, a busca ou um filtro muda. */
export function assinaturaDoQuadro(p: BoardQueryParams): string {
  return JSON.stringify(Object.keys(p).sort().map(k => [k, p[k]]));
}

/** Abertos sem busca nem filtro: o único pedido que passa pelo payload guardado. */
export function semFiltroNaAberta(p: BoardQueryParams): boolean {
  return p.status === 'open' && Object.keys(p).length === 1;
}

/** Recarga por trás relê até onde a pessoa já rolou (teto 200), pra não sumir card. */
export function limiteDaRecarga(stages: PipelineStage[]): number {
  const maior = Math.max(0, ...stages.map(s => s.items?.length ?? 0));
  return Math.min(TETO_DA_RECARGA, Math.max(POR_COLUNA, maior));
}

/**
 * Ação local (arrastar, arquivar, ganhar, remover) mexe nos cards da coluna:
 * o total acompanha a diferença. Se quem mexeu já trouxe outro total (o
 * desfazer do arraste), ele vale como veio.
 */
export function ajustarTotais(antes: PipelineStage[], depois: PipelineStage[]): PipelineStage[] {
  // Quem mexeu não mudou nada (devolveu o mesmo array): nada a refazer na tela.
  if (depois === antes) return antes;
  const antigas = new Map(antes.map(s => [String(s.id), s]));
  let ajustou = false;
  const ajustadas = depois.map(s => {
    const a = antigas.get(String(s.id));
    if (!a || s.items_total == null || s.items_total !== a.items_total) return s;
    const diferenca = (s.items?.length ?? 0) - (a.items?.length ?? 0);
    if (diferenca === 0) return s;
    ajustou = true;
    return { ...s, items_total: Math.max(0, s.items_total + diferenca) };
  });
  return ajustou ? ajustadas : depois;
}

export function juntarSemRepetir(atuais: PipelineItem[], novos: PipelineItem[]): PipelineItem[] {
  const ja = new Set(atuais.map(i => String(i.id)));
  return [...atuais, ...novos.filter(i => !ja.has(String(i.id)))];
}
