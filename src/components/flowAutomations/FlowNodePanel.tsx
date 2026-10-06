import React, { useRef, useState } from 'react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import SendFromField from '@/components/numbers/SendFromField';
import { applySendFrom, sendFromOf } from '@/features/numbers/sendFrom';
import type { FlowAutomationKind, FlowAutomationNode, FlowNodeConfig } from '@/types/flowAutomations';
import { ActionEditor, type AutomationResources } from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
import { HIDDEN_BLOCK_NOTICE, blockGroup, blockLabel, isVisibleNode } from '@/features/flowAutomations/palette';
import { blockDescription, blockIcon } from '@/features/flowAutomations/blockInfo';
import { nodeColor } from '@/lib/flowAutomationGraph';
import { cn } from '@/lib/utils';
import { mesmoConteudo } from '@/hooks/useAlteracoesNaoSalvas';
import { isFlowOnlyLeadAction, leadActionConfig, leadActionOf } from '@/features/flowAutomations/leadAction';
import { nodeProblem } from '@/features/flowAutomations/readiness';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import {
  SECONDS_UNITS, WAIT_FOR_REPLY_HELP, WAIT_UNITS, joinMinutes, joinSeconds, splitMinutes, splitSeconds, waitHasSeconds,
  waitTotalSeconds, type SecondsUnit, type WaitUnit,
} from '@/features/flowAutomations/waitTime';
import { guideRequiredProblem, stepLabel } from '@/features/flowAutomations/guide';
import {
  CONDITION_CRITERIA,
  LEGACY_CRITERIA_LABELS,
  configForCriterion,
  criterionOf,
  labelOf,
  withLabel,
} from '@/features/flowAutomations/conditions';
import { formAnswerOf } from '@/features/flowAutomations/formAnswer';
import {
  BUSINESS_HOURS_LABEL,
  BUSINESS_HOURS_WAIT_HELP,
  waitModeOf,
  waitUsesBusinessHours,
  withWaitBusinessHours,
} from '@/features/flowAutomations/businessHours';
import { cleanProgressPrefix, progressOf, progressTagName, withProgress } from '@/features/flowAutomations/progress';
import { RECOVERED_EFFECTS } from '@/features/flowAutomations/recovered';
import { moveStageModeOf, stageNameOf, withMoveStageMode, withStageName } from '@/features/flowAutomations/moveStage';
import { FormAnswerPicker } from './FormAnswerPicker';
import { FlowSidePanel } from './FlowSidePanel';
import { FunnelMessageFields, hasRichMessage } from './FunnelMessageFields';
import { BOOK_HELP, BOOK_LABEL, usesBook, withBook } from '@/features/flowAutomations/book';
import { VariableChipBar } from './VariableChipBar';

interface Props {
  node: FlowAutomationNode | null;
  resources: AutomationResources;
  onClose: () => void;
  onSave: (id: string, patch: { label: string; config: FlowNodeConfig }) => void;
  /** Avisa o canvas quando o rascunho do painel difere do bloco (pra perguntar antes de descartar). */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Sprint 4: o tipo do fluxo. No funil de conversa a mensagem pode ser mídia ou
   * contato e sai pelo número da conversa; o Esperar fala em segundos.
   */
  flowKind?: FlowAutomationKind;
  /** Modo guiado (o corretor): sem apelido do bloco nem opções que o servidor não deixa mudar. */
  guided?: boolean;
  /** Salvando no servidor (o passo do guia grava na hora). */
  saving?: boolean;
}

// "Por um tempo, saindo só em horário comercial" (o modo `schedule`) virou a
// caixa "Só em horário comercial" do modo Por um tempo (sprint 3).
const WAIT_MODES = [
  { value: 'interval', label: 'Por um tempo' },
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

// Esperar do funil de conversa (sprint 4): segundos, minutos ou horas.
function SecondsField({ config, onChange }: { config: FlowNodeConfig; onChange: (next: { minutes: number; seconds: number }) => void }) {
  const { amount, unit } = splitSeconds(waitTotalSeconds(config) || 5);
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        className="w-24"
        value={amount}
        onChange={e => onChange(joinSeconds(e.target.value, unit))}
        aria-label="Quanto tempo"
      />
      <Seletor
        value={unit}
        onChange={e => onChange(joinSeconds(amount, e.target.value as SecondsUnit))}
        className="w-32"
        aria-label="Unidade"
      >
        {SECONDS_UNITS.map(u => (
          <option key={u.value} value={u.value}>{u.label}</option>
        ))}
      </Seletor>
    </div>
  );
}

function BusinessHoursCheck({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        {BUSINESS_HOURS_LABEL}
      </label>
      {checked && <p className="pl-6 text-xs text-muted-foreground">{BUSINESS_HOURS_WAIT_HELP}</p>}
    </div>
  );
}

