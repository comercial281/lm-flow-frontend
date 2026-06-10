// Gate de super-admin universal do LM Flow.
// Conforme reference_lm_flow_super_admin: giovani@chaveflow.com.br eh
// injetado como super-admin em TODO tenant via SUPER_ADMIN_* env vars.
// Esse hook eh a fonte unica usada pelos botoes de edicao no Tutorial.

import { useAuthStore } from '@/store/authStore';

export const SUPER_ADMIN_EMAIL = 'comercial@lealmidia.com.br';

export function useIsSuperAdmin(): boolean {
  const email = useAuthStore((s) => s.currentUser?.email);
  if (!email) return false;
  return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();
}
