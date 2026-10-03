// ── BOLINHA DE CAPTAÇÃO NOVA (Imóveis entrega 3, 03/10/2026) ────────────────
// Acende quando chegou pedido de "Anuncie seu imóvel" depois do último que a
// pessoa já viu na aba Novas captações. A marca mora no ui_settings do
// usuário, então vale em qualquer aparelho.
import { useCallback, useEffect, useRef, useState } from 'react';
import { propertyCaptureRequestsService } from '@/services/propertyCaptureRequests/propertyCaptureRequestsService';
import { salvarUISettings } from '@/features/auth/uiSettings';
import { useAuthStore } from '@/store/authStore';

export const CHAVE_VISTAS = 'captacoes_vistas_ate';
const INTERVALO_MS = 120000;

/**
 * Marca do "já vi" a partir do pedido pendente mais novo (horário do
 * SERVIDOR, não o relógio do aparelho, que pode estar adiantado e esconder
 * pedido novo). +1 ms porque a data vem cortada em milissegundos e o servidor
 * compara `created_at > marca` com microssegundos: sem isso o próprio pedido
 * mais novo contaria como novo para sempre. Sem pedido pendente, vale agora.
 */
export function marcaDoMaisNovo(createdAt: string | undefined, agora: () => Date = () => new Date()): string {
  const ms = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isNaN(ms) ? agora().toISOString() : new Date(ms + 1).toISOString();
}

const ocultaNoNavegador = () => typeof document !== 'undefined' && document.hidden;

export function useCaptacoesNovas(ativo: boolean): { tem: boolean; marcarComoVistas: () => Promise<void> } {
  const salvo = useAuthStore(s => s.currentUser?.ui_settings?.[CHAVE_VISTAS]);
  const vistasAte = typeof salvo === 'string' ? salvo : undefined;
  const [tem, setTem] = useState(false);

  useEffect(() => {
    if (!ativo) { setTem(false); return; }
    let cancelado = false;
    const conferir = () => {
      // Aba do navegador escondida: não gasta pedido; confere ao voltar.
      if (ocultaNoNavegador()) return;
      const params: Record<string, string> = { pending: 'true', per_page: '1' };
      if (vistasAte) params.created_after = vistasAte;
      propertyCaptureRequestsService.list(params)
        .then(r => { if (!cancelado) setTem((r.meta?.total ?? 0) > 0); })
        // Bolinha é aviso, não erro: falhou, fica apagada e confere de novo depois.
        .catch(() => { if (!cancelado) setTem(false); });
    };
    const aoVoltar = () => { if (!ocultaNoNavegador()) conferir(); };
    conferir();
    const timer = setInterval(conferir, INTERVALO_MS);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      cancelado = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [ativo, vistasAte]);

  // Uma marcação por vez: abrir a aba e a bolinha acender juntos não grava duas.
  const marcando = useRef(false);
  const marcarComoVistas = useCallback(async () => {
    if (marcando.current) return;
    marcando.current = true;
    try {
      // O servidor já devolve do mais novo para o mais velho.
      const r = await propertyCaptureRequestsService.list({ pending: 'true', per_page: '1' });
      await salvarUISettings({ [CHAVE_VISTAS]: marcaDoMaisNovo(r.data[0]?.created_at) });
      setTem(false);
    } catch {
      // Sem toast: a bolinha continua e a próxima abertura da aba tenta de novo.
    } finally {
      marcando.current = false;
    }
  }, []);

  return { tem, marcarComoVistas };
}
