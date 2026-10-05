import { useEffect, useState } from 'react';
import { supportAdminService } from '@/services/support/supportAdminService';
import { useSinalSuporte } from '@/components/support/aoVivo';

const INTERVALO_MS = 2 * 60 * 1000;

/**
 * Chamados Abertos (esperando o time), pro número ao lado de "Suporte" no menu.
 * `ativo` falso (quem não é suporte): nenhuma requisição, nenhum polling.
 */
export function useChamadosAbertos(ativo: boolean): number {
  const [n, setN] = useState(0);
  // Chamado mudou (novo, respondido, situação): recontar na hora pelo sinal ao vivo.
  const [sinal, setSinal] = useState(0);
  useSinalSuporte(() => setSinal(s => s + 1));
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
  }, [ativo, sinal]);
  return n;
}
