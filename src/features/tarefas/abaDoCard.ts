import { TEXTOS_DE_TAREFAS as T } from './textos';

// Rótulo e bolinha da aba Tarefas no card do lead.
// `pending_count` conta só pendente e `overdue_count` conta atrasada OU pendente vencida,
// então uma pendente vencida entra nos dois: antes de abrir a aba usamos o maior dos dois
// (aproximação, sem contar duas vezes); depois de abrir vale a conta exata do bloco.
export function rotuloDaAbaTarefas(
  resumo: { abertas: number; atrasadas: number } | null,
  info?: { pending_count?: number; overdue_count?: number } | null,
): { rotulo: string; marcador: boolean } {
  const abertas = resumo ? resumo.abertas : Math.max(info?.pending_count ?? 0, info?.overdue_count ?? 0);
  const atrasadas = resumo ? resumo.atrasadas : info?.overdue_count ?? 0;
  return { rotulo: abertas > 0 ? `${T.titulo} (${abertas})` : T.titulo, marcador: atrasadas > 0 };
}
