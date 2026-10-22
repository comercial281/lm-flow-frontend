import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Checkbox } from '@/components/ui/ds';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import { textoDePausados } from '@/features/flowAutomations/pausas';
import { serverMessage } from '@/features/flowAutomations/guide';

// Resolver de uma vez os leads pausados porque já conversam em outro número
// (Entrega 4). Quem decide o que acontece com cada lead é o servidor; aqui só
// se escolhe por qual número seguir e se vale pra sempre neste fluxo.

interface Props {
  open: boolean;
  flowId: string;
  flowName?: string | null;
  count: number;
  /** Final do número do fluxo ("92"), quando a tela sabe. */
  flowFinal?: string | null;
  /** "Fazer sempre assim" só pra quem edita o fluxo (o servidor ignora de outro jeito). */
  canAlways: boolean;
  onClose: () => void;
  /** Depois de resolver: a tela recarrega a lista/selos. */
  onResolved: () => void;
}

export default function ResolverPausasDialog({ open, flowId, flowName, count, flowFinal, canAlways, onClose, onResolved }: Props) {
  const [always, setAlways] = useState(false);
  const [busy, setBusy] = useState<'conversation' | 'flow' | null>(null);

  async function resolve(choice: 'conversation' | 'flow') {
    setBusy(choice);
    try {
      const r = await flowAutomationsService.resolveNumberConflicts(flowId, { choice, always: canAlways && always });
      const partes: string[] = [];
      if (r.resumed > 0) partes.push(r.resumed === 1 ? '1 lead seguiu' : `${r.resumed} leads seguiram`);
      if (r.stopped > 0) partes.push(r.stopped === 1 ? '1 lead encerrado' : `${r.stopped} leads encerrados`);
      if (r.failed > 0) partes.push(r.failed === 1 ? '1 não deu certo' : `${r.failed} não deram certo`);
      if (partes.length > 0) toast.success(partes.join(', ') + '.');
      if (r.skipped > 0) {
        toast.warning(
          r.skipped === 1
            ? '1 não pôde ir pela conversa: o número dela não manda mensagem sozinho.'
            : `${r.skipped} não puderam ir pela conversa: o número delas não manda mensagem sozinho.`,
        );
      }
      onResolved();
      onClose();
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra resolver agora. Tente de novo.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{textoDePausados(count)}</DialogTitle>
          <DialogDescription>
            {flowName ? `${flowName}: ` : ''}Escolha por qual número o fluxo segue com eles.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Button variant="outline" disabled={busy !== null} onClick={() => void resolve('conversation')}>
            Mandar pela conversa dele
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => void resolve('flow')}>
            {flowFinal ? `Mandar pelo número do fluxo (final ${flowFinal})` : 'Mandar pelo número do fluxo'}
          </Button>
          {canAlways && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={always} onCheckedChange={v => setAlways(v === true)} />
              Fazer sempre assim neste fluxo
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Sem escolha em 48 horas, o fluxo encerra pra esses leads sem mandar nada.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={busy !== null} onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
