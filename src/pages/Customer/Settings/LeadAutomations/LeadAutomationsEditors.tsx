import { useEffect, useState } from 'react';
import { Input, Label as UILabel, Textarea } from '@evoapi/design-system';

import { labelsService } from '@/services/contacts/labelsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import usersService from '@/services/users/usersService';
import { quickRepliesService } from '@/services/quickReplies/quickRepliesService';
import { followupSequencesService, FollowupSequence } from '@/services/followupSequences/followupSequencesService';
import type { Label as ContactLabel } from '@/types/settings/labels';
import type { Pipeline, PipelineStage } from '@/types/analytics/pipelines';
import type { User } from '@/types/users';
import type { QuickReply } from '@/types/knowledge';
import type {
  LeadAutomationCondition,
  LeadAutomationAction,
} from '@/services/leadAutomation/leadAutomationService';

// ============================================================================
// Catálogos por gatilho/ação
// ============================================================================

const TRIGGERS_WITH_CONDITION = new Set([
  'lead.tag_added',
  'lead.no_reply_after',
  'lead.message_received',
  'lead.stage_changed',
]);

export const triggerNeedsCondition = (trigger: string): boolean =>
  TRIGGERS_WITH_CONDITION.has(trigger);

// Ações cujo `params` é obrigatório pra automação fazer sentido.
const ACTIONS_REQUIRING_PARAMS: Record<string, string[]> = {
  send_whatsapp_message:   ['message'],
  send_audio:              ['media_url'],
  send_image:              ['media_url'],
  send_video:              ['media_url'],
  wait:                    ['duration', 'unit'],
  start_followup_sequence: ['sequence_id'],
  assign_broker:           ['broker_id'],
  add_label:               ['label'],
  remove_label:            ['label'],
  move_pipeline_stage:     ['stage_id'],
  create_task:             ['title'],
  notify_group:            ['group_id', 'message'],
  send_quick_reply:        ['quick_reply_id'],
};

// ============================================================================
// Resources (lookup pra dropdowns)
// ============================================================================

export interface AutomationResources {
  labels: ContactLabel[];
  sequences: FollowupSequence[];
  users: User[];
  pipelines: Pipeline[];
  stagesByPipeline: Record<string, PipelineStage[]>;
  quickReplies: QuickReply[];
  loading: boolean;
}

export function useAutomationResources(enabled: boolean): AutomationResources {
  const [labels, setLabels] = useState<ContactLabel[]>([]);
  const [sequences, setSequences] = useState<FollowupSequence[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, PipelineStage[]>>({});
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [labelsRes, seqRes, usersRes, pipelinesRes, qrRes] = await Promise.allSettled([
        labelsService.getLabels(),
        followupSequencesService.getAll(),
        usersService.getUsers(),
        pipelinesService.getPipelines(),
        quickRepliesService.getQuickReplies(),
      ]);

      if (cancelled) return;

      if (labelsRes.status === 'fulfilled') setLabels(labelsRes.value.data ?? []);
      if (seqRes.status === 'fulfilled') setSequences(seqRes.value ?? []);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data ?? []);
      if (qrRes.status === 'fulfilled') setQuickReplies(qrRes.value.data ?? []);

      if (pipelinesRes.status === 'fulfilled') {
        const list = pipelinesRes.value.data ?? [];
        setPipelines(list);

        const stageResults = await Promise.allSettled(
          list.map(p => pipelinesService.getPipelineStages(p.id)),
        );
        if (cancelled) return;
        const map: Record<string, PipelineStage[]> = {};
        stageResults.forEach((r, i) => {
          if (r.status === 'fulfilled') map[list[i].id] = r.value.data ?? [];
        });
        setStagesByPipeline(map);
      }

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  return { labels, sequences, users, pipelines, stagesByPipeline, quickReplies, loading };
}

// ============================================================================
// ConditionEditor — campo específico por trigger
// ============================================================================

interface ConditionEditorProps {
  trigger: string;
  condition: LeadAutomationCondition | null;
  onChange: (next: LeadAutomationCondition | null) => void;
  resources: AutomationResources;
}

