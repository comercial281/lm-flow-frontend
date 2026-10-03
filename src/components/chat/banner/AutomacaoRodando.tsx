import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { flowAutomationInstancesService, type RunningFlow } from '@/services/flowAutomations/flowAutomationInstancesService';
import { leadFollowupService, type LeadFollowupState } from '@/services/leadFollowup/leadFollowupService';
import { linhasAutomaticas, type LinhaAutomatica } from '@/features/conversas/automacaoRodando';

interface Props {
  conversationId: string | null | undefined;
  /** Muda quando chega/sai mensagem: a faixa relê (a resposta do lead encerra a espera). */
  atualizarQuando?: unknown;
}

/**
 * Faixa acima do campo de mensagem: fluxo do construtor ou follow-up rodando
 * pra este lead, com "Parar" (pedido do Tony, 03/10/2026). Quem vai digitar
 * precisa saber que tem mensagem automática programada — senão assume a
 * conversa e o lead recebe a mensagem do fluxo no meio do atendimento.
 *
 * Erro ao ler = faixa some (não trava a conversa por causa dela).
 */
export default function AutomacaoRodando({ conversationId, atualizarQuando }: Props) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [fluxos, setFluxos] = useState<RunningFlow[]>([]);
  const [followup, setFollowup] = useState<LeadFollowupState | null>(null);
  const [parando, setParando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!conversationId) {
      setFluxos([]);
      setFollowup(null);
      return;
    }
    const [f, fu] = await Promise.allSettled([
      flowAutomationInstancesService.running({ conversationId }),
      leadFollowupService.get({ conversationId }),
    ]);
    setFluxos(f.status === 'fulfilled' ? f.value : []);
    setFollowup(fu.status === 'fulfilled' ? fu.value.state : null);
  }, [conversationId]);

  useEffect(() => {
    void carregar();
  }, [carregar, atualizarQuando]);

  // A espera vence sem ninguém mexer na conversa: relê a cada minuto.
  useEffect(() => {
    if (!conversationId) return undefined;
    const id = window.setInterval(() => void carregar(), 60_000);
    return () => window.clearInterval(id);
  }, [conversationId, carregar]);

  const linhas = linhasAutomaticas(fluxos, followup);
  if (linhas.length === 0) return dialogoDeConfirmacao;

  const parar = async (linha: LinhaAutomatica) => {
    const ok = await confirmar({
      titulo: linha.tipo === 'fluxo' ? 'Parar o fluxo pra este lead?' : 'Parar o follow-up pra este lead?',
      descricao: 'As mensagens automáticas que ainda iam sair pra este lead não saem mais. Os outros leads não mudam.',
      rotuloDaAcao: 'Parar',
      destrutivo: true,
    });
    if (!ok) return;
    setParando(linha.key);
    try {
      const r =
        linha.tipo === 'fluxo'
          ? await flowAutomationInstancesService.stop(linha.id)
          : await leadFollowupService.stop({ conversationId });
      toast.success(r.message || 'Parado.');
      await carregar();
    } catch {
      toast.error('Não consegui parar agora. Tente de novo.');
    } finally {
      setParando(null);
    }
  };

  return (
    <>
      <div className="flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2 space-y-1" aria-live="polite">
        {linhas.map(linha => (
          <div key={linha.key} className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-muted-foreground" title={linha.texto}>
              {linha.texto}
            </span>
            {linha.podeParar && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void parar(linha)}
                disabled={parando === linha.key}
              >
                Parar
              </Button>
            )}
          </div>
        ))}
      </div>
      {dialogoDeConfirmacao}
    </>
  );
}
