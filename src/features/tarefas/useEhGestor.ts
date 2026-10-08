import { useUserPermissions } from '@/hooks/useUserPermissions';

/**
 * Gestor, pra escolher o responsável da tarefa: quem enxerga a equipe toda
 * (`conversations.read_all`, que o administrador também tem). Espelha o
 * Visits::Visibility.manager? do servidor, que é quem decide de verdade: só
 * gestor muda o responsável, o corretor cria e fica só pra ele.
 * Enquanto as permissões carregam, vale "não é gestor".
 */
export function useEhGestor(): boolean {
  const { can, isReady } = useUserPermissions();
  return isReady && can('conversations', 'read_all');
}