function ProgressFields({ config, onChange }: { config: FlowNodeConfig; onChange: (next: FlowNodeConfig) => void }) {
  const mark = progressOf(config);
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={mark.on}
          onChange={e => onChange(withProgress(config, { ...mark, on: e.target.checked }))}
          className="h-4 w-4 accent-primary"
        />
        Marcar progresso
      </label>
      {mark.on && (
        <div className="pl-6 space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nome da etiqueta</Label>
              <Input
                value={mark.prefix}
                onChange={e => onChange(withProgress(config, { ...mark, prefix: cleanProgressPrefix(e.target.value) }))}
                placeholder="follow-up-longo"
                aria-label="Nome da etiqueta de progresso"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mensagem nº</Label>
              <Input
                type="number"
                min={1}
                className="w-20"
                value={mark.step}
                onChange={e => onChange(withProgress(config, { ...mark, step: Number(e.target.value) || 1 }))}
                aria-label="Número da mensagem"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Quando esta mensagem sai, o lead ganha a etiqueta{' '}
            <strong>{progressTagName(mark.prefix || 'nome', mark.step)}</strong> e perde a da mensagem anterior. É ela que
            faz o lead que volta ao fluxo continuar de onde parou.
          </p>
        </div>
      )}
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

// Painel lateral de um bloco (sprint 4; antes era uma janela): rascunho local,
// só aplica em "Salvar". O fluxo inteiro só vai pro servidor no Salvar do topo
// do canvas.
export function FlowNodePanel({ node, resources, onClose, onSave, onDirtyChange, flowKind = 'automation', guided = false, saving = false }: Props) {
  const roletaObrigatoria = useClientToggle('roleta_nova');
  const [label, setLabel] = useState(node?.label || '');
  const [config, setConfig] = useState<FlowNodeConfig>(node?.config || {});
  const [problem, setProblem] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setLabel(node?.label || '');
    setConfig(node?.config || {});
    setProblem(null);
  }, [node?.id]);

  // O rascunho mudou alguma coisa do bloco? (o canvas pergunta antes de descartar)
  const dirty = !!node && !mesmoConteudo({ label: label || '', config }, { label: node.label || '', config: node.config || {} });
  React.useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps -- só quando muda
  React.useEffect(() => () => onDirtyChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps -- ao fechar

  if (!node) return null;
  const activeNode = node; // const próprio pra narrowing sobreviver dentro das funções aninhadas
  const title = blockLabel(activeNode);
  const hidden = !isVisibleNode(activeNode);

  const set = (key: string, value: unknown) => setConfig(c => ({ ...c, [key]: value }));
  const isConversation = flowKind === 'conversation';
  const guide = activeNode.guide ?? null;

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
        // Funil de conversa (sprint 4): texto, mídia ou contato, pelo número da conversa.
        if (isConversation) {
          return <FunnelMessageFields config={config} onChange={setConfig} conversation />;
        }
        if (hasRichMessage(node?.config ?? {})) {
          return (
            <>
              <FunnelMessageFields config={config} onChange={setConfig} />
              <SendFromField
                scope="lead_automation_rules"
                value={envio}
                onChange={v => setConfig(c => applySendFrom(c, v))}
              />
            </>
          );
        }
        return (
          <>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="flow-node-message">Mensagem</Label>
              <p className="text-xs text-muted-foreground">
                Toque numa variável pra pôr o dado do lead no texto, onde o cursor estiver.
              </p>
              <Textarea
                id="flow-node-message"
                ref={messageRef}
                rows={8}
                className="min-h-[180px]"
                value={(config.text as string) || ''}
                onChange={e => set('text', e.target.value)}
                placeholder="Oi {{nome}}, tudo bem?"
              />
              <VariableChipBar
                targetRef={messageRef}
                value={(config.text as string) || ''}
                onChange={next => set('text', next)}
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={usesBook(config)}
                  onChange={e => setConfig(c => withBook(c, e.target.checked))}
                />
                {BOOK_LABEL}
              </label>
              <p className="pl-6 text-xs text-muted-foreground">{BOOK_HELP}</p>
            </div>
            <SendFromField
              scope="lead_automation_rules"
              value={envio}
              onChange={v => setConfig(c => applySendFrom(c, v))}
            />
            <ProgressFields config={config} onChange={setConfig} />
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
      case 'move_stage': {
        const stageMode = moveStageModeOf(config);
        return (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="flow-move-stage-mode"
                checked={stageMode === 'stage'}
                onChange={() => setConfig(c => withMoveStageMode(c, 'stage'))}
                className="h-4 w-4 accent-primary"
              />
              Uma etapa específica
            </label>
            {stageMode === 'stage' && (
              <div className="pl-6">
                <StagePicker value={String(config.stage_id ?? '')} onPick={id => set('stage_id', id)} resources={resources} />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="flow-move-stage-mode"
                checked={stageMode === 'name'}
                onChange={() => setConfig(c => withMoveStageMode(c, 'name'))}
                className="h-4 w-4 accent-primary"
              />
              Coluna com este nome no funil do card
            </label>
            {stageMode === 'name' && (
              <div className="pl-6 space-y-1">
                <Input
                  value={stageNameOf(config)}
                  onChange={e => setConfig(c => withStageName(c, e.target.value))}
                  placeholder="Em atendimento"
                  aria-label="Nome da coluna"
                />
                <p className="text-xs text-muted-foreground">
                  O card vai pra coluna com esse nome no funil em que ele está (sem ligar pra acento e maiúscula). Se o
                  funil do card não tiver essa coluna, ele não sai do lugar.
                </p>
              </div>
            )}
          </div>
        );
      }
      case 'followup_recovered':
        return (
          <div className="space-y-2 text-sm">
            <p>Faz o que o follow-up faz quando o lead responde:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {RECOVERED_EFFECTS.map(effect => <li key={effect}>{effect}</li>)}
            </ul>
            <p className="text-xs text-muted-foreground">Use no caminho Respondeu do Aguardar resposta.</p>
          </div>
        );
      case 'hand_to_ai':
      case 'disable_ai':
        return <p className="text-sm">{blockDescription(activeNode)}</p>;
      case 'wait': {
        const mode = waitModeOf(config);
        // Funil de conversa (sprint 4): só "por um tempo", em segundos (é conversa ao vivo).
        if (isConversation || waitHasSeconds(config)) {
          return (
            <div className="space-y-1">
              <Label className="text-xs">Quanto tempo esperar antes da próxima mensagem</Label>
              <SecondsField config={config} onChange={next => setConfig(c => ({ ...c, mode: 'interval', ...next }))} />
              <p className="text-xs text-muted-foreground">
                Esperas de até 2 minutos acontecem na hora; as maiores podem atrasar até 1 minuto.
              </p>
            </div>
          );
        }
        return (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Esperar</Label>
              <Seletor value={mode} onChange={e => setConfig(c => ({ ...c, mode: e.target.value }))} className={fieldClass} aria-label="Como esperar">
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
                <BusinessHoursCheck
                  checked={waitUsesBusinessHours(config)}
                  onChange={on => setConfig(c => withWaitBusinessHours(c, on))}
                />
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
                <div className="pl-6 space-y-2">
                  <DurationField minutes={config.minutes ?? 1440} onChange={m => set('minutes', m)} label="Prazo" />
                  <BusinessHoursCheck
                    checked={waitUsesBusinessHours(config)}
                    onChange={on => setConfig(c => withWaitBusinessHours(c, on))}
                  />
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
        // Ação só do construtor (Marcar follow-up encerrado): sem campos e SEM o
        // editor das regras, que não conhece a ação e trocaria o `action_type`
        // por vazio (o servidor recusa o fluxo inteiro). A config volta intacta.
        if (isFlowOnlyLeadAction(config.action_type)) {
          return <p className="text-xs text-muted-foreground">Sem configuração adicional.</p>;
        }
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
    // "Mover de etapa" com o `stage_slug` dos modelos antigos: salvar grava
    // como `stage_name`, que é o que o motor lê.
    const finalConfig = activeNode.kind === 'move_stage' && moveStageModeOf(config) === 'name'
      ? withStageName(config, stageNameOf(config))
      : config;
    // Mesma régua do cartão e da chave de ligar (readiness.ts), e o que o passo
    // do guia pede (sprint 4).
    const issue = nodeProblem({ kind: activeNode.kind, config: finalConfig }, { roletaObrigatoria }) ?? guideRequiredProblem(guide, finalConfig);
    if (issue) {
      setProblem(issue);
      return;
    }
    onSave(activeNode.id, { label, config: finalConfig });
  };

  return (
    <FlowSidePanel
      testId="painel-do-bloco"
      title={title}
      description={hidden ? undefined : blockDescription(activeNode)}
      icon={blockIcon(activeNode)}
      color={hidden ? '#94a3b8' : nodeColor(activeNode.kind, blockGroup(activeNode))}
      onClose={onClose}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>{hidden ? 'Fechar' : 'Cancelar'}</Button>
          {!hidden && <Button onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>}
        </>
      )}
    >
      <div className="space-y-5">
        {guide && (
          <div
            data-testid="dica-do-passo"
            className={cn(
              'rounded-md border px-3 py-2 text-sm',
              guide.done ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-400/60 bg-amber-400/10',
            )}
          >
            <p className="font-semibold">
              {guide.done ? '✓ ' : ''}{stepLabel(guide)} — {guide.title}
            </p>
            {guide.hint && <p className="mt-0.5 text-xs text-muted-foreground">Dica: {guide.hint}</p>}
            {!guide.done && <p className="mt-1 text-xs text-muted-foreground">Quando terminar, clique em Salvar: o passo fica feito.</p>}
          </div>
        )}
        {renderFields()}
        {!hidden && !guided && (
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="flow-node-label">Apelido do bloco (opcional)</Label>
            <Input id="flow-node-label" value={label} onChange={e => setLabel(e.target.value)} placeholder={title} />
            <p className="text-xs text-muted-foreground">Aparece no cartão no lugar do nome do bloco.</p>
          </div>
        )}
        {problem && <p className="text-xs text-destructive" role="alert">{problem}</p>}
      </div>
    </FlowSidePanel>
  );
}
