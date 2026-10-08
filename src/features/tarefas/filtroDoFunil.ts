// Filtro "vence hoje / atrasadas" do funil (pedido de um cliente).
// Lê a contagem que o servidor já manda em cada cartão (tasks_info): atrasada
// conta também pendente com prazo vencido, sem esperar a rotina.
export type FiltroDeTarefas = 'nenhum' | 'hoje' | 'amanha' | 'atrasadas';

export const ROTULOS_DO_FILTRO_DE_TAREFAS: Record<FiltroDeTarefas, string> = {
  nenhum: 'Todas',
  hoje: 'Vence hoje',
  amanha: 'Vence amanhã',
  atrasadas: 'Atrasadas',
};

export function passaNoFiltroDeTarefas(
  item: { tasks_info?: { overdue_count?: number; due_today_count?: number; due_tomorrow_count?: number } | null },
  filtro: FiltroDeTarefas,
): boolean {
  if (filtro === 'nenhum') return true;
  const info = item.tasks_info;
  if (!info) return false;
  if (filtro === 'hoje') return (info.due_today_count ?? 0) > 0;
  if (filtro === 'amanha') return (info.due_tomorrow_count ?? 0) > 0;
  return (info.overdue_count ?? 0) > 0;
}

type TarefaAberta = { category_option_id: string | null; due_at: string | null };
type CartaoComTarefas = {
  tasks_info?: {
    overdue_count?: number;
    due_today_count?: number;
    due_tomorrow_count?: number;
    open_tasks?: TarefaAberta[];
  } | null;
};

const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function prazoDaTarefa(due_at: string | null, agora: number): FiltroDeTarefas[] {
  const prazo = due_at ? new Date(due_at).getTime() : NaN;
  if (Number.isNaN(prazo)) return [];
  const d = new Date(agora);
  const hoje = meiaNoite(d);
  const amanha = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  const dia = meiaNoite(new Date(prazo));
  const achados: FiltroDeTarefas[] = [];
  if (prazo < agora) achados.push('atrasadas');
  if (dia === hoje) achados.push('hoje');
  // O dia seguinte pelo calendário (não "+24h"), pra não errar na virada de horário.
  if (dia === amanha) achados.push('amanha');
  return achados;
}

/**
 * Prazo E categoria na MESMA tarefa aberta: o cartão passa se alguma tarefa
 * aberta cumpre os dois (vazio = qualquer). Dia calculado no horário de quem usa.
 * Servidor antigo (sem `open_tasks`): cai nas contagens do cartão e deixa a
 * categoria passar, pra tela não quebrar se for ao ar antes do servidor.
 */
export function passaNoFiltroDeTarefasDoFunil(
  item: CartaoComTarefas,
  prazos: FiltroDeTarefas[],
  categorias: string[],
  agora: number = Date.now(),
): boolean {
  if (prazos.length === 0 && categorias.length === 0) return true;
  const abertas = item.tasks_info?.open_tasks;
  if (!abertas) {
    return prazos.length === 0 || prazos.some(p => passaNoFiltroDeTarefas(item, p));
  }
  return abertas.some(t => {
    if (categorias.length && !(t.category_option_id && categorias.includes(t.category_option_id))) return false;
    if (prazos.length === 0) return true;
    const dela = prazoDaTarefa(t.due_at, agora);
    return prazos.some(p => dela.includes(p));
  });
}
