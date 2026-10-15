// Filtro "vence hoje / atrasadas" do funil (pedido de um cliente).
// Lê a contagem que o servidor já manda em cada cartão (tasks_info): atrasada
// conta também pendente com prazo vencido, sem esperar a rotina. Desde o funil
// em lotes (15/10/2026) o filtro de Tarefas do quadro (prazo e categoria na mesma
// tarefa) roda no servidor (PipelineItems::BoardQuery).
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
