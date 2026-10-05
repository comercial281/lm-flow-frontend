import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

import IconActionButton from '@/components/base/IconActionButton';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { quandoAcontece } from '@/lib/formato';
import { scheduledActionsService } from '@/services/scheduledActions/scheduledActionsService';
import { lazyWithRetry } from '@/utils/chunkReload';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  EVENTO_AGENDADOS_MUDARAM,
  TEXTOS_DOS_AGENDADOS as T,
  agendadosPendentes,
  avisarAgendadosMudaram,
  resumoDoAgendamento,
} from '@/features/conversas/agendados';
import type { ScheduledAction } from '@/types/automation';
import Secao from './Secao';

// A mesma janela do card do lead e da tela Ações agendadas, no modo edição.
const ScheduleActionModal = lazyWithRetry(() =>
  import('@/components/scheduledActions/ScheduleActionModal').then(m => ({ default: m.ScheduleActionModal })),
);

const RELER_A_CADA_MS = 60_000;

interface SecaoAgendadosProps {
  contactId: string;
  /** Muda quando chega/sai mensagem: relê (a agendada que saiu some da lista). */
  atualizarQuando?: unknown;
}

/**
 * Mensagens agendadas pra este lead que ainda não saíram (pedido do Tony,
 * 04/10/2026). Só aparece quando há alguma. Cada linha: quando sai, o começo
 * da mensagem, ✏️ (abre o agendamento pra editar) e ✕ (cancela, com pergunta).
 *
 * Relê ao trocar de lead, quando alguém agenda pelo "⋮" da conversa ou pelo
 * card do lead (aviso `EVENTO_AGENDADOS_MUDARAM`), quando a conversa mexe e a
 * cada minuto. Erro de leitura = a seção some (não trava o painel).
 */
export default function SecaoAgendados({ contactId, atualizarQuando }: SecaoAgendadosProps) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  // A lista guarda de quem ela é: a do lead anterior não aparece nem por um quadro.
  const [lista, setLista] = useState<{ de: string | null; itens: ScheduledAction[] }>({ de: null, itens: [] });
  const [editando, setEditando] = useState<ScheduledAction | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const atual = useRef(contactId);
  atual.current = contactId;

  const carregar = useCallback(async () => {
    const pedido = contactId;
    try {
      const resposta = await scheduledActionsService.list({
        contact_id: pedido,
        status: 'scheduled',
        action_type: 'send_message',
        per_page: 50,
      });
      if (pedido === atual.current) {
        setLista({ de: pedido, itens: agendadosPendentes(Array.isArray(resposta) ? resposta : []) });
      }
    } catch {
      if (pedido === atual.current) setLista({ de: pedido, itens: [] });
    }
  }, [contactId]);

  useEffect(() => {
    void carregar();
  }, [carregar, atualizarQuando]);

  useEffect(() => {
    const id = window.setInterval(() => void carregar(), RELER_A_CADA_MS);
    const aoMudar = (e: Event) => {
      const de = (e as CustomEvent<{ contactId: string | null }>).detail?.contactId;
      if (!de || de === atual.current) void carregar();
    };
    window.addEventListener(EVENTO_AGENDADOS_MUDARAM, aoMudar);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(EVENTO_AGENDADOS_MUDARAM, aoMudar);
    };
  }, [carregar]);

  const cancelar = async (acao: ScheduledAction) => {
    const ok = await confirmar({
      titulo: T.perguntaTitulo,
      descricao: T.perguntaDescricao,
      rotuloDaAcao: T.perguntaConfirmar,
      rotuloDeCancelar: T.perguntaVoltar,
      destrutivo: true,
    });
    if (!ok) return;
    setCancelando(acao.id);
    try {
      await scheduledActionsService.cancel(acao.id);
      toast.success(T.cancelado);
      await carregar();
    } catch (e) {
      toast.error(apiErrorMessage(e, T.erroAoCancelar));
    } finally {
      setCancelando(null);
    }
  };

  const itens = lista.de === contactId ? lista.itens : [];

  return (
    <>
      {itens.length > 0 && (
        <Secao titulo={T.titulo} icone={{ Icone: CalendarClock, tom: 'verde' }}>
          <ul className="space-y-2">
            {itens.map(acao => (
              <li key={acao.id} className="flex items-start gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{quandoAcontece(acao.scheduled_for)}</p>
                  <p className="lm-redact truncate text-muted-foreground" title={resumoDoAgendamento(acao, 500)}>
                    {resumoDoAgendamento(acao)}
                  </p>
                </div>
                <IconActionButton
                  label={T.editar}
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  variant="ghost"
                  onClick={() => setEditando(acao)}
                  disabled={cancelando === acao.id}
                  className="h-7 w-7"
                />
                <IconActionButton
                  label={T.cancelar}
                  icon={<X className="h-3.5 w-3.5" />}
                  variant="ghost"
                  onClick={() => void cancelar(acao)}
                  disabled={cancelando === acao.id}
                  className="h-7 w-7"
                />
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {editando && (
        <Suspense fallback={null}>
          <ScheduleActionModal
            open
            contactId={contactId}
            action={editando}
            onClose={() => {
              setEditando(null);
              avisarAgendadosMudaram(contactId);
            }}
          />
        </Suspense>
      )}

      {dialogoDeConfirmacao}
    </>
  );
}
