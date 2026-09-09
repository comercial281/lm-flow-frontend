import { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, History, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  leadAutomationService,
  LeadAutomationRule,
  AutomationLog,
} from '@/services/leadAutomation/leadAutomationService';

// Os TRÊS desfechos. A distinção é o ponto desta tela: até aqui "disparou" e
// "falhou" viravam registro (que só o painel raiz lia) e "nem foi considerado"
// era silêncio — e era justamente esse o caso de quem liga uma automação e não
// vê mensagem nenhuma chegar.
const LOOK: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  fired:   { label: 'Disparou',     className: 'text-green-600',   Icon: CheckCircle2 },
  failed:  { label: 'Falhou',       className: 'text-destructive', Icon: XCircle },
  skipped: { label: 'Não disparou', className: 'text-amber-600',   Icon: AlertTriangle },
};

function quando(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface Props {
  rule: LeadAutomationRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * O que esta automação fez com os leads que entraram DE VERDADE.
 *
 * O botão *Testar* responde sobre um lead-cobaia forçado — ele fura o filtro de
 * propósito. Esta lista responde a outra pergunta, que é a que se faz quando a
 * mensagem não chega: o que aconteceu com o lead que acabou de entrar.
 */
export default function AutomationHistoryDialog({ rule, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AutomationLog[]>([]);

  const load = async () => {
    if (!rule) return;
    setLoading(true);
    try {
      setLogs(await leadAutomationService.getLogs(rule.id));
    } catch (e) {
      // Clique explícito: aqui o motivo APARECE (inclusive a recusa por cargo,
      // que a API devolve em outro formato — quem lê só um dos dois mostra a
      // frase genérica e manda procurar o problema no lugar errado).
      toast.error(apiErrorMessage(e, 'Não foi possível carregar o histórico desta automação'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && rule) load();
    if (!open) setLogs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            O que aconteceu
          </DialogTitle>
          <DialogDescription>
            {rule?.name} — os últimos leads que passaram por esta automação: quais dispararam,
            quais falharam e quais nem chegaram a ser considerados (e por quê).
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-10 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}

        {!loading && logs.length === 0 && (
          <p className="py-8 text-sm text-muted-foreground text-center">
            Nenhum lead passou por esta automação ainda. As linhas aparecem aqui a partir do
            próximo lead que entrar.
          </p>
        )}

        {!loading && logs.length > 0 && (
          <ul className="divide-y divide-border text-sm">
            {logs.map(log => {
              const look = LOOK[log.status] ?? LOOK.skipped;
              const Icon = look.Icon;
              return (
                <li key={log.id} className="py-2.5 flex items-start gap-2.5">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${look.className}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`font-medium ${look.className}`}>{look.label}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {quando(log.occurred_at)}
                      </span>
                    </div>
                    <p className="text-muted-foreground break-words">
                      {log.lead || 'lead sem nome'}
                      {log.description ? ` — ${log.description}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
