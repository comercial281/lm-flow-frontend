/**
 * "Aceita mais de uma visita no mesmo horário" (frente 4 de Visitas, 10/10/2026).
 * Nulo = ninguém mexeu: segue o tipo (empreendimento aceita, revenda não). Mesma
 * regra do servidor (Property#accepts_concurrent_visits?), que é quem trava.
 */
export const VISITAS_JUNTAS_LABEL = 'Aceita mais de uma visita no mesmo horário';
export const VISITAS_JUNTAS_HELP = 'Ligue quando vários corretores recebem visitas ao mesmo tempo, como num estande.';

export function aceitaVisitasJuntas(f: { accepts_concurrent_visits?: boolean | null; listing_kind?: string | null }): boolean {
  return f.accepts_concurrent_visits ?? f.listing_kind === 'development';
}
