// Cargo de quem está vendo a Área de Membros. Gestor = quem vê a equipe toda
// (`conversations.read_all`, a mesma régua do Painel e das Tarefas; o
// administrador da conta também tem). Enquanto as permissões carregam, conta como
// corretor: melhor esconder um instante do que mostrar o que não devia.
// A Leal Mídia é 'admin' e edita, a menos que esteja em "Ver como".

import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useEhGestor } from '@/features/tarefas/useEhGestor';
import type { CargoNaAcademia } from './quemVe';
import { useVerComo } from './verComo';

export function useCargoNaAcademia(): { cargo: CargoNaAcademia; podeEditar: boolean; ehLealMidia: boolean } {
  const ehLealMidia = useIsSuperAdmin();
  const ehGestor = useEhGestor();
  const verComo = useVerComo();
  if (ehLealMidia) {
    const cargo = verComo ?? 'admin';
    return { cargo, podeEditar: cargo === 'admin', ehLealMidia: true };
  }
  return { cargo: ehGestor ? 'gestor' : 'corretor', podeEditar: false, ehLealMidia: false };
}
