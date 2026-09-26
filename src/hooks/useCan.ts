import { useCallback, useContext } from 'react';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';

/**
 * `can(resource, action)` para esconder ação dentro da tela.
 * Suporte vê tudo. Sem provider (spec de tela isolada) não esconde nada:
 * quem decide de verdade é o servidor, e a tela não pode quebrar por isso.
 */
export function useCan(): (resource: string, action: string) => boolean {
  const ctx = useContext(PermissionsContext);
  const isSupport = useIsSuperAdmin();
  return useCallback(
    (resource: string, action: string) => {
      if (isSupport) return true;
      if (!ctx) return true;
      return ctx.can(resource, action);
    },
    [ctx, isSupport],
  );
}
