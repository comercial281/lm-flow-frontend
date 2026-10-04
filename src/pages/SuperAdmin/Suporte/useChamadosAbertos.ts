import { useEffect, useState } from 'react';
import { supportAdminService } from '@/services/support/supportAdminService';

const INTERVALO_MS = 2 * 60 * 1000;

/**
 * Chamados Abertos (esperando o time), pro número ao lado de "Suporte" no menu.
 * `ativo` falso (quem não é suporte): nenhuma requisição, nenhum polling.
 */
export function useChamadosAbertos(ativo: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!ativo) {
      setN(0);
      return;
    }
    const atualizar = () => {
      supportAdminService.openCount().then(setN).catch(() => {});
    };
    atualizar();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') atualizar();
    }, INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [ativo]);
  return n;
}
