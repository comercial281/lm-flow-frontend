import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { GitBranch } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { flowAutomationInstancesService, type RunningFlow } from '@/services/flowAutomations/flowAutomationInstancesService';
import { leadFollowupService, type LeadFollowupState } from '@/services/leadFollowup/leadFollowupService';
import {
  assinaturaDasLinhas,
  linhasAutomaticas,
  rotuloDeParar,
  type LinhaAutomatica,
} from '@/features/conversas/automacaoRodando';

export type RespostaAoEnviar = 'parar' | 'manter' | 'cancelar';

/** Quem chama o envio recebe isto quando a pessoa fecha a pergunta: o campo
 *  de mensagem trata como envio que não aconteceu e mantém o texto. */
export class EnvioCancelado extends Error {
  constructor() {
    super('envio cancelado na pergunta da automação');
    this.name = 'EnvioCancelado';
  }
}

interface Opcoes {
  conversationId: string | null | undefined;
  /** Muda quando chega/sai mensagem: relê (a resposta do lead encerra a espera). */
  atualizarQuando?: unknown;
}

/**
 * Fluxo do construtor ou follow-up rodando pra este lead, visto de dentro da
 * conversa (pedido do Tony, 03/10/2026):
 *
 * - `faixa`: acima do campo de mensagem, uma linha por automação, com "Parar";
 * - `perguntarAntesDeEnviar`: quando o corretor envia com automação rodando,
 *   pergunta se tira o lead dela. Humano assumiu = em geral a mensagem
 *   automática não deve mais sair ("Oi de novo!" no meio do atendimento).
 *   "Enviar e manter" vale pra conversa enquanto as mesmas automações
 *   estiverem rodando — perguntar a cada mensagem cansaria.
 *
 * Erro ao ler = nada aparece e nada é perguntado (não trava a conversa).
 */
export function useAutomacaoRodando({ conversationId, atualizarQuando }: Opcoes) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [fluxos, setFluxos] = useState<RunningFlow[]>([]);
  const [followup, setFollowup] = useState<LeadFollowupState | null>(null);
  const [parando, setParando] = useState<string | null>(null);
  const [pergunta, setPergunta] = useState<LinhaAutomatica[] | null>(null);
  const responder = useRef<((r: RespostaAoEnviar) => void) | null>(null);
  const mantidas = useRef<string | null>(null);

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
    mantidas.current = null;
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

  // Pergunta pendurada quando a conversa troca = cancelada.
  useEffect(
    () => () => {
      responder.current?.('cancelar');
      responder.current = null;
    },
    [conversationId],
  );

  const linhas = linhasAutomaticas(fluxos, followup);
  const paraveis = linhas.filter(l => l.podeParar);

  const pararLinha = useCallback(
    async (linha: LinhaAutomatica) => {
      const r =
        linha.tipo === 'fluxo'
          ? await flowAutomationInstancesService.stop(linha.id)
          : await leadFollowupService.stop({ conversationId });
      return r.message;
    },
    [conversationId],
  );

  const pararTudo = useCallback(async () => {
    const resultados = await Promise.allSettled(paraveis.map(pararLinha));
    if (resultados.some(r => r.status === 'rejected')) {
      toast.error('Não consegui tirar o lead de uma das automações. Use o "Parar" da faixa.');
    } else {
      toast.success(paraveis.length === 1 ? 'Lead tirado da automação.' : 'Lead tirado das automações.');
    }
    await carregar();
  }, [paraveis, pararLinha, carregar]);

  const perguntarAntesDeEnviar = useCallback((): Promise<RespostaAoEnviar> => {
    if (paraveis.length === 0) return Promise.resolve('manter');
    if (mantidas.current === assinaturaDasLinhas(paraveis)) return Promise.resolve('manter');
    responder.current?.('cancelar');
    setPergunta(paraveis);
    return new Promise<RespostaAoEnviar>(resolve => {
      responder.current = resolve;
    });
  }, [paraveis]);

  const responderPergunta = (r: RespostaAoEnviar) => {
    if (r === 'manter' && pergunta) mantidas.current = assinaturaDasLinhas(pergunta);
    responder.current?.(r);
    responder.current = null;
    setPergunta(null);
  };

  const pararUma = async (linha: LinhaAutomatica) => {
    const ok = await confirmar({
      titulo: linha.tipo === 'fluxo' ? 'Parar o fluxo pra este lead?' : 'Parar o follow-up pra este lead?',
      descricao: 'As mensagens automáticas que ainda iam sair pra este lead não saem mais. Os outros leads não mudam.',
      rotuloDaAcao: 'Parar',
      destrutivo: true,
    });
    if (!ok) return;
    setParando(linha.key);
    try {
      toast.success((await pararLinha(linha)) || 'Parado.');
      await carregar();
    } catch {
      toast.error('Não consegui parar agora. Tente de novo.');
    } finally {
      setParando(null);
    }
  };

  const faixa =
    linhas.length === 0 ? null : (
      <div className="flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2 space-y-1" aria-live="polite">
        {linhas.map(linha => (
          <div key={linha.key} className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {/* Celular: até 2 linhas (cortar em 1 escondia o fim da espera); tela grande: 1 linha. */}
            <span className="min-w-0 flex-1 text-muted-foreground line-clamp-2 sm:truncate" title={linha.texto}>
              {linha.texto}
            </span>
            {linha.podeParar && (
              <Button
                size="sm"
                variant="outline"
                className="h-11 shrink-0 px-4 sm:h-8 sm:px-3"
                onClick={() => void pararUma(linha)}
                disabled={parando === linha.key}
              >
                Parar
              </Button>
            )}
          </div>
        ))}
      </div>
    );

  const dialogos = (
    <>
      {dialogoDeConfirmacao}
      <Dialog open={pergunta !== null} onOpenChange={aberto => !aberto && responderPergunta('cancelar')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Este lead está numa automação</DialogTitle>
            <DialogDescription>
              Se você assumiu a conversa, tire o lead da automação pra ele não receber mensagem automática no meio
              do atendimento.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {(pergunta ?? []).map(l => (
              <li key={l.key}>{l.texto}</li>
            ))}
          </ul>
          <DialogFooter>
            {/* No celular o rodapé empilha (o principal fica em cima) e cada botão ocupa a largura toda; 44px de altura pro dedo. */}
            <Button variant="outline" className="h-11 sm:h-9" onClick={() => responderPergunta('manter')}>
              Enviar e manter
            </Button>
            <Button className="h-11 sm:h-9" onClick={() => responderPergunta('parar')} autoFocus>
              {rotuloDeParar(pergunta ?? [])}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return { linhas, faixa, dialogos, perguntarAntesDeEnviar, pararTudo };
}
