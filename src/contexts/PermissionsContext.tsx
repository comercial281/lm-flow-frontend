import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useAuthStore } from '@/store/authStore';
import { permissionsService } from '@/services/permissions';
import type { ResourceActionsResponse } from '@/types/auth';

interface PermissionsContextValue {
  // Permissões
  userPermissions: string[];
  accountPermissions: string[];

  // Métodos de verificação
  can: (resource: string, action: string, type?: 'account' | 'user') => boolean;
  canAny: (permissions: string[], type?: 'account' | 'user') => boolean;
  canAll: (permissions: string[], type?: 'account' | 'user') => boolean;

  // Estado
  loading: boolean;
  isReady: boolean;
  error: string | null;

  // Métodos utilitários
  refreshPermissions: () => Promise<void>;
  createPermission: (resource: string, action: string) => string;
  isValidPermission: (permission: string) => boolean;
  getPermissionDisplayName: (permission: string) => string;
}

export const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

interface PermissionsProviderProps {
  children: React.ReactNode;
}

export const PermissionsProvider: React.FC<PermissionsProviderProps> = ({ children }) => {
  const { user } = useAuth();

  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [accountPermissions, setAccountPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks whether the permission fetches have completed for the current user.
  // Starts false so we never report `isReady` true with empty permissions during
  // the brief render between user appearing and the fetch effect running — that
  // window used to flash the Unauthorized page after a fresh login.
  const [userPermsLoaded, setUserPermsLoaded] = useState(false);
  const [accountPermsLoaded, setAccountPermsLoaded] = useState(false);

  // Config state
  const [resourceActions, setResourceActions] = useState<ResourceActionsResponse | null>(null);
  const [configLoading, setConfigLoading] = useState(false);

  // Fix round 1 (I1) — janela de 1 render: um useEffect só reage DEPOIS do
  // commit. Entre o render em que `user` já é a pessoa B e o momento em que
  // o efeito de reset roda, existiria uma passada inteira em que a tela
  // computaria `isReady`/`can()` com `user` = B mas as LISTAS ainda sendo as
  // de A (o corretor "veria", por um instante, o menu do gestor). Por isso o
  // reset acontece aqui, no CORPO do render — o padrão oficial de "ajustar
  // estado durante a renderização": ao chamar os setters agora, o React
  // descarta o cálculo deste render e recomeça do zero com o estado já
  // resetado, ANTES de o commit acontecer. Nenhum navegador chega a pintar
  // (nem um teste chega a "ver") a mistura de A com B.
  const [loadedForId, setLoadedForId] = useState(user?.id);
  if (loadedForId !== user?.id) {
    setLoadedForId(user?.id);
    setUserPermissions([]);
    setAccountPermissions([]);
    setResourceActions(null);
    setUserPermsLoaded(false);
    setAccountPermsLoaded(false);
  }

  // O singleton do serviço É um efeito colateral de verdade (mutação de um
  // objeto externo) — isso não pode rodar durante o render (que precisa
  // continuar puro), então ele fica no único lugar que ainda é um useEffect.
  useEffect(() => {
    permissionsService.clearCache();
  }, [user?.id]);

  // Load permissions config (metadata)
  useEffect(() => {
    if (!user?.id) return;

    // Fix round 1 (I2) — resposta atrasada: se a pessoa mudar de novo antes
    // desta promessa terminar, a limpeza abaixo marca `cancelled` e o
    // resultado tardio desta chamada (que já não é mais sobre quem está
    // logado agora) é descartado em vez de sobrescrever o estado da pessoa
    // NOVA.
    let cancelled = false;

    const loadConfig = async () => {
      const isAuthenticated = useAuthStore.getState().isLoggedIn;
      if (!isAuthenticated) return;

      try {
        setConfigLoading(true);
        const config = await permissionsService.getResourceActions();
        if (cancelled) return;
        setResourceActions(config);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading permissions config:', err);
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    };

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Load user permissions
  useEffect(() => {
    if (!user?.id) {
      setUserPermissions([]);
      setUserPermsLoaded(true);
      return;
    }

    // Fix round 1 (I2): mesma trava de cancelamento — ver o comentário do
    // efeito de config acima.
    let cancelled = false;

    const loadUserPermissions = async () => {
      try {
        const isAuthenticated = useAuthStore.getState().isLoggedIn;
        if (!isAuthenticated) {
          if (!cancelled) setUserPermissions([]);
          return;
        }

        setLoading(true);
        setError(null);
        const permissions = await permissionsService.getUserPermissions();
        if (cancelled) return;
        setUserPermissions(permissions);
      } catch (error) {
        if (cancelled) return;
        console.error('Erro ao carregar permissões do usuário:', error);
        setError('Erro ao carregar permissões do usuário');
        setUserPermissions([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setUserPermsLoaded(true);
        }
      }
    };

    loadUserPermissions();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Load account permissions (específicas do account baseadas no AccountUser role)
  useEffect(() => {
    // Verificar autenticação primeiro - precisa ter user também
    const isAuthenticated = useAuthStore.getState().isLoggedIn;
    if (!isAuthenticated || !user?.id) {
      setAccountPermissions([]);
      setAccountPermsLoaded(true);
      return;
    }

    // Fix round 1 (I2): mesma trava de cancelamento — ver o comentário do
    // efeito de config acima.
    let cancelled = false;

    const loadAccountPermissions = async () => {
      try {
        const isAuthenticated = useAuthStore.getState().isLoggedIn;

        if (!isAuthenticated) {
          if (!cancelled) setAccountPermissions([]);
          return;
        }

        setLoading(true);
        setError(null);
        const permissions = await permissionsService.getAccountPermissions();
        if (cancelled) return;

        setAccountPermissions(permissions);
      } catch (error) {
        if (cancelled) return;
        console.error('Erro ao carregar permissões do account:', error);
        setError('Erro ao carregar permissões do account');
        setAccountPermissions([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setAccountPermsLoaded(true);
        }
      }
    };

    loadAccountPermissions();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const createPermission = useCallback((resource: string, action: string): string => {
    return `${resource}.${action}`;
  }, []);

  const isValidPermission = useCallback(
    (permission: string): boolean => {
      if (!resourceActions) return true; // Se não tiver config, aceita
      return resourceActions.data?.all_permissions?.some(p => p.key === permission) || false;
    },
    [resourceActions],
  );

  const getPermissionDisplayName = useCallback(
    (permission: string): string => {
      if (!resourceActions) return permission;
      const perm = resourceActions.data?.all_permissions?.find(p => p.key === permission);
      return perm?.display_name || permission;
    },
    [resourceActions],
  );

  const can = useCallback(
    (resource: string, action: string, type: 'account' | 'user' = 'account'): boolean => {
      const permission = createPermission(resource, action);
      const permissionsArray = type === 'user' ? userPermissions : accountPermissions;

      // Se ainda está carregando e não há permissões, aguardar
      if (loading && permissionsArray.length === 0) {
        return false;
      }

      // Se não está carregando mas não há permissões, retornar false
      if (permissionsArray.length === 0) {
        return false;
      }

      if (error && permissionsArray.length > 0) {
        const hasPermission = permissionsArray.includes(permission);
        return hasPermission;
      }

      if (!error && !isValidPermission(permission)) {
        return false;
      }

      const hasPermission = permissionsArray.includes(permission);
      return hasPermission;
    },
    [
      createPermission,
      userPermissions,
      accountPermissions,
      error,
      isValidPermission,
      loading,
    ],
  );

  const canAny = useCallback(
    (permissions: string[], type: 'account' | 'user' = 'account'): boolean => {
      const permissionsArray = type === 'user' ? userPermissions : accountPermissions;
      return permissions.some(permission => permissionsArray.includes(permission));
    },
    [userPermissions, accountPermissions],
  );

  const canAll = useCallback(
    (permissions: string[], type: 'account' | 'user' = 'account'): boolean => {
      const permissionsArray = type === 'user' ? userPermissions : accountPermissions;
      return permissions.every(permission => permissionsArray.includes(permission));
    },
    [userPermissions, accountPermissions],
  );

  const refreshPermissions = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Carregar user permissions
      const userPerms = await permissionsService.getUserPermissions(true);
      setUserPermissions(userPerms);

      // Carregar account permissions
      const accountPerms = await permissionsService.getAccountPermissions(true);
      setAccountPermissions(accountPerms);
    } catch {
      setError('Erro ao recarregar permissões');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // isReady: true when user is loaded, config finished, and both permission
  // fetches completed at least once for the current user. Tracking completion
  // (rather than just `!loading`) prevents PermissionRoute from evaluating
  // `can()` against empty arrays during the render window between user
  // appearing and the fetch effect firing — that flashed Unauthorized after
  // a fresh login.
  //
  // `loadedForId !== user?.id` é defesa extra (fix round 1, I1): o bail-out
  // no corpo do render já garante que isto nunca é observável de fora, mas
  // deixar a checagem explícita aqui documenta a invariante e protege contra
  // alguém reintroduzir um reset assíncrono (por efeito) no futuro sem notar
  // que `isReady` também precisa saber "para quem" as listas foram carregadas.
  const isReady = useMemo(() => {
    if (!user) return false;
    if (loadedForId !== user.id) return false;
    if (configLoading) return false;
    if (loading) return false;
    return userPermsLoaded && accountPermsLoaded;
  }, [configLoading, loading, user, loadedForId, userPermsLoaded, accountPermsLoaded]);

  const value: PermissionsContextValue = {
    userPermissions,
    accountPermissions,
    can,
    canAny,
    canAll,
    loading: loading || configLoading,
    isReady,
    error,
    refreshPermissions,
    createPermission,
    isValidPermission,
    getPermissionDisplayName,
  };

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export const usePermissions = (): PermissionsContextValue => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};
