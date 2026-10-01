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

/** Gestor que escolheu "Só os meus" (o corretor de verdade vem travado). */
export function gestorVendoComoCorretor(scope?: ScopeInfo): boolean {
  return scope?.mode === 'mine' && !scope.locked;
}
