// src/pages/Customer/Pipelines/quadro/paramsDoQuadro.ts
// Quadro em lotes (spec 2026-10-15-funil-em-lotes): a aba, a busca e os filtros
// viram parâmetros do servidor (PipelineItems::BoardQuery), e as contas que a
// tela faz com os lotes: o que reler, totais nas ações locais, sem repetir card.
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

/**
 * Recarga por trás: o funil vem com o 1º lote de cada coluna e só as colunas que a
 * pessoa rolou além dele são relidas, cada uma até onde ela foi (teto 200). Reler
 * todas até a mais rolada trazia de volta os ~11 s do funil de 2 mil cards.
 */
export function colunasParaReler(stages: PipelineStage[]): Array<{ stageId: string; limite: number }> {
  return stages.flatMap(s => {
    const carregados = s.items?.length ?? 0;
    return carregados > POR_COLUNA ? [{ stageId: String(s.id), limite: Math.min(TETO_DA_RECARGA, carregados) }] : [];
  });
}

const valorDe = (i: PipelineItem) => Number(i.value) || 0;

/** Soma o valor dos cards de `de` que não estão em `em` (os que saíram ou entraram). */
function valorQueMudou(de: PipelineItem[], em: PipelineItem[]): number {
  const ids = new Set(em.map(i => String(i.id)));
  return de.reduce((soma, i) => (ids.has(String(i.id)) ? soma : soma + valorDe(i)), 0);
}

/**
 * Ação local (arrastar, arquivar, ganhar, remover) mexe nos cards da coluna:
 * o número e o valor da coluna acompanham a diferença. Se quem mexeu já trouxe
 * outro total (o desfazer do arraste), ele vale como veio.
 */
export function ajustarTotais(antes: PipelineStage[], depois: PipelineStage[]): PipelineStage[] {
  // Quem mexeu não mudou nada (devolveu o mesmo array): nada a refazer na tela.
  if (depois === antes) return antes;
  const antigas = new Map(antes.map(s => [String(s.id), s]));
  let ajustou = false;
  const ajustadas = depois.map(s => {
    const a = antigas.get(String(s.id));
    if (!a || s.items === a.items) return s;
    const agora = s.items ?? [];
    const eram = a.items ?? [];
    let nova = s;
    if (s.items_total != null && s.items_total === a.items_total) {
      const diferenca = agora.length - eram.length;
      if (diferenca !== 0) nova = { ...nova, items_total: Math.max(0, s.items_total + diferenca) };
    }
    if (s.value_total != null && s.value_total === a.value_total) {
      const diferenca = valorQueMudou(agora, eram) - valorQueMudou(eram, agora);
      if (diferenca !== 0) nova = { ...nova, value_total: Math.max(0, s.value_total + diferenca) };
    }
    if (nova !== s) ajustou = true;
    return nova;
  });
  return ajustou ? ajustadas : depois;
}

export function juntarSemRepetir(atuais: PipelineItem[], novos: PipelineItem[]): PipelineItem[] {
  const ja = new Set(atuais.map(i => String(i.id)));
  return [...atuais, ...novos.filter(i => !ja.has(String(i.id)))];
}
