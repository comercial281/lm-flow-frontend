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
import { Plus, X } from 'lucide-react';
import {
  FLOW_TRIGGER_GROUPS,
  LEAD_CREATED_HINT,
  addAlternative,
  changeTriggerEvent,
  eventAcceptsPipelineFilter,
  flowTriggerLabel,
  pipelineFilterOf,
  removeAlternative,
  triggerConditionOf,
  triggerProblem,
  updateAlternative,
  withPipelineFilter,
  withTriggerCondition,
  type FlowTrigger,
  type FlowTriggerPart,
} from '@/features/flowAutomations/trigger';

// Gatilho do fluxo: a mesma lista, os mesmos nomes e os MESMOS editores de
// filtro da tela Automações (ConditionEditor e PipelineFilterEditor), pra o
// fluxo e a regra falarem a mesma língua. Rascunho local; o fluxo vai pro
// servidor no Salvar do topo do canvas.
//
// Sprint 3 (03/10/2026): "+ Ou quando…" acrescenta outro gatilho. O fluxo
// começa quando qualquer um acontece; cada um é editado com o mesmo editor.

interface Props {
  open: boolean;
  trigger: FlowTrigger;
  resources: AutomationResources;
  onClose: () => void;
  onSave: (next: FlowTrigger) => void;
}

// Declarado fora do render: componente com Seletor criado dentro do render
// fecha a lista aberta a cada redesenho (armadilha 9 do Seletor).
function TriggerPartEditor({
  part, onChange, resources, label, ariaLabel,
}: {
  part: FlowTriggerPart;
  onChange: (next: FlowTriggerPart) => void;
  resources: AutomationResources;
  label: string;
  ariaLabel: string;
}) {
  const event = part.event;
  const known = FLOW_TRIGGER_GROUPS.some(g => (g.events as string[]).includes(event));
  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        <Seletor
          value={event}
          onChange={e => onChange(changeTriggerEvent(part, e.target.value as FlowTriggerPart['event']))}
          className="mt-1 w-full"
          aria-label={ariaLabel}
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
              condition={triggerConditionOf(part)}
              onChange={next => onChange(withTriggerCondition(part, next))}
              resources={resources}
            />
          )}
          <PipelineFilterEditor
            trigger={event}
            condition={pipelineFilterOf(part)}
            onChange={next => onChange(withPipelineFilter(part, next))}
            resources={resources}
          />
        </div>
      )}
    </div>
  );
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

  const alternatives = draft.alternatives ?? [];
  // "Quando outro fluxo chama este" é interno: não combina com "Ou quando".
  const canAddAlternative = !!draft.event && draft.event !== 'flow_called';

  const save = () => {
    const issue = triggerProblem(draft);
    if (issue) {
      setProblem(issue);
      return;
    }
    onSave(draft);
  };

  const edit = (next: FlowTrigger) => {
    setProblem(null);
    setDraft(next);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gatilho do fluxo</DialogTitle>
          <DialogDescription>O que precisa acontecer pra este fluxo começar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <TriggerPartEditor
            part={draft}
            onChange={next => edit({ ...draft, event: next.event, conditions: next.conditions })}
            resources={resources}
            label="Quando"
            ariaLabel="Gatilho"
          />

          {alternatives.map((alt, i) => (
            <div key={i} className="relative rounded-lg border border-dashed border-border p-3">
              <button
                type="button"
                onClick={() => edit(removeAlternative(draft, i))}
                className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Tirar o "Ou quando" ${i + 1}`}
                title="Tirar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <TriggerPartEditor
                part={alt}
                onChange={next => edit(updateAlternative(draft, i, next))}
                resources={resources}
                label="Ou quando"
                ariaLabel={`Ou quando ${i + 1}`}
              />
            </div>
          ))}

          {canAddAlternative && (
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => edit(addAlternative(draft))}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Ou quando…
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                O fluxo começa quando qualquer um destes acontecer.
              </p>
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
