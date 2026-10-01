import type { ScopeInfo, ScopeMode } from './base/types';
import type { Visao } from './catalogo';
import type { FiltrosDashboard, ScopeInfoNova } from './types';

/**
 * A visão sai do recorte que o SERVIDOR resolveu: `mine` desenha a tela do
 * corretor. É por isso que o gestor em "Só os meus" vê exatamente o que o
 * corretor vê, sem uma segunda tela.
 */
export function visaoDoEscopo(scope?: ScopeInfo): Visao {
  return scope?.mode === 'mine' ? 'corretor' : 'gestor';
}

/**
 * Gestor que escolheu "Só os meus". Não basta o recorte vir destravado: num
 * cliente com o isolamento do corretor desligado, o corretor de verdade também
 * vem `mine` sem trava. Por isso o cargo conta: `temCargoDeGestao` é ter
 * `dashboard.team` (Administrador e Gerente; o Corretor não tem).
 */
export function gestorVendoComoCorretor(scope: ScopeInfo | undefined, temCargoDeGestao: boolean): boolean {
  return temCargoDeGestao && scope?.mode === 'mine' && !scope.locked;
}

/**
 * O número só vira link quando a tela de destino, sozinha, mostra o MESMO
 * recorte que a Dashboard contou. Hoje a Agenda, Propostas e o funil não
 * recebem corretor, time, número, etiqueta nem IA pelo link: eles só batem com
 * a imobiliária inteira sem filtro, ou com o corretor travado (o destino já
 * recorta por ele). Fora disso o número fica sem link, para nunca abrir uma
 * lista que contradiz o número (3 na Dashboard, 48 na Agenda).
 *
 * O período e o funil escolhido não contam: o link leva os dois.
 * O conserto de vez é o servidor aceitar `owner_ids` nas telas de destino.
 */
export function recorteBateComDestino(scope: ScopeInfoNova | undefined, filtros: FiltrosDashboard): boolean {
  if (!scope) return false;
  const comFiltro = !!(
    filtros.ownerId || scope.owner_id || filtros.inboxId || filtros.labelId || filtros.aiOnly || filtros.salesAgentId
  );
  if (comFiltro) return false;
  return scope.mode === 'all' || scope.locked;
}

/** A linha que diz de quem são os números, pelo recorte que o servidor aplicou. */
export function deQuemSaoOsNumeros(scope: ScopeInfoNova, nomeDoCorretor?: string): string {
  if (scope.mode === 'mine') return 'Seus números';
  if (scope.owner_id) return nomeDoCorretor || 'Um corretor';
  return scope.mode === 'team' ? 'Meu time' : 'A imobiliária';
}

/**
 * Para onde volta o gestor que está em "Só os meus": a imobiliária, se ele pode
 * vê-la; senão o time dele (o gerente). Sem outro modo, não há volta.
 */
export function modoDeVolta(scope: ScopeInfo | undefined): ScopeMode | null {
  if (scope?.available_modes.includes('all')) return 'all';
  if (scope?.available_modes.includes('team')) return 'team';
  return null;
}

export function rotuloDaVolta(modo: ScopeMode): string {
  return modo === 'all' ? 'Voltar para a imobiliária' : 'Voltar para o meu time';
}
