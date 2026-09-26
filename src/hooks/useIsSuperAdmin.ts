// Suporte da Leal Mídia = quem está na Equipe do painel raiz (decisão do dono,
// 26/09/2026). Quem diz é o SERVIDOR (`is_support` no /auth/validate e no
// login) — uma verdade só: antes a tela comparava com o e-mail fixo do dono e o
// servidor com o final do e-mail, e os dois discordavam.
import { useAuthStore } from '@/store/authStore';

export const SUPER_ADMIN_EMAIL = 'comercial@lealmidia.com.br';

/**
 * Resiliência (janela de deploy): servidor antigo, sem o campo `is_support`
 * no /auth/validate e no login, não pode virar "todo mundo é suporte". Quando
 * o campo está AUSENTE (undefined — nunca quando veio `false` explícito do
 * servidor), cai no critério de hoje: e-mail == SUPER_ADMIN_EMAIL.
 */
export function isSupportUser(user?: { is_support?: unknown; email?: string } | null): boolean {
  if (!user) return false;
  if (user.is_support === true) return true;
  if (user.is_support === false) return false;
  const email = typeof user.email === 'string' ? user.email : undefined;
  return !!email && email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();
}

export function useIsSuperAdmin(): boolean {
  return useAuthStore(s => isSupportUser(s.currentUser));
}

/**
 * O DONO da plataforma. Não é o critério de suporte: serve só ao atalho
 * instantâneo da Área do Admin (useAdminAccess), que não espera a rede.
 */
export function useIsOwner(): boolean {
  const email = useAuthStore(s => s.currentUser?.email);
  return !!email && email.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
}
