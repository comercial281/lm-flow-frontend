import type { LoadFailure } from '@/services/core/forbidden';

// O que o PermissionRoute põe no lugar da rota.
//   loading — permissões ainda chegando (nunca o aviso nem a tela: sem flash)
//   allow   — abre a tela
//   retry   — a LEITURA das permissões falhou (rede, 5xx): "Tentar de novo"
//   deny    — o cargo não tem a permissão (lista lida, ou 403 de verdade)
export type PermissionGate = 'loading' | 'allow' | 'retry' | 'deny';

export interface PermissionGateInput {
  isSuperAdmin: boolean;
  loading: boolean;
  isReady: boolean;
  hasPermission: boolean;
  loadFailure: LoadFailure | null;
}

export function permissionGate({ isSuperAdmin, loading, isReady, hasPermission, loadFailure }: PermissionGateInput): PermissionGate {
  // Suporte não depende das permissões carregarem.
  if (isSuperAdmin) return 'allow';
  if (loading || !isReady) return 'loading';
  if (hasPermission) return 'allow';
  // Só a queda de rede/servidor vira "tentar de novo". 403 e lista vazia lida
  // com sucesso são resposta sobre o cargo: aviso do cargo, como sempre.
  if (loadFailure === 'failed') return 'retry';
  return 'deny';
}
