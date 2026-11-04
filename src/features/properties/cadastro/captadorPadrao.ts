// Quem aparece nos seletores de Captador e Corretor responsável, e quem já nasce
// Captador em imóvel novo. O corretor não lê a equipe (`users.read`): sem isto, os
// dois seletores só tinham "Nenhum" para ele, mesmo com alguém escolhido no imóvel.
import { useContext } from 'react';
import { PermissionsContext } from '@/contexts/PermissionsContext';
import { useCan } from '@/hooks/useCan';
import { useAuthStore } from '@/store/authStore';

export type PessoaDoSeletor = { id: string; name: string };

/** A lista da equipe mais quem ela não trouxe, sem repetir. */
export function opcoesDoSeletor(
  equipe: PessoaDoSeletor[],
  extras: (PessoaDoSeletor | null | undefined)[],
): PessoaDoSeletor[] {
  const faltando = extras.filter((p): p is PessoaDoSeletor => !!p);
  return [...equipe, ...faltando].filter((p, i, todas) => todas.findIndex(o => o.id === p.id) === i);
}

/**
 * O id de quem deve nascer Captador: a própria pessoa, se ela é corretor (cargo sem
 * `dashboard.team`, a mesma régua da Dashboard). Gestor cadastra imóvel dos outros,
 * então segue escolhendo. Nulo até as permissões chegarem: `can()` responde não
 * enquanto carrega, e isso faria um gestor nascer Captador sem querer.
 */
export function useCaptadorPadrao(): string | null {
  const meuId = useAuthStore(s => s.currentUser?.id);
  const permissoes = useContext(PermissionsContext);
  const can = useCan();
  if (!permissoes?.isReady || permissoes.loadFailure || can('dashboard', 'team')) return null;
  return meuId ? String(meuId) : null;
}
