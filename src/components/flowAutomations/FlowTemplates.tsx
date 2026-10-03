import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Button,
} from '@/components/ui/ds';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation } from '@/types/flowAutomations';
import type { FlowTemplate } from '@/features/flowAutomations/templates';
import { cn } from '@/lib/utils';

// MODELOS (sprint 2, spec 03/10/2026, seção 4): a mesma lista no botão
// "Modelos" e no estado vazio da tela Automações. "Usar este modelo" cria o
// fluxo desligado no servidor e devolve o fluxo pra tela abrir.

interface ListProps {
  onApplied: (flow: FlowAutomation) => void;
  className?: string;
}

export function FlowTemplateList({ onApplied, className }: ListProps) {
  const [templates, setTemplates] = useState<FlowTemplate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  const load = () => {
    setFailed(false);
    setTemplates(null);
    flowAutomationsService
      .templates()
      .then(setTemplates)
      .catch(() => setFailed(true));
  };

  useEffect(load, []);

  const apply = async (template: FlowTemplate) => {
    if (applying) return;
    setApplying(template.key);
    try {
      onApplied(await flowAutomationsService.applyTemplate(template.key));
    } catch {
      toast.error('Não deu pra criar o fluxo pelo modelo. Tente de novo.');
    } finally {
      setApplying(null);
    }
  };

  if (failed) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        Não deu pra carregar os modelos.{' '}
        <button type="button" className="underline" onClick={load}>Tentar de novo</button>
      </div>
    );
  }
  if (!templates) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando os modelos…
      </div>
    );
  }
  if (templates.length === 0) {
    return <p className={cn('text-sm text-muted-foreground', className)}>Nenhum modelo disponível agora.</p>;
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {templates.map(t => (
        <li key={t.key} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-left">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{t.name}</div>
            {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => apply(t)} disabled={!!applying}>
            {applying === t.key && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}
            Usar este modelo
          </Button>
        </li>
      ))}
    </ul>
  );
}

interface DialogProps extends ListProps {
  open: boolean;
  onClose: () => void;
}

export function FlowTemplatesDialog({ open, onClose, onApplied }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modelos</DialogTitle>
          <DialogDescription>
            O modelo cria o fluxo desligado. Ajuste os textos e o que estiver em branco, e ligue quando estiver pronto.
          </DialogDescription>
        </DialogHeader>
        {open && <FlowTemplateList onApplied={onApplied} />}
      </DialogContent>
    </Dialog>
  );
}
