// ── BOLINHA DE CAPTAÇÃO NOVA (Imóveis entrega 3, 03/10/2026) ────────────────
// Acende quando chegou pedido de "Anuncie seu imóvel" depois da última vez que
// a pessoa abriu a aba Novas captações. A data dessa última vez mora no
// ui_settings do usuário, então vale em qualquer aparelho.
import { useCallback, useEffect, useState } from 'react';
import { propertyCaptureRequestsService } from '@/services/propertyCaptureRequests/propertyCaptureRequestsService';
import { profileService } from '@/services/profile/profileService';
import { useAuthStore } from '@/store/authStore';

export const CHAVE_VISTAS = 'captacoes_vistas_ate';
const INTERVALO_MS = 120000;

export function useCaptacoesNovas(ativo: boolean): { tem: boolean; marcarComoVistas: () => Promise<void> } {
  const salvo = useAuthStore(s => s.currentUser?.ui_settings?.[CHAVE_VISTAS]);
  const vistasAte = typeof salvo === 'string' ? salvo : undefined;
  const [tem, setTem] = useState(false);

  useEffect(() => {
    if (!ativo) { setTem(false); return; }
    let cancelado = false;
    const conferir = () => {
      const params: Record<string, string> = { pending: 'true', per_page: '1' };
      if (vistasAte) params.created_after = vistasAte;
      propertyCaptureRequestsService.list(params)
        .then(r => { if (!cancelado) setTem((r.meta?.total ?? 0) > 0); })
        // Bolinha é aviso, não erro: falhou, fica apagada e confere de novo depois.
        .catch(() => { if (!cancelado) setTem(false); });
    };
    conferir();
    const timer = setInterval(conferir, INTERVALO_MS);
    return () => { cancelado = true; clearInterval(timer); };
  }, [ativo, vistasAte]);

  const marcarComoVistas = useCallback(async () => {
    const agora = new Date().toISOString();
    const { currentUser, updateUISettings } = useAuthStore.getState();
    const atual = currentUser?.ui_settings ?? {};
    updateUISettings({ [CHAVE_VISTAS]: agora });
    setTem(false);
    try {
      // O servidor troca o objeto inteiro: vai o ui_settings todo, não só a data.
      await profileService.updateUISettings({ ...atual, [CHAVE_VISTAS]: agora });
    } catch {
      // Sem toast: no máximo a bolinha volta no próximo login.
    }
  }, []);

  return { tem, marcarComoVistas };
}
