// "Está em dia" (f2-07, 11/10/2026): o imóvel venceu o prazo do Desatualizado
// quando o dia de hoje (São Paulo) chegou ao `stale_due_on` que o servidor manda.
import { hojeEmSaoPaulo } from '@/lib/formato';

export { hojeEmSaoPaulo };

export function vencido(p: { stale_due_on?: string | null }, hoje: string = hojeEmSaoPaulo()): boolean {
  return !!p.stale_due_on && p.stale_due_on <= hoje;
}

// Quem pode marcar "Está em dia" naquele imóvel (12/10/2026): o servidor responde
// por imóvel (quem edita imóvel, ou o captador/responsável dele). Resposta de
// servidor antigo, sem o campo: só quem edita imóvel.
export function podeMarcarEmDia(p: { can_confirm_current?: boolean }, podeEditar: boolean): boolean {
  return p.can_confirm_current ?? podeEditar;
}
