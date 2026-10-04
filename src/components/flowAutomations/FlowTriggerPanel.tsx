import React, { useState } from 'react';
import { Button, Label } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import {
  ConditionEditor,
  PipelineFilterEditor,
  triggerNeedsCondition,
  type AutomationResources,
} from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
import { Plus, X, Zap } from 'lucide-react';
import { mesmoConteudo } from '@/hooks/useAlteracoesNaoSalvas';
import { FlowSidePanel } from './FlowSidePanel';
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
//
// Sprint 4 (04/10/2026): deixou de ser janela. É o painel lateral do bloco
// "Início", o primeiro bloco do canvas (a barra de gatilho do topo saiu).

interface Props {
  trigger: FlowTrigger;
  resources: AutomationResources;
  onClose: () => void;
  onSave: (next: FlowTrigger) => void;
  /** Avisa o canvas quando o rascunho difere do gatilho (pra perguntar antes de descartar). */
  onDirtyChange?: (dirty: boolean) => void;
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

export function FlowTriggerPanel({ trigger, resources, onClose, onSave, onDirtyChange }: Props) {
  // O canvas monta o painel ao abrir: o rascunho nasce do gatilho atual.
  const [draft, setDraft] = useState<FlowTrigger>(trigger);
  const [problem, setProblem] = useState<string | null>(null);

  const dirty = !mesmoConteudo(draft, trigger);
  React.useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps -- só quando muda
  React.useEffect(() => () => onDirtyChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps -- ao fechar

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
    <FlowSidePanel
      testId="painel-do-inicio"
      title="Início"
      description="O que precisa acontecer pra este fluxo começar."
      icon={Zap}
      color="#059669"
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </>
      )}
    >
      <div className="space-y-4">
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
    </FlowSidePanel>
  );
}
