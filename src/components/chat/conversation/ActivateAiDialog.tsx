import React, { useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@evoapi/design-system/dialog';
import { Button } from '@evoapi/design-system/button';
import { Input } from '@evoapi/design-system/input';
import { Label } from '@evoapi/design-system/label';
import { Checkbox } from '@evoapi/design-system/checkbox';
import { Bot, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Conversation } from '@/types/chat/api';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { chatService } from '@/services/chat/chatService';
import type { SalesAgentLeadReport } from '@/types/analytics/pipelines';

interface Props {
  conversation: Conversation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// "Ativar IA pra este lead": dispara a IA Vendedora do inbox pra ATENDER este lead.
// Ela inicia (do zero) ou continua a conversa lendo todo o histórico. Opcional:
// focar num imóvel. Espelha o endpoint POST /sales_agents/:id/engage.
const ActivateAiDialog: React.FC<Props> = ({ conversation, open, onOpenChange }) => {
  const [loading, setLoading] = useState(false);
  const [firing, setFiring] = useState(false);
  const [agent, setAgent] = useState<SalesAgent | null>(null);
  const [propertyCode, setPropertyCode] = useState('');
  const [fresh, setFresh] = useState(false);
  // Situação da IA NESTE lead, carregada junto: é a pergunta que se faz ao abrir
  // esta janela ("por que ela não respondeu?"), e a resposta não existia em tela
  // nenhuma. Vale principalmente quando não há IA no canal: aí ela não é sequer
  // acionada e não sobra turno, erro nem log pra investigar depois.
  const [report, setReport] = useState<SalesAgentLeadReport | null>(null);

  useEffect(() => {
    if (!open || !conversation) return;
    setLoading(true);
    setFresh(false);
    setReport(null);
    chatService
      .getSalesAgentStatus(conversation.id)
      .then(setReport)
      .catch(() => setReport(null));
    salesAgentsService
      .list()
      .then((agents) => {
        const match =
          agents.find((a) => a.inbox_id === conversation.inbox_id && a.enabled) ||
          agents.find((a) => a.inbox_id === conversation.inbox_id) ||
          null;
        setAgent(match);
        setPropertyCode(match?.default_property_code ?? '');
      })
      .catch(() => setAgent(null))
      .finally(() => setLoading(false));
  }, [open, conversation]);

  const handleFire = async () => {
    if (!agent || !conversation) return;
    setFiring(true);
    try {
      await salesAgentsService.engage(agent.id, {
        conversationId: conversation.id,
        propertyCode: propertyCode.trim() || undefined,
        fresh,
      });
      toast.success('IA acionada. Ela vai atender este lead no WhatsApp.');
      onOpenChange(false);
    } catch {
      toast.error('Não consegui acionar a IA. Confira se há uma IA ativa neste canal.');
    } finally {
      setFiring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> Ativar IA pra este lead
          </DialogTitle>
          <DialogDescription>
            A IA assume este atendimento no WhatsApp. Ela lê toda a conversa e continua de onde parou (ou inicia, se estiver zerada).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Procurando a IA deste canal…
          </div>
        ) : !agent ? (
          <div className="text-sm text-muted-foreground py-4 space-y-2">
            <p>
              Nenhuma IA Vendedora ativa neste canal. Abra <strong>IA Vendedora</strong> no menu,
              crie ou ative uma, e escolha este canal no campo{' '}
              <em>Instância do WhatsApp que ela opera</em>.
            </p>
            {report && <p className="text-foreground">{report.why}</p>}
            {report?.next_step && <p>{report.next_step}</p>}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="text-sm">
              IA: <span className="font-medium">{agent.name}</span>
            </div>

            {report && (
              <div className="rounded-md bg-muted/50 p-2 space-y-1">
                <p className="text-xs font-medium">Situação neste lead</p>
                <p className="text-xs">{report.why}</p>
                {report.next_step && <p className="text-xs text-muted-foreground">{report.next_step}</p>}
                {report.runs.length > 0 && (
                  <ul className="pt-1 space-y-0.5">
                    {report.runs.map((run, i) => (
                      <li key={i} className="text-[11px] text-muted-foreground">
                        {new Date(run.created_at).toLocaleString('pt-BR')} ·{' '}
                        {run.status === 'replied'
                          ? run.delivered
                            ? 'respondeu o lead'
                            : 'gerou resposta, mas não conseguiu enviar'
                          : run.status === 'failed'
                            ? `falhou: ${run.error_message ?? 'erro no servidor'}`
                            : (run.reason_label ?? 'não respondeu')}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="ai_prop">Imóvel (código, opcional)</Label>
              <Input
                id="ai_prop"
                placeholder="Ex: ALMA"
                value={propertyCode}
                onChange={(e) => setPropertyCode(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-muted-foreground mt-1">
                A IA foca neste imóvel da aba Imóveis. Vazio: ela detecta pela conversa/anúncio.
              </p>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={fresh} onCheckedChange={(v) => setFresh(Boolean(v))} className="mt-0.5" />
              <span className="text-sm">
                Reiniciar do zero
                <span className="block text-xs text-muted-foreground">
                  Ignora o histórico e abre como primeiro contato (apresentação + pergunta de intenção).
                </span>
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={firing}>
            Cancelar
          </Button>
          <Button onClick={handleFire} disabled={!agent || firing || loading}>
            {firing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Bot className="h-4 w-4 mr-1" />}
            Ativar IA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ActivateAiDialog;
