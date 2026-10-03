import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, Label, Textarea,
} from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import SendFromField from '@/components/numbers/SendFromField';
import { applySendFrom, sendFromOf } from '@/features/numbers/sendFrom';
import type { FlowAutomationNode, FlowNodeConfig } from '@/types/flowAutomations';
import { ActionEditor, type AutomationResources } from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
import { HIDDEN_BLOCK_NOTICE, blockLabel, isVisibleNode } from '@/features/flowAutomations/palette';
import { leadActionConfig, leadActionOf } from '@/features/flowAutomations/leadAction';
import { nodeProblem } from '@/features/flowAutomations/readiness';
import { WAIT_FOR_REPLY_HELP, WAIT_UNITS, joinMinutes, splitMinutes, type WaitUnit } from '@/features/flowAutomations/waitTime';
import {
  CONDITION_CRITERIA,
  LEGACY_CRITERIA_LABELS,
  configForCriterion,
  criterionOf,
  labelOf,
  withLabel,
} from '@/features/flowAutomations/conditions';
import { formAnswerOf } from '@/features/flowAutomations/formAnswer';
import { FormAnswerPicker } from './FormAnswerPicker';

interface Props {
  node: FlowAutomationNode | null;
  resources: AutomationResources;
  onClose: () => void;
  onSave: (id: string, patch: { label: string; config: FlowNodeConfig }) => void;
}

// Variáveis que o construtor preenche no envio (FlowAutomations::VariableInterpolator).
// São outras que as das Automações: aqui {{nome}} sairia vazio.
const FLOW_MESSAGE_VARS: { label: string; token: string }[] = [
  { label: 'Primeiro nome', token: '{{first_name}}' },
  { label: 'Nome completo', token: '{{name}}' },
  { label: 'Telefone', token: '{{phone}}' },
  { label: 'E-mail', token: '{{email}}' },
];

const WAIT_MODES = [
  { value: 'interval', label: 'Por um tempo' },
  { value: 'schedule', label: 'Por um tempo, saindo só em horário comercial' },
  { value: 'date', label: 'Até uma data e hora' },
];

const fieldClass = 'mt-1 w-full';

/** "2026-10-05T17:00:00Z" → "2026-10-05T14:00" (o campo de data e hora do navegador, no fuso local). */
function toLocalInput(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Declarado fora do render: componente com Seletor criado dentro do render
// fecha a lista aberta a cada redesenho (armadilha 9 do Seletor).
function DurationField({ minutes, onChange, label }: { minutes: unknown; onChange: (m: number) => void; label: string }) {
  const { amount, unit } = splitMinutes(minutes);
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        className="w-24"
        value={amount}
        onChange={e => onChange(joinMinutes(e.target.value, unit))}
        aria-label={label}
      />
      <Seletor
        value={unit}
        onChange={e => onChange(joinMinutes(amount, e.target.value as WaitUnit))}
        className="w-28"
        aria-label="Unidade"
      >
        {WAIT_UNITS.map(u => (
          <option key={u.value} value={u.value}>{u.label}</option>
        ))}
      </Seletor>
    </div>
  );
}

