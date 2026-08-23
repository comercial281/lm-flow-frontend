// Monta o rastreador global de UI (eventTracker) enquanto houver usuário logado.
// Liga no login, desliga no logout, e informa cada mudança de rota pra medir
// tempo por tela. Invisível (não renderiza nada). Fica DENTRO do Router.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { eventTracker } from '@/services/tracking/eventTracker';

export default function GlobalEventTracker() {
  const location = useLocation();
  const userId = useAuthStore((s) => s.currentUser?.id);

  // Liga/desliga conforme o estado de login.
  useEffect(() => {
    if (userId) {
      eventTracker.start(location.pathname);
      return () => eventTracker.stop();
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Cada navegação => fecha tela anterior (tempo) + registra a nova.
  useEffect(() => {
    if (userId) eventTracker.onRouteChange(location.pathname);
  }, [location.pathname, userId]);

  return null;
}
