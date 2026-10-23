// Texto dos leads pausados porque já conversam em outro número (Entrega 4).

/** "3 leads pausados: já conversam em outro número" (1 → singular). */
export function textoDePausados(n: number): string {
  return n === 1
    ? '1 lead pausado: já conversa em outro número'
    : `${n} leads pausados: já conversam em outro número`;
}
