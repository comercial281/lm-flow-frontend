// "Está em dia" (f2-07, 11/10/2026): o imóvel venceu o prazo do Desatualizado
// quando o dia de hoje (São Paulo) chegou ao `stale_due_on` que o servidor manda.

export function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export function vencido(p: { stale_due_on?: string | null }, hoje: string = hojeEmSaoPaulo()): boolean {
  return !!p.stale_due_on && p.stale_due_on <= hoje;
}