const baseSelectClass =
  'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export function ConditionEditor({ trigger, condition, onChange, resources }: ConditionEditorProps) {
  if (!triggerNeedsCondition(trigger)) return null;

  // --- lead.tag_added ---
  if (trigger === 'lead.tag_added') {
    const value = typeof condition?.value === 'string' ? condition.value : '';
    return (
      <div>
        <UILabel>Qual etiqueta? *</UILabel>
        <select
          value={value}
          onChange={e =>
            onChange({ field: 'tag', operator: 'equals', value: e.target.value })
          }
          className={baseSelectClass}
        >
          <option value="">Selecione uma etiqueta</option>
          {resources.labels.map(l => (
            <option key={l.id} value={l.title}>{l.title}</option>
          ))}
        </select>
        {resources.labels.length === 0 && !resources.loading && (
          <p className="text-xs text-muted-foreground mt-1">
            Nenhuma etiqueta cadastrada. Crie em Configurações &rarr; Etiquetas.
          </p>
        )}
      </div>
    );
  }

  // --- lead.no_reply_after ---
  if (trigger === 'lead.no_reply_after') {
    const raw = typeof condition?.value === 'string' ? condition.value : '24h';
    const m = raw.match(/^(\d+)\s*(m|h|d)?$/i);
    const num = m ? parseInt(m[1], 10) : 24;
    const unit = (m?.[2]?.toLowerCase() ?? 'h') as 'm' | 'h' | 'd';
    const commit = (n: number, u: string) =>
      onChange({ field: 'duration', operator: 'gte', value: `${n}${u}` });
    return (
      <div>
        <UILabel>Sem resposta por *</UILabel>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <Input
            type="number"
            min={1}
            value={num}
            onChange={e => commit(parseInt(e.target.value) || 1, unit)}
          />
          <select
            value={unit}
            onChange={e => commit(num, e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="m">minutos</option>
            <option value="h">horas</option>
            <option value="d">dias</option>
          </select>
        </div>
      </div>
    );
  }

  // --- lead.message_received ---
  if (trigger === 'lead.message_received') {
    const value = typeof condition?.value === 'string' ? condition.value : '';
    return (
      <div>
        <UILabel>Palavra-chave (opcional)</UILabel>
        <Input
          value={value}
          onChange={e =>
            onChange(
              e.target.value
                ? { field: 'keyword', operator: 'contains', value: e.target.value }
                : null,
            )
          }
          placeholder="Ex: visita, agendar, preço…"
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Em branco = dispara em qualquer mensagem recebida.
        </p>
      </div>
    );
  }

  // --- lead.stage_changed ---
  if (trigger === 'lead.stage_changed') {
    const value = typeof condition?.value === 'string' ? condition.value : '';
    const allStages = Object.entries(resources.stagesByPipeline).flatMap(
      ([pid, stages]) => stages.map(s => ({
        ...s,
        pipelineName: resources.pipelines.find(p => p.id === pid)?.name ?? '',
      })),
    );
    return (
      <div>
        <UILabel>Para qual estágio? *</UILabel>
        <select
          value={value}
          onChange={e =>
            onChange({ field: 'stage_id', operator: 'equals', value: e.target.value })
          }
          className={baseSelectClass}
        >
          <option value="">Selecione um estágio</option>
          {allStages.map(s => (
            <option key={s.id} value={s.id}>
              {s.pipelineName} &rarr; {s.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return null;
}

// ============================================================================
// ActionEditor — params específicos por action.type
// ============================================================================

interface ActionEditorProps {
  action: LeadAutomationAction;
  onChange: (next: LeadAutomationAction) => void;
  resources: AutomationResources;
}

export function ActionEditor({ action, onChange, resources }: ActionEditorProps) {
  const params = (action.params ?? {}) as Record<string, string | number>;
  const setParam = (key: string, value: string | number) =>
    onChange({ ...action, params: { ...params, [key]: value } });

  switch (action.type) {
    // ----- start_followup_sequence -----
    case 'start_followup_sequence':
      return (
        <Field label="Sequência de follow-up *">
          <select
            value={String(params.sequence_id ?? '')}
            onChange={e => setParam('sequence_id', e.target.value)}
            className={baseSelectClass}
          >
            <option value="">Selecione uma sequência</option>
            {resources.sequences.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{!s.is_active ? ' (inativa)' : ''}
              </option>
            ))}
          </select>
        </Field>
      );

    // ----- send_whatsapp_message -----
    case 'send_whatsapp_message':
      return (
        <Field label="Mensagem *" hint="Use {{nome}} pra personalizar com o nome do lead.">
          <Textarea
            value={String(params.message ?? '')}
            onChange={e => setParam('message', e.target.value)}
            placeholder="Olá {{nome}}, tudo bem?"
            rows={3}
            className="mt-1 resize-none"
          />
        </Field>
      );

    // ----- send_audio / send_image / send_video -----
    case 'send_audio':
    case 'send_image':
    case 'send_video':
      return (
        <>
          <Field label="URL da mídia *">
            <Input
              value={String(params.media_url ?? '')}
              onChange={e => setParam('media_url', e.target.value)}
              placeholder="https://..."
              className="mt-1"
            />
          </Field>
          {action.type !== 'send_audio' && (
            <Field label="Legenda">
              <Input
                value={String(params.caption ?? '')}
                onChange={e => setParam('caption', e.target.value)}
                placeholder="Opcional"
                className="mt-1"
              />
            </Field>
          )}
        </>
      );

    // ----- wait -----
    case 'wait': {
      const dur = Number(params.duration ?? 1);
      const unit = String(params.unit ?? 'hours');
      return (
        <Field label="Aguardar *">
          <div className="grid grid-cols-2 gap-2 mt-1">
            <Input
              type="number"
              min={1}
              value={dur}
              onChange={e =>
                onChange({
                  ...action,
                  params: { ...params, duration: parseInt(e.target.value) || 1, unit },
                })
              }
            />
            <select
              value={unit}
              onChange={e =>
                onChange({
                  ...action,
                  params: { ...params, duration: dur, unit: e.target.value },
                })
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="minutes">minutos</option>
              <option value="hours">horas</option>
              <option value="days">dias</option>
            </select>
          </div>
        </Field>
      );
    }

    // ----- assign_broker -----
    case 'assign_broker':
      return (
        <Field label="Corretor *">
          <select
            value={String(params.broker_id ?? '')}
            onChange={e => setParam('broker_id', e.target.value)}
            className={baseSelectClass}
          >
            <option value="">Selecione um corretor</option>
            {resources.users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </Field>
      );

    // ----- add_label / remove_label -----
    case 'add_label':
    case 'remove_label':
      return (
        <Field label="Etiqueta *">
          <select
            value={String(params.label ?? '')}
            onChange={e => setParam('label', e.target.value)}
            className={baseSelectClass}
          >
            <option value="">Selecione uma etiqueta</option>
            {resources.labels.map(l => (
              <option key={l.id} value={l.title}>{l.title}</option>
            ))}
          </select>
        </Field>
      );

    // ----- move_pipeline_stage -----
    case 'move_pipeline_stage': {
      const pipelineId = String(params.pipeline_id ?? '');
      const stageId = String(params.stage_id ?? '');
      return (
        <>
          <Field label="Pipeline *">
            <select
              value={pipelineId}
              onChange={e =>
                onChange({
                  ...action,
                  params: { ...params, pipeline_id: e.target.value, stage_id: '' },
                })
              }
              className={baseSelectClass}
            >
              <option value="">Selecione um pipeline</option>
              {resources.pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          {pipelineId && (
            <Field label="Estágio *">
              <select
                value={stageId}
                onChange={e => setParam('stage_id', e.target.value)}
                className={baseSelectClass}
              >
                <option value="">Selecione um estágio</option>
                {(resources.stagesByPipeline[pipelineId] ?? []).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          )}
        </>
      );
    }

    // ----- create_task -----
    case 'create_task':
      return (
        <>
          <Field label="Título da tarefa *">
            <Input
              value={String(params.title ?? '')}
              onChange={e => setParam('title', e.target.value)}
              placeholder="Ex: Ligar pro lead"
              className="mt-1"
            />
          </Field>
          <Field label="Prazo (em horas)">
            <Input
              type="number"
              min={0}
              value={Number(params.due_in_hours ?? 24)}
              onChange={e => setParam('due_in_hours', parseInt(e.target.value) || 0)}
              className="mt-1"
            />
          </Field>
        </>
      );

    // ----- notify_group -----
    case 'notify_group':
      return (
        <>
          <Field label="ID do grupo WhatsApp *" hint="JID do grupo (ex: 5511999999999-160…@g.us)">
            <Input
              value={String(params.group_id ?? '')}
              onChange={e => setParam('group_id', e.target.value)}
              placeholder="…@g.us"
              className="mt-1"
            />
          </Field>
          <Field label="Mensagem *">
            <Textarea
              value={String(params.message ?? '')}
              onChange={e => setParam('message', e.target.value)}
              rows={3}
              className="mt-1 resize-none"
            />
          </Field>
        </>
      );

    // ----- send_quick_reply -----
    case 'send_quick_reply':
      return (
        <Field label="Resposta rápida *">
          <select
            value={String(params.quick_reply_id ?? '')}
            onChange={e => setParam('quick_reply_id', e.target.value)}
            className={baseSelectClass}
          >
            <option value="">Selecione uma resposta rápida</option>
            {resources.quickReplies.map(q => (
              <option key={q.id} value={q.id}>{q.title}</option>
            ))}
          </select>
        </Field>
      );

    default:
      return null;
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2">
      <UILabel>{label}</UILabel>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// ============================================================================
// Validação
// ============================================================================

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateRule(
  trigger: string,
  conditions: LeadAutomationCondition[],
  actions: LeadAutomationAction[],
): ValidationResult {
  if (triggerNeedsCondition(trigger)) {
    // message_received é o único onde a condição é opcional (keyword vazia = qualquer msg).
    const isOptional = trigger === 'lead.message_received';
    const hasValue =
      conditions.length > 0 &&
      conditions[0].value !== '' &&
      conditions[0].value !== undefined;
    if (!hasValue && !isOptional) {
      return {
        ok: false,
        error: `Esse gatilho exige uma condição (campo obrigatório acima).`,
      };
    }
  }

  for (const action of actions) {
    const required = ACTIONS_REQUIRING_PARAMS[action.type] ?? [];
    for (const key of required) {
      const value = action.params?.[key];
      if (value === undefined || value === '' || value === null) {
        return {
          ok: false,
          error: `Preencha "${key}" na ação "${action.type}".`,
        };
      }
    }
  }

  return { ok: true };
}

// ============================================================================
// Summaries (lista expandida)
// ============================================================================

export function formatConditionSummary(
  trigger: string,
  condition: LeadAutomationCondition,
  resources: AutomationResources,
): string {
  if (trigger === 'lead.tag_added') {
    return `Etiqueta: ${condition.value}`;
  }
  if (trigger === 'lead.no_reply_after') {
    return `Sem resposta por: ${condition.value}`;
  }
  if (trigger === 'lead.message_received') {
    return `Contém: "${condition.value}"`;
  }
  if (trigger === 'lead.stage_changed') {
    const allStages = Object.values(resources.stagesByPipeline).flat();
    const stage = allStages.find(s => s.id === condition.value);
    return `Para o estágio: ${stage?.name ?? condition.value}`;
  }
  return `${condition.field} ${condition.operator} ${JSON.stringify(condition.value)}`;
}

export function formatActionSummary(
  action: LeadAutomationAction,
  resources: AutomationResources,
): string {
  const p = action.params ?? {};
  switch (action.type) {
    case 'start_followup_sequence': {
      const seq = resources.sequences.find(s => s.id === p.sequence_id);
      return seq ? `Sequência: ${seq.name}` : 'Sequência: (não definida)';
    }
    case 'send_whatsapp_message':
      return p.message ? `"${String(p.message).slice(0, 60)}…"` : '(mensagem vazia)';
    case 'send_audio':
    case 'send_image':
    case 'send_video':
      return p.media_url ? `Mídia: ${String(p.media_url).slice(0, 40)}…` : '(sem mídia)';
    case 'wait':
      return `${p.duration ?? '?'} ${p.unit ?? ''}`;
    case 'assign_broker': {
      const u = resources.users.find(x => x.id === p.broker_id);
      return u ? `Corretor: ${u.name}` : 'Corretor: (não definido)';
    }
    case 'add_label':
    case 'remove_label':
      return `Etiqueta: ${p.label ?? '(não definida)'}`;
    case 'move_pipeline_stage': {
      const stages = p.pipeline_id ? resources.stagesByPipeline[String(p.pipeline_id)] : undefined;
      const stage = stages?.find(s => s.id === p.stage_id);
      return stage ? `Estágio: ${stage.name}` : 'Estágio: (não definido)';
    }
    case 'create_task':
      return p.title ? `Tarefa: ${p.title}` : '(tarefa sem título)';
    case 'notify_group':
      return p.group_id ? `Grupo: ${String(p.group_id).slice(0, 30)}…` : '(sem grupo)';
    case 'send_quick_reply': {
      const qr = resources.quickReplies.find(q => q.id === p.quick_reply_id);
      return qr ? `Resposta: ${qr.title}` : '(não definida)';
    }
    default:
      return '';
  }
}
