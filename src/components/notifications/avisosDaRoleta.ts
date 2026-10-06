// Os avisos da roleta que, desde a roleta nova (06/10/2026, D7), deixam de
// ser configurados na Central de Notificações: eles passam a sair pela porta única
// da roleta (Roleta::Notices no servidor), configurados uma vez na aba Avisos da
// página "Roleta de leads". Mostrar a chave aqui seria a tela mentindo: ligar ou
// desligar nesta lista não mudaria nada.
//
// Fica na lista o "Roleta falhou" (sorteio sem ninguém / lead sem dono no card):
// ele é alerta de operação, não um dos avisos da página da roleta.
import type { CatalogEvent, ResolvedPolicy } from '@/services/notifications/notificationPolicyService';

export const AVISOS_DA_ROLETA_NA_PAGINA = [
  'roleta.oferta_recebida', // lead novo esperando o aceite (corretor)
  'roleta.lead_distribuido', // lead novo na roleta (gestor / grupo)
  'roleta.nao_assumiu', // passou do prazo, foi pro próximo (repasse)
  'roleta.aceito', // corretor aceitou (gestor)
  'roleta.resumo_plantao', // resumo da manhã (gestor)
] as const;

/** Onde os avisos da roleta vivem (aba Avisos da página). */
export const ENDERECO_AVISOS_DA_ROLETA = '/automations/roleta-config?aba=avisos';

const daPagina = new Set<string>(AVISOS_DA_ROLETA_NA_PAGINA);

export function semAvisosDaRoleta<T extends { events: CatalogEvent[] }>(catalogo: T): T {
  return { ...catalogo, events: catalogo.events.filter(e => !daPagina.has(e.key)) };
}

export function politicaSemAvisosDaRoleta(politica: ResolvedPolicy): ResolvedPolicy {
  return Object.fromEntries(Object.entries(politica).filter(([chave]) => !daPagina.has(chave)));
}
