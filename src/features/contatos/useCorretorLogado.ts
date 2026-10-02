import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';

// Quem está logado vê só os próprios contatos? É o corretor da imobiliária
// isolada: sem `conversations.read_all` (o servidor decide pelo mesmo
// `broker_isolated?`, que ainda olha a chave da imobiliária). Na tela isso
// trava o Responsável nele e esconde as pílulas de equipe.
//
// Devolve null enquanto as permissões carregam: a tela de gestor é a de
// reserva, e o servidor confere de novo ao salvar.
export function useCorretorLogado(): { id: string; name: string } | null {
  const { user } = useAuth();
  const { can, isReady } = useUserPermissions();
  if (!isReady || !user) return null;
  if (can('conversations', 'read_all')) return null;
  return { id: String(user.id), name: user.name ?? '' };
}