function StagePicker({ value, onPick, resources }: { value: string; onPick: (id: string) => void; resources: AutomationResources }) {
  const groups = resources.pipelines.map(p => ({ pipeline: p, stages: resources.stagesByPipeline[p.id] ?? [] }));
  const known = groups.some(g => g.stages.some(s => s.id === value));
  return (
    <Seletor value={value} onChange={e => onPick(e.target.value)} className={fieldClass} aria-label="Etapa">
      <option value="">Escolha a etapa</option>
      {value && !known && <option value={value}>{resources.loading ? 'Carregando…' : 'Etapa que não existe mais'}</option>}
      {groups.map(g => (
        <optgroup key={g.pipeline.id} label={g.pipeline.name}>
          {g.stages.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </optgroup>
      ))}
    </Seletor>
  );
}

function LabelChecklist({ selected, onChange, resources }: { selected: string[]; onChange: (next: string[]) => void; resources: AutomationResources }) {
  const missing = selected.filter(t => !resources.labels.some(l => l.title === t));
  const toggle = (title: string) =>
    onChange(selected.includes(title) ? selected.filter(t => t !== title) : [...selected, title]);
  return (
    <div className="space-y-1">
      <Label className="text-xs">Etiquetas</Label>
      <div className="max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border">
        {resources.labels.length === 0 && missing.length === 0 && (
          <p className="text-xs text-muted-foreground p-2">
            {resources.loading ? 'Carregando as etiquetas…' : 'Nenhuma etiqueta cadastrada. Crie em Configurações → Etiquetas.'}
          </p>
        )}
        {[...resources.labels.map(l => l.title), ...missing].map(title => (
          <label key={title} className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-muted/50 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(title)}
              onChange={() => toggle(title)}
              className="h-4 w-4 accent-primary"
            />
            <span className="truncate">{title}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Janela de configuração de um bloco: rascunho local, só aplica em "Salvar".
// O fluxo inteiro só vai pro servidor no Salvar do topo do canvas.
export function FlowNodeConfigModal({ node, resources, onClose, onSave }: Props) {
  const [label, setLabel] = useState(node?.label || '');
  const [config, setConfig] = useState<FlowNodeConfig>(node?.config || {});
  const [problem, setProblem] = useState<string | null>(null);

  React.useEffect(() => {
    setLabel(node?.label || '');
    setConfig(node?.config || {});
    setProblem(null);
  }, [node?.id]);

  if (!node) return null;
  const activeNode = node; // const próprio pra narrowing sobreviver dentro das funções aninhadas
  const title = blockLabel(activeNode);
  const hidden = !isVisibleNode(activeNode);

  const set = (key: string, value: unknown) => setConfig(c => ({ ...c, [key]: value }));

  function conditionFields(kind: 'condition' | 'filter_label') {
    const criterion = criterionOf(config);
    const legacy = LEGACY_CRITERIA_LABELS[criterion];
    const currentLabel = labelOf(config);
    return (
      <>
        <div className="space-y-1">
          <Label className="text-xs">{kind === 'condition' ? 'Se' : 'Só continua se'}</Label>
          <Seletor
            value={criterion}
            onChange={e => setConfig(configForCriterion(kind, e.target.value))}
            className={fieldClass}
            aria-label="Critério"
          >
            {legacy && <option value={criterion}>{legacy}</option>}
            {CONDITION_CRITERIA.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Seletor>
          {legacy && (
            <p className="text-xs text-amber-600">
              Este critério não é mais oferecido, mas continua valendo. Pra trocar, escolha outro na lista.
            </p>
          )}
        </div>
        {criterion === 'replied' && (
          <div className="space-y-1">
            <Label className="text-xs">Olhar as últimas quantas horas</Label>
            <Input
              type="number"
              min={1}
              className="w-24"
              value={(config.window_hours as number) ?? 24}
              onChange={e => set('window_hours', Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        )}
        {criterion === 'has_label' && (
          <div className="space-y-1">
            <Label className="text-xs">Etiqueta</Label>
            <Seletor
              value={currentLabel}
              onChange={e => setConfig(c => withLabel(kind, c, e.target.value))}
              className={fieldClass}
              aria-label="Etiqueta"
            >
              <option value="">Escolha a etiqueta</option>
              {currentLabel && !resources.labels.some(l => l.title === currentLabel) && (
                <option value={currentLabel}>{currentLabel}</option>
              )}
              {resources.labels.map(l => (
                <option key={l.id} value={l.title}>{l.title}</option>
              ))}
            </Seletor>
          </div>
        )}
        {criterion === 'at_stage' && (
          <div className="space-y-1">
            <Label className="text-xs">Etapa</Label>
            <StagePicker value={String(config.stage_id ?? '')} onPick={id => set('stage_id', id)} resources={resources} />
          </div>
        )}
        {criterion === 'form_answer' && (
          <FormAnswerPicker value={formAnswerOf(config)} onChange={next => setConfig(next)} />
        )}
        {kind === 'filter_label' && (
          <p className="text-xs text-muted-foreground">Se não passar, o fluxo para aqui pra esse lead.</p>
        )}
      </>
    );
  }

  function renderFields() {
    if (hidden) {
      return <p className="text-sm text-muted-foreground">{HIDDEN_BLOCK_NOTICE}. Ele continua no fluxo como estava.</p>;
    }
    switch (activeNode.kind) {
      case 'send_whatsapp': {
        const envio = sendFromOf(config);
        return (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                rows={4}
                value={(config.text as string) || ''}
                onChange={e => set('text', e.target.value)}
                placeholder="Oi {{first_name}}, tudo bem?"
              />
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                <span className="text-xs text-muted-foreground mr-1">Inserir variável:</span>
                {FLOW_MESSAGE_VARS.map(v => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => set('text', `${(config.text as string) || ''}${v.token}`)}
                    className="text-xs px-2 py-0.5 rounded-full border border-input bg-muted/40 hover:bg-muted transition-colors"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <SendFromField
              scope="lead_automation_rules"
              value={envio}
              onChange={v => setConfig(c => applySendFrom(c, v))}
            />
            <p className="text-xs text-muted-foreground">A mensagem sai marcada como automática, igual o Follow-up.</p>
          </>
        );
      }
      case 'add_label':
      case 'remove_label':
        return (
          <LabelChecklist
            selected={Array.isArray(config.labels) ? (config.labels as string[]) : []}
            onChange={next => set('labels', next)}
            resources={resources}
          />
        );
      case 'move_stage':
        return (
          <div className="space-y-1">
            <Label className="text-xs">Mover para a etapa</Label>
            <StagePicker value={String(config.stage_id ?? '')} onPick={id => set('stage_id', id)} resources={resources} />
          </div>
        );
      case 'wait': {
        const mode = (config.mode as string) || 'interval';
        return (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Esperar</Label>
              <Seletor value={mode} onChange={e => set('mode', e.target.value)} className={fieldClass} aria-label="Como esperar">
                {WAIT_MODES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </Seletor>
            </div>
            {mode === 'date' ? (
              <div className="space-y-1">
                <Label className="text-xs">Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInput(config.target_at)}
                  onChange={e => set('target_at', e.target.value ? new Date(e.target.value).toISOString() : '')}
                />
                <p className="text-xs text-muted-foreground">Se a data já passou, o fluxo segue na hora.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Quanto tempo</Label>
                <DurationField minutes={config.minutes ?? 1440} onChange={m => set('minutes', m)} label="Quanto tempo" />
                {mode === 'schedule' && (
                  <p className="text-xs text-muted-foreground">
                    Se o tempo acabar fora do horário comercial (segunda a sexta, das 8h às 18h), o fluxo segue no próximo horário comercial.
                  </p>
                )}
              </div>
            )}
          </>
        );
      }
      case 'wait_for_reply': {
        const indefinite = config.indefinite === true;
        return (
          <>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="flow-wait-reply-mode"
                  checked={!indefinite}
                  onChange={() => setConfig(c => ({ ...c, indefinite: false, minutes: Number(c.minutes) > 0 ? c.minutes : 30 }))}
                  className="h-4 w-4 accent-primary"
                />
                Esperar até
              </label>
              {!indefinite && (
                <div className="pl-6">
                  <DurationField minutes={config.minutes ?? 1440} onChange={m => set('minutes', m)} label="Prazo" />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="flow-wait-reply-mode"
                  checked={indefinite}
                  onChange={() => set('indefinite', true)}
                  className="h-4 w-4 accent-primary"
                />
                Sem limite (espera até o lead responder)
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{WAIT_FOR_REPLY_HELP}</p>
            <p className="text-xs text-muted-foreground">
              {indefinite
                ? 'Sem limite, o bloco só tem a saída Respondeu.'
                : 'Duas saídas: Respondeu, assim que o lead responder (em até 1 minuto), e Não respondeu, quando o prazo acabar.'}
            </p>
          </>
        );
      }
      case 'condition':
        return conditionFields('condition');
      case 'filter_label':
        return conditionFields('filter_label');
      // Ação das Automações: o MESMO editor da tela de regras, gravando
      // `{ action_type, params }` (leadAction.ts).
      case 'lead_action':
        return (
          <ActionEditor
            action={leadActionOf(config)}
            onChange={next => setConfig(leadActionConfig(next))}
            resources={resources}
          />
        );
      default:
        return <p className="text-xs text-muted-foreground">Sem configuração adicional.</p>;
    }
  }

  const save = () => {
    // Mesma régua do cartão e da chave de ligar (readiness.ts).
    const issue = nodeProblem({ kind: activeNode.kind, config });
    if (issue) {
      setProblem(issue);
      return;
    }
    onSave(activeNode.id, { label, config });
  };

  return (
    <Dialog open={!!node} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!hidden && (
            <div className="space-y-1">
              <Label className="text-xs">Apelido do bloco (opcional)</Label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder={title} />
            </div>
          )}
          {renderFields()}
          {problem && <p className="text-xs text-destructive" role="alert">{problem}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{hidden ? 'Fechar' : 'Cancelar'}</Button>
          {!hidden && <Button onClick={save}>Salvar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
