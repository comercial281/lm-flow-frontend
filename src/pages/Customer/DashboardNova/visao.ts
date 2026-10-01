import type { ScopeInfo } from '../DashboardV2/types';
import type { Visao } from './catalogo';

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
