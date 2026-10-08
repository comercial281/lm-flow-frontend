// Filtro "vence hoje / atrasadas" do funil (pedido da Natália, Nova 27).
// Lê a contagem que o servidor já manda em cada cartão (tasks_info): atrasada
// conta também pendente com prazo vencido, sem esperar a rotina.
export type FiltroDeTarefas = 'nenhum' | 'hoje' | 'atrasadas';

export const ROTULOS_DO_FILTRO_DE_TAREFAS: Record<FiltroDeTarefas, string> = {
  nenhum: 'Todas',
  hoje: 'Vence hoje',
  atrasadas: 'Atrasadas',
};

export function passaNoFiltroDeTarefas(
  item: { tasks_info?: { overdue_count?: number; due_today_count?: number } | null },
  filtro: FiltroDeTarefas,
): boolean {
  if (filtro === 'nenhum') return true;
  const info = item.tasks_info;
  if (!info) return false;
  return filtro === 'hoje' ? (info.due_today_count ?? 0) > 0 : (info.overdue_count ?? 0) > 0;
}
