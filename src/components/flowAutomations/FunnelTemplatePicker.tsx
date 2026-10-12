import { useState } from 'react';
import { toast } from 'sonner';
import { Clock, FileText, Image as ImageIcon, Loader2, MessageSquare, Mic, Plus, Sticker, Video, Zap, Contact as ContactIcon } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation } from '@/types/flowAutomations';
import type { FlowTemplatePreviewStep } from '@/features/flowAutomations/templates';
import { describeSeconds } from '@/features/flowAutomations/waitTime';
import { serverMessage } from '@/features/flowAutomations/guide';
import { BOOK_SOURCE, BOOK_SUMMARY } from '@/features/flowAutomations/book';
import { TemplatePickerDialog } from './TemplatePickerDialog';

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
  if (step.media_source === BOOK_SOURCE) {
    return (
      <li className="flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
        <FileText className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 whitespace-pre-line">
          {step.text && <>{step.text}{'\n'}</>}
          <strong>{BOOK_SUMMARY}</strong>
        </span>
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

// Desde 12/10/2026 a escolha é a lista com prévia (TemplatePickerDialog), a
// mesma janela dos modelos das Automações.
export function FunnelTemplatePicker({ open, onClose, onCreated, canCreateBlank = false }: Props) {
  const [creatingBlank, setCreatingBlank] = useState(false);

  const createBlank = async () => {
    if (creatingBlank) return;
    setCreatingBlank(true);
    try {
      onCreated(await flowAutomationsService.create({ name: 'Novo funil', kind: 'conversation' }));
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra criar o funil. Tente de novo.'));
    } finally {
      setCreatingBlank(false);
    }
  };

  return (
    <TemplatePickerDialog
      open={open}
      onClose={onClose}
      kind="conversation"
      title="Novo funil"
      description="Escolha um modelo e veja a sequência antes de criar. Ele vira o seu funil, e um passo a passo mostra o que ajustar em cada mensagem."
      applyError="Não deu pra criar o funil pelo modelo. Tente de novo."
      onApplied={onCreated}
      busy={creatingBlank}
      footerStart={canCreateBlank ? (
        <Button variant="outline" onClick={createBlank} disabled={creatingBlank} title="Gestor: monte o funil do zero, bloco a bloco">
          {creatingBlank ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          Começar do zero
        </Button>
      ) : undefined}
    />
  );
}
