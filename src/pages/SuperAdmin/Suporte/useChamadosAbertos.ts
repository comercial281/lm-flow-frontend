import { useEffect, useState } from 'react';
import { supportAdminService } from '@/services/support/supportAdminService';

const INTERVALO_MS = 2 * 60 * 1000;

/** Chamados Abertos (esperando o time), pro número ao lado de "Suporte" no menu. */
export function useChamadosAbertos(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const atualizar = () => {
      supportAdminService.openCount().then(setN).catch(() => {});
    };
    atualizar();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') atualizar();
    }, INTERVALO_MS);
    return () => window.clearInterval(id);
  }, []);
  return n;
}
