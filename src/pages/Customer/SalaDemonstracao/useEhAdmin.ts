import { useAuth } from '@/contexts/AuthContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';

/** O servidor só atende a Sala de demonstração para administrador (e o suporte da Leal Mídia). */
export function useEhAdmin(): boolean {
  const { user } = useAuth();
  const suporte = useIsSuperAdmin();
  return suporte || user?.role?.key === 'admin';
}
