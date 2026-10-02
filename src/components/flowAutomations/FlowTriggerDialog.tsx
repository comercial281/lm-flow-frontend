import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, Button, Label,
} from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import {
  ConditionEditor,
  PipelineFilterEditor,
  triggerNeedsCondition,
  type AutomationResources,
} from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
import {
  FLOW_TRIGGER_GROUPS,
  LEAD_CREATED_HINT,
  changeTriggerEvent,
  eventAcceptsPipelineFilter,
  flowTriggerLabel,
  pipelineFilterOf,
  triggerConditionOf,
  triggerProblem,
  withPipelineFilter,
  withTriggerCondition,
  type FlowTrigger,
} from '@/features/flowAutomations/trigger';

// Gatilho do fluxo: a mesma lista, os mesmos nomes e os MESMOS editores de
// filtro da tela Automações (ConditionEditor e PipelineFilterEditor), pra o
// fluxo e a regra falarem a mesma língua. Rascunho local; o fluxo vai pro
// servidor no Salvar do topo do canvas.

interface Props {
  open: boolean;
  trigger: FlowTrigger;
  resources: AutomationResources;
  onClose: () => void;
  onSave: (next: FlowTrigger) => void;
}

export function FlowTriggerDialog({ open, trigger, resources, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<FlowTrigger>(trigger);
  const [problem, setProblem] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setDraft(trigger);
      setProblem(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reabre a partir do gatilho atual

  const event = draft.event;
  const known = FLOW_TRIGGER_GROUPS.some(g => (g.events as string[]).includes(event));

  const save = () => {
    const issue = triggerProblem(draft);
    if (issue) {
      setProblem(issue);
      return;
    }
    onSave(draft);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gatilho do fluxo</DialogTitle>
          <DialogDescription>O que precisa acontecer pra este fluxo começar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Quando</Label>
            <Seletor
              value={event}
              onChange={e => {
                setProblem(null);
                setDraft(d => changeTriggerEvent(d, e.target.value as FlowTrigger['event']));
              }}
              className="mt-1 w-full"
              aria-label="Gatilho"
            >
              <option value="">Escolha o gatilho</option>
              {event && !known && <option value={event}>{flowTriggerLabel(event)}</option>}
              {FLOW_TRIGGER_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.events.map(ev => (
                    <option key={ev} value={ev}>{flowTriggerLabel(ev)}</option>
                  ))}
                </optgroup>
              ))}
            </Seletor>
            {event === 'lead.created' && (
              <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700">
                {LEAD_CREATED_HINT}
              </p>
            )}
          </div>

          {event && event !== 'flow_called' && (triggerNeedsCondition(event) || eventAcceptsPipelineFilter(event)) && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              {triggerNeedsCondition(event) && (
                <ConditionEditor
                  trigger={event}
                  condition={triggerConditionOf(draft)}
                  onChange={next => {
                    setProblem(null);
                    setDraft(d => withTriggerCondition(d, next));
                  }}
                  resources={resources}
                />
              )}
              <PipelineFilterEditor
                trigger={event}
                condition={pipelineFilterOf(draft)}
                onChange={next => setDraft(d => withPipelineFilter(d, next))}
                resources={resources}
              />
            </div>
          )}

          {problem && <p className="text-xs text-destructive" role="alert">{problem}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
