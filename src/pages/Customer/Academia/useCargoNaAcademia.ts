// Cargo de quem está vendo a Área de Membros. Gestor = quem vê a equipe toda
// (`conversations.read_all`, a mesma régua do Painel e das Tarefas; o
// administrador da conta também tem). Enquanto as permissões carregam, conta como
// corretor: melhor esconder um instante do que mostrar o que não devia
// (`pronto` avisa a tela pra mostrar "carregando" em vez de um aviso de gestor).
// A Leal Mídia é 'admin' e edita, a menos que esteja em "Ver como".

import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useEhGestor } from '@/features/tarefas/useEhGestor';
import type { CargoNaAcademia } from './quemVe';
import { useVerComo } from './verComo';

export function useCargoNaAcademia(): { cargo: CargoNaAcademia; podeEditar: boolean; ehLealMidia: boolean; pronto: boolean } {
  const ehLealMidia = useIsSuperAdmin();
  const ehGestor = useEhGestor();
  const { isReady } = useUserPermissions();
  const verComo = useVerComo();
  if (ehLealMidia) {
    const cargo = verComo ?? 'admin';
    return { cargo, podeEditar: cargo === 'admin', ehLealMidia: true, pronto: true };
  }
  return { cargo: ehGestor ? 'gestor' : 'corretor', podeEditar: false, ehLealMidia: false, pronto: isReady };
}
