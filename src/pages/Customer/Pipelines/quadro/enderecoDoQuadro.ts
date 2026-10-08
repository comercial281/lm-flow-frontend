// A aba e os filtros do quadro moram no ENDEREÇO (spec funil §4.3): o F5
// mantém, e dá pra mandar o link do funil filtrado. Os links que já existem
// (?card=, ?etapa=) passam intactos. Os nomes dos parâmetros são do contrato do
// plano (índice do funil); `tarefas` (atrasada|hoje|amanha) e `categ` (ids de categoria de tarefa) também é do contrato do índice.
import { situacaoDe } from '@/features/pipelines/situacao/situacao';
import type { PipelineBoardStatus, PipelineItem } from '@/types/analytics';

export type AbaDoQuadro = 'abertos' | 'ganhos' | 'perdidos' | 'todos' | 'arquivados';

export const ABAS_DO_QUADRO: readonly AbaDoQuadro[] = ['abertos', 'ganhos', 'perdidos', 'todos', 'arquivados'];

/** O que cada aba pede ao servidor (`GET /pipelines/:id?status=`). */
export const STATUS_DA_ABA: Record<AbaDoQuadro, PipelineBoardStatus> = {
  abertos: 'open',
  ganhos: 'won',
  perdidos: 'lost',
  todos: 'all',
  arquivados: 'archived',
};

export type TarefaDoFiltro = 'atrasada' | 'hoje' | 'amanha';

export interface FiltrosDoFunil {
  /** Criado em, de/até (AAAA-MM-DD, dia do calendário local). '' = sem limite. */
  de: string;
  ate: string;
  etapas: string[];
  /** `lead_origin.source` (meta_lead_ads, landing…); 'unknown' = sem origem. */
  origens: string[];
  /** id do responsável; SEM_RESPONSAVEL = card sem dono. */
  resp: string[];
  /** Nome da etiqueta. */
  etiq: string[];
  /** id do motivo de perda (só vale em Perdidos e Todos). */
  motivos: string[];
  /** Sem contato há N dias ou mais; null = desligado. */
  largados: number | null;
  /** Etapas VISÍVEIS; vazio = todas. */
  colunas: string[];
  tarefas: TarefaDoFiltro[];
  /** id da opção da categoria da tarefa (`task_categories`); vazio = qualquer. */
  categ: string[];
}

export const FILTROS_VAZIOS: FiltrosDoFunil = {
  de: '', ate: '', etapas: [], origens: [], resp: [], etiq: [], motivos: [], largados: null, colunas: [], tarefas: [], categ: [],
};

export const SEM_RESPONSAVEL = 'nenhum';

const LISTAS = ['etapas', 'origens', 'resp', 'etiq', 'motivos', 'colunas', 'tarefas', 'categ'] as const;
const CHAVES = ['aba', 'de', 'ate', 'largados', ...LISTAS] as const;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const TAREFAS: readonly TarefaDoFiltro[] = ['atrasada', 'hoje', 'amanha'];

export function lerAba(params: URLSearchParams): AbaDoQuadro {
  const aba = params.get('aba');
  return ABAS_DO_QUADRO.includes(aba as AbaDoQuadro) ? (aba as AbaDoQuadro) : 'abertos';
}

export function lerFiltros(params: URLSearchParams): FiltrosDoFunil {
  const dia = (chave: string) => {
    const v = params.get(chave) ?? '';
    return DIA.test(v) ? v : '';
  };
  const lista = (chave: string) => params.getAll(chave).map(v => v.trim()).filter(Boolean);
  const dias = Number.parseInt(params.get('largados') ?? '', 10);
  return {
    de: dia('de'),
    ate: dia('ate'),
    etapas: lista('etapas'),
    origens: lista('origens'),
    resp: lista('resp'),
    etiq: lista('etiq'),
    motivos: lista('motivos'),
    largados: Number.isFinite(dias) && dias > 0 ? dias : null,
    colunas: lista('colunas'),
    tarefas: lista('tarefas').filter((t): t is TarefaDoFiltro => TAREFAS.includes(t as TarefaDoFiltro)),
    categ: lista('categ'),
  };
}

/** Endereço novo com a aba e os filtros; tudo o que não é do quadro fica. */
export function escreverNoEndereco(atual: URLSearchParams, aba: AbaDoQuadro, f: FiltrosDoFunil): URLSearchParams {
  const novo = new URLSearchParams(atual);
  CHAVES.forEach(chave => novo.delete(chave));
  if (aba !== 'abertos') novo.set('aba', aba);
  if (f.de) novo.set('de', f.de);
  if (f.ate) novo.set('ate', f.ate);
  LISTAS.forEach(chave => f[chave].forEach(valor => novo.append(chave, valor)));
  if (f.largados != null) novo.set('largados', String(f.largados));
  return novo;
}

/** O card pertence à aba? (usado ao mudar a situação, arquivar e desarquivar). */
export function pertenceAAba(aba: AbaDoQuadro, item: Pick<PipelineItem, 'status' | 'archived_at'>): boolean {
  const arquivado = Boolean(item.archived_at);
  if (aba === 'arquivados') return arquivado;
  if (arquivado) return false;
  if (aba === 'todos') return true;
  return STATUS_DA_ABA[aba] === situacaoDe(item);
}

/** Ganhos, Perdidos e Arquivados não arrastam; em Todos, só o card aberto. */
export function podeArrastarNaAba(aba: AbaDoQuadro, item: Pick<PipelineItem, 'status' | 'archived_at'>): boolean {
  return (aba === 'abertos' || aba === 'todos') && situacaoDe(item) === 'open' && !item.archived_at;
}
