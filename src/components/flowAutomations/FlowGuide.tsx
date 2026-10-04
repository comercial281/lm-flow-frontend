import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ListChecks, MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import type { FlowAutomationKind } from '@/types/flowAutomations';
import {
  currentStep, guideFinishedText, guideInstruction, stepLabel, type GuideStep,
} from '@/features/flowAutomations/guide';
import { cn } from '@/lib/utils';

// A construção guiada no canvas (Automações · sprint 4, parte B):
// - a FAIXA no topo diz o passo atual ("Passo 2 de 5: clique no bloco
//   destacado e escreva a mensagem de abertura") e, no fim, "Pronto!";
// - o CHECKLIST, recolhível, lista todos os passos: ✓ feito · ● atual · ○ falta.
// O bloco do passo atual pisca (o canvas passa `highlightedNodeId`).

interface BannerProps {
  steps: GuideStep[];
  kind: FlowAutomationKind;
  /** Mostra o "Pronto!" (só quando o guia terminou nesta visita, pra não virar ruído). */
  showFinished: boolean;
  onOpenStep: (nodeId: string) => void;
}

export function FlowGuideBanner({ steps, kind, showFinished, onOpenStep }: BannerProps) {
  const step = currentStep(steps);
  if (step) {
    return (
      <div
        className="flex flex-wrap items-center gap-2 border-b border-amber-400/60 bg-amber-400/15 px-4 py-2 text-sm"
        role="status"
        data-testid="faixa-do-guia"
      >
        <MousePointerClick className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <strong>{stepLabel(step)}:</strong> {guideInstruction(step)}
        </span>
        <Button size="sm" variant="outline" className="h-8 bg-background" onClick={() => onOpenStep(step.nodeId)}>
          Abrir o bloco
        </Button>
      </div>
    );
  }
  if (!showFinished || steps.length === 0) return null;
  return (
    <div
      className="flex items-center gap-2 border-b border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-200"
      role="status"
      data-testid="faixa-do-guia"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <strong>{guideFinishedText(kind)}</strong>
    </div>
  );
}

interface ChecklistProps {
  steps: GuideStep[];
  onOpenStep: (nodeId: string) => void;
  className?: string;
}

export function FlowGuideChecklist({ steps, onOpenStep, className }: ChecklistProps) {
  const [open, setOpen] = useState(true);
  const current = currentStep(steps);
  const doneCount = steps.filter(s => s.done).length;
  if (steps.length === 0) return null;
  return (
    <div
      className={cn('w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background/95 shadow-md', className)}
      data-testid="checklist-do-guia"
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold"
      >
        <ListChecks className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="flex-1">Passo a passo · {doneCount} de {steps.length} feitos</span>
        {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      </button>
      {open && (
        <ol className="space-y-0.5 border-t border-border px-2 py-2">
          {steps.map(s => {
            const state = s.done ? 'feito' : current?.nodeId === s.nodeId ? 'atual' : 'falta';
            return (
              <li key={s.nodeId}>
                <button
                  type="button"
                  onClick={() => onOpenStep(s.nodeId)}
                  data-estado={state}
                  className={cn(
                    'flex w-full items-start gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-muted',
                    state === 'atual' && 'bg-amber-400/15 font-semibold',
                    state === 'feito' && 'text-muted-foreground',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-px w-3 shrink-0 text-center',
                      state === 'feito' && 'text-emerald-600',
                      state === 'atual' && 'text-amber-600',
                    )}
                  >
                    {state === 'feito' ? '✓' : state === 'atual' ? '●' : '○'}
                  </span>
                  <span>
                    <span className="sr-only">{state === 'feito' ? 'Feito: ' : state === 'atual' ? 'Agora: ' : 'Falta: '}</span>
                    {s.step}. {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
