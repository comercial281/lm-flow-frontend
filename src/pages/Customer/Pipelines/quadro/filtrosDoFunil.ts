// Os filtros do painel (spec funil §4.3). Desde 15/10/2026 rodam no servidor
// (PipelineItems::BoardQuery); aqui ficam as contas da tela.
import { SOURCE_META } from '@/features/leadOrigin/origem';
import type { BoardFacets, PipelineStage } from '@/types/analytics';
import { SEM_RESPONSAVEL, type AbaDoQuadro, type FiltrosDoFunil } from './enderecoDoQuadro';

export interface OpcaoDeFiltro {
  valor: string;
  rotulo: string;
}

/** Motivo da perda só faz sentido onde há card perdido. */
export const motivoNaAba = (aba: AbaDoQuadro) => aba === 'perdidos' || aba === 'todos';

/** Um por grupo usado (de+até contam como um). Motivo fora de Perdidos/Todos não conta. */
export function contarFiltros(f: FiltrosDoFunil, aba: AbaDoQuadro): number {
  return [
    Boolean(f.de || f.ate),
    f.etapas.length > 0,
    f.origens.length > 0,
    f.resp.length > 0,
    f.etiq.length > 0,
    motivoNaAba(aba) && f.motivos.length > 0,
    f.largados != null,
    f.tarefas.length > 0,
    f.categ.length > 0,
    f.colunas.length > 0,
  ].filter(Boolean).length;
}

/** Colunas visíveis (o filtro "Colunas visíveis"); o resto dos filtros é do servidor. */
export function colunasVisiveis(stages: PipelineStage[], colunas: string[]): PipelineStage[] {
  return colunas.length ? stages.filter(s => colunas.includes(String(s.id))) : stages;
}

export function opcoesDeOrigem(origens: string[]): OpcaoDeFiltro[] {
  return [...new Set(origens)]
    .map(valor => ({ valor, rotulo: SOURCE_META[valor]?.label ?? valor }))
    .sort((a, b) => (a.valor === 'unknown' ? 1 : b.valor === 'unknown' ? -1 : a.rotulo.localeCompare(b.rotulo, 'pt-BR')));
}

export function opcoesDeResponsavel(f: BoardFacets): OpcaoDeFiltro[] {
  const lista = f.assignees
    .map(u => ({ valor: String(u.id), rotulo: u.name }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  return f.unassigned ? [...lista, { valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' }] : lista;
}
