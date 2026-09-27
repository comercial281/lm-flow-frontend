import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import NoAccessState from '@/components/permissions/NoAccessState';
import PermissionsRetryState from '@/components/permissions/PermissionsRetryState';
import { permissionGate } from './permissionGate';

interface PermissionRouteProps {
  children: React.ReactNode;
  resource?: string;
  action?: string;
  permissions?: string[]; // Array de permissões alternativo
  requireAll?: boolean; // Se true, requer todas as permissões
  redirectTo?: string; // Rota para redirecionar se não tiver permissão. Sem
                        // valor, mostra o aviso do cargo no lugar da tela.
  fallback?: React.ReactNode; // Componente alternativo
}

/**
 * Componente que protege rotas baseado em permissões específicas
 * Deve ser usado dentro da definição de rotas do React Router
 *
 * Exemplos de uso:
 *
 * // Rota que precisa de permissão específica
 * <PermissionRoute resource="users" action="read">
 *   <UsersPage />
 * </PermissionRoute>
 *
 * // Rota com múltiplas permissões
 * <PermissionRoute permissions={['users.read', 'teams.read']} requireAll={false}>
 *   <DashboardPage />
 * </PermissionRoute>
 *
 * Sem `redirectTo`, a recusa mostra o aviso do cargo (NoAccessState) NO LUGAR
 * da tela — spec da Fase 1 (Cargos): endereço digitado sem permissão nunca cai
 * na página genérica de "unauthorized". Só quem passar `redirectTo`
 * explicitamente continua sendo redirecionado.
 *
 * Leitura das permissões que CAIU (rede, 5xx — `loadFailure === 'failed'`)
 * não é recusa do cargo: no lugar do aviso vai "Não consegui carregar as
 * permissões." + *Tentar de novo* (refaz a leitura). Vale também para quem
 * passou `redirectTo`/`fallback`: redirecionar para "sem acesso" por queda de
 * rede seria o mesmo erro. A decisão mora em `permissionGate` (com spec).
 */
const PermissionRoute: React.FC<PermissionRouteProps> = ({
  children,
  resource,
  action,
  permissions,
  requireAll = false,
  redirectTo,
  fallback = null,
}) => {
  const navigate = useNavigate();
  const { can, canAny, canAll, isReady, loading, loadFailure, refreshPermissions } = usePermissions();
  const isSuperAdmin = useIsSuperAdmin();

  // Memoizar verificações de permissão para evitar recálculos desnecessários
  const permissionCheck = useMemo(() => {
    // O super-admin (comercial@lealmidia.com.br) vê e opera TODAS as funções,
    // incluindo as páginas de configuração de integrações (installation_configs).
    // Ele é injetado como super-admin em todo tenant e o backend segue guardando
    // cada mutação; aqui só liberamos a navegação. Não depende de permissões
    // carregarem, então isenta antes do gate de loading (ver permissionGate).
    const settled = !isSuperAdmin && !loading && isReady;

    // Verificar permissões específicas (só quando já dá para perguntar)
    let hasPermission = false;
    if (settled) {
      if (permissions && permissions.length > 0) {
        // Usar array de permissões
        hasPermission = requireAll ? canAll(permissions) : canAny(permissions);
      } else if (resource && action) {
        // Usar resource.action
        hasPermission = can(resource, action);
      } else {
        // Se não há permissões específicas, permitir acesso para usuários autenticados
        hasPermission = true;
      }
    }

    const gate = permissionGate({ isSuperAdmin, loading, isReady, hasPermission, loadFailure: loadFailure ?? null });

    return {
      gate,
      // Só redireciona quem passou `redirectTo` explicitamente — sem ele, a
      // recusa cai no NoAccessState renderizado abaixo, nunca na página
      // genérica de unauthorized.
      shouldRedirect: gate === 'deny' && !fallback && !!redirectTo,
    };
  }, [can, canAny, canAll, permissions, requireAll, resource, action, fallback, redirectTo, loading, isReady, isSuperAdmin, loadFailure]);

  // Usar useEffect para navegação para evitar chamadas durante render
  useEffect(() => {
    if (permissionCheck.shouldRedirect && redirectTo) {
      navigate(redirectTo, { replace: true });
    }
  }, [permissionCheck.shouldRedirect, navigate, redirectTo]);

  // Mostrar loading enquanto carrega permissões
  if (permissionCheck.gate === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // A leitura das permissões caiu: tentar de novo, nunca o aviso do cargo.
  if (permissionCheck.gate === 'retry') {
    return <PermissionsRetryState onRetry={() => { void refreshPermissions?.(); }} />;
  }

  // Renderização baseada nas verificações
  if (permissionCheck.gate === 'deny') {
    if (fallback) {
      return <>{fallback}</>;
    }
    // Se deve redirecionar, não renderizar nada enquanto navega
    if (permissionCheck.shouldRedirect) {
      return null;
    }
    // Sem fallback e sem redirectTo: o aviso do cargo ocupa o lugar da tela.
    return <NoAccessState />;
  }

  // Usuário tem permissão, renderizar conteúdo
  return <>{children}</>;
};

export default PermissionRoute;
