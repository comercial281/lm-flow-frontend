// Os filtros do painel lateral (spec funil §4.3), aplicados no navegador sobre
// os cards da aba carregada. Regras puras.
import { SOURCE_META } from '@/features/leadOrigin/origem';
import { contatoDoCard } from '@/features/cardDoLead/cardDoLead';
import { passaNoFiltroDeTarefasDoFunil, type FiltroDeTarefas } from '@/features/tarefas/filtroDoFunil';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import { itemArrivalMs, itemTagNames, lastContactMs } from '../pipelineItemHelpers';
import { SEM_RESPONSAVEL, type AbaDoQuadro, type FiltrosDoFunil, type TarefaDoFiltro } from './enderecoDoQuadro';

export interface OpcaoDeFiltro {
  valor: string;
  rotulo: string;
}

const DIA_MS = 86_400_000;

// O endereço fala `atrasada`; a regra da sessão de Tarefas fala `atrasadas`.
const FILTRO_DA_TAREFA: Record<TarefaDoFiltro, FiltroDeTarefas> = { atrasada: 'atrasadas', hoje: 'hoje', amanha: 'amanha' };

export const origemDoItem = (item: PipelineItem): string => {
  const source = item.lead_origin?.source;
  return typeof source === 'string' && source ? source : 'unknown';
};

export const responsavelDoItem = (item: PipelineItem) => item.assignee ?? item.conversation?.assignee ?? null;

/** Motivo da perda só faz sentido onde há card perdido. */
export const motivoNaAba = (aba: AbaDoQuadro) => aba === 'perdidos' || aba === 'todos';

// "2026-10-06" é dia do calendário LOCAL (meia-noite em São Paulo, não em UTC).
const limiteDoDia = (dia: string, fim: boolean): number | null => {
  if (!dia) return null;
  const [ano, mes, d] = dia.split('-').map(Number);
  return fim ? new Date(ano, mes - 1, d, 23, 59, 59, 999).getTime() : new Date(ano, mes - 1, d).getTime();
};

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

export function filtrarEtapas(
  stages: PipelineStage[],
  f: FiltrosDoFunil,
  busca: string,
  aba: AbaDoQuadro,
  agora: number = Date.now(),
): PipelineStage[] {
  const visiveis = f.colunas.length ? stages.filter(s => f.colunas.includes(String(s.id))) : stages;
  const q = busca.trim().toLowerCase();
  const desde = limiteDoDia(f.de, false);
  const ate = limiteDoDia(f.ate, true);
  const motivos = motivoNaAba(aba) ? f.motivos : [];
  const semFiltro =
    !q && desde == null && ate == null && !f.etapas.length && !f.origens.length && !f.resp.length &&
    !f.etiq.length && !motivos.length && f.largados == null && !f.tarefas.length && !f.categ.length;
  if (semFiltro) return visiveis;

  const passa = (item: PipelineItem, stageId: string): boolean => {
    if (q) {
      const c = contatoDoCard(item);
      if (![c?.name, c?.email, c?.phone_number].some(v => (v || '').toLowerCase().includes(q))) return false;
    }
    const chegou = itemArrivalMs(item);
    if (desde != null && chegou < desde) return false;
    if (ate != null && chegou > ate) return false;
    if (f.etapas.length && !f.etapas.includes(stageId)) return false;
    if (f.origens.length && !f.origens.includes(origemDoItem(item))) return false;
    if (f.resp.length) {
      const dono = responsavelDoItem(item);
      if (!f.resp.includes(dono ? String(dono.id) : SEM_RESPONSAVEL)) return false;
    }
    if (f.etiq.length) {
      const nomes = itemTagNames(item);
      if (!f.etiq.some(e => nomes.includes(e))) return false;
    }
    if (motivos.length && !(item.lost_reason && motivos.includes(String(item.lost_reason.id)))) return false;
    if (f.largados != null) {
      const ms = lastContactMs(item);
      if (ms == null || Math.floor((agora - ms) / DIA_MS) < f.largados) return false;
    }
    // Prazo e categoria valem para a MESMA tarefa aberta.
    if (!passaNoFiltroDeTarefasDoFunil(item, f.tarefas.map(t => FILTRO_DA_TAREFA[t]), f.categ, agora)) return false;
    return true;
  };

  return visiveis.map(stage => ({ ...stage, items: (stage.items || []).filter(item => passa(item, String(stage.id))) }));
}

export function opcoesDeOrigem(stages: PipelineStage[]): OpcaoDeFiltro[] {
  const vistas = new Set<string>();
  stages.forEach(s => (s.items || []).forEach(i => vistas.add(origemDoItem(i))));
  return [...vistas]
    .map(valor => ({ valor, rotulo: SOURCE_META[valor]?.label ?? valor }))
    .sort((a, b) => (a.valor === 'unknown' ? 1 : b.valor === 'unknown' ? -1 : a.rotulo.localeCompare(b.rotulo, 'pt-BR')));
}

export function opcoesDeResponsavel(stages: PipelineStage[]): OpcaoDeFiltro[] {
  const donos = new Map<string, string>();
  let temSemDono = false;
  stages.forEach(s =>
    (s.items || []).forEach(i => {
      const dono = responsavelDoItem(i);
      if (dono) donos.set(String(dono.id), dono.name);
      else temSemDono = true;
    }),
  );
  const lista = [...donos].map(([valor, rotulo]) => ({ valor, rotulo })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  return temSemDono ? [...lista, { valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' }] : lista;
}
