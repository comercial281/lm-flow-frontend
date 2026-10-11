import { useState, useEffect, useCallback } from 'react';
import { usersService } from '@/services/users';
import type { User } from '@/types/users';

/**
 * `enabled: false` não busca (a lista fica vazia): quem não lê a equipe
 * (`users.read`, o corretor) não precisa disparar um pedido que volta 403.
 */
export function useAccountUsers({ enabled = true }: { enabled?: boolean } = {}) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await usersService.getUsers();

      if (response.data) {
        // Normalizar dados
        const userData = Array.isArray(response.data) ? response.data : [];

        setUsers(userData);
      }
    } catch (err) {
      console.error('Error loading account users:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) loadUsers();
  }, [loadUsers, enabled]);

  return {
    users,
    loading,
    error,
    reload: loadUsers,
  };
}
