import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Clock, FileText, Image as ImageIcon, Loader2, MessageSquare, Mic, Sticker, Video, Zap, Contact as ContactIcon } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/ds';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation } from '@/types/flowAutomations';
import type { FlowTemplate, FlowTemplatePreviewStep } from '@/features/flowAutomations/templates';
import { describeSeconds } from '@/features/flowAutomations/waitTime';
import { serverMessage } from '@/features/flowAutomations/guide';
import { cn } from '@/lib/utils';

// "+ Novo funil" (Automações · sprint 4, parte B): o corretor não cria funil do
// zero, escolhe um MODELO pronto e ganha a cópia dele, que abre no canvas com o
// passo a passo. Cada cartão mostra o nome, pra que serve e, ao escolher, a
// sequência (cada mensagem e espera, em ordem). O gestor também vê "Começar do
// zero" (`canCreateBlank`).

const MEDIA_ICON: Record<string, typeof ImageIcon> = {
  image: ImageIcon, video: Video, document: FileText, audio: Mic, sticker: Sticker,
};
const MEDIA_LABEL: Record<string, string> = {
  image: 'Foto', video: 'Vídeo', document: 'Documento', audio: 'Áudio', sticker: 'Figurinha',
};

/** Uma linha da sequência (prévia do modelo e do funil na conversa). */
export function PreviewStepLine({ step }: { step: FlowTemplatePreviewStep }) {
  if (step.kind === 'wait') {
    return (
      <li className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Espera {describeSeconds(step.seconds ?? 0)}
      </li>
    );
  }
  if (step.kind === 'other') {
    return (
      <li className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
        <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {step.label}
      </li>
    );
  }
  const media = step.media_kind ? MEDIA_LABEL[step.media_kind] : null;
  const Icon = step.media_kind ? MEDIA_ICON[step.media_kind] ?? MessageSquare : step.kind === 'contact' ? ContactIcon : MessageSquare;
  return (
    <li className="flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
      <Icon className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 whitespace-pre-line">
        {media && <strong>{media}{step.text ? ': ' : ''}</strong>}
        {step.text || (media ? '' : step.label || 'Mensagem')}
        {media && !step.text && <span className="text-muted-foreground"> (você escolhe)</span>}
      </span>
    </li>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (flow: FlowAutomation) => void;
  /** Gestor: também pode começar do zero. */
  canCreateBlank?: boolean;
}

export function FunnelTemplatePicker({ open, onClose, onCreated, canCreateBlank = false }: Props) {
  const [templates, setTemplates] = useState<FlowTemplate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setFailed(false);
    setTemplates(null);
    flowAutomationsService
      .templates('conversation')
      .then(list => {
        setTemplates(list);
        setSelected(list[0]?.key ?? null);
      })
      .catch(() => setFailed(true));
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const apply = async (template: FlowTemplate) => {
    if (busy) return;
    setBusy(template.key);
    try {
      onCreated(await flowAutomationsService.applyTemplate(template.key));
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra criar o funil pelo modelo. Tente de novo.'));
    } finally {
      setBusy(null);
    }
  };

  const createBlank = async () => {
    if (busy) return;
    setBusy('__blank__');
    try {
      onCreated(await flowAutomationsService.create({ name: 'Novo funil', kind: 'conversation' }));
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra criar o funil. Tente de novo.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo funil</DialogTitle>
          <DialogDescription>
            Escolha um modelo. Ele vira o seu funil, e um passo a passo mostra o que ajustar em cada mensagem.
          </DialogDescription>
        </DialogHeader>

        {failed && (
          <p className="text-sm text-muted-foreground">
            Não deu pra carregar os modelos.{' '}
            <button type="button" className="underline" onClick={load}>Tentar de novo</button>
          </p>
        )}
        {!failed && !templates && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando os modelos…
          </p>
        )}
        {templates && templates.length === 0 && <p className="text-sm text-muted-foreground">Nenhum modelo disponível agora.</p>}

        {templates && templates.length > 0 && (
          <ul className="space-y-2" aria-label="Modelos de funil">
            {templates.map(t => {
              const isOpen = selected === t.key;
              return (
                <li
                  key={t.key}
                  className={cn('rounded-lg border transition-colors', isOpen ? 'border-primary bg-primary/5' : 'border-border')}
                >
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left"
                    aria-expanded={isOpen}
                    onClick={() => setSelected(isOpen ? null : t.key)}
                  >
                    <span className="block text-base font-semibold">{t.name}</span>
                    {t.description && <span className="mt-0.5 block text-xs text-muted-foreground">{t.description}</span>}
                  </button>
                  {isOpen && (
                    <div className="space-y-3 border-t border-border px-3 py-3">
                      {t.preview && t.preview.length > 0 && (
                        <ol className="space-y-1.5" aria-label={`Sequência do modelo ${t.name}`}>
                          {t.preview.map((p, i) => <PreviewStepLine key={i} step={p} />)}
                        </ol>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {t.guide_steps ? (
                          <span className="text-xs text-muted-foreground">{t.guide_steps} passos pra deixar do seu jeito</span>
                        ) : <span />}
                        <Button size="sm" onClick={() => apply(t)} disabled={!!busy}>
                          {busy === t.key && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}
                          Usar este modelo
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canCreateBlank && (
          <DialogFooter className="sm:justify-between">
            <p className="text-xs text-muted-foreground self-center">Gestor: dá pra montar um funil do zero, bloco a bloco.</p>
            <Button variant="outline" onClick={createBlank} disabled={!!busy}>
              {busy === '__blank__' && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden="true" />}
              Começar do zero
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
