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
import {
  leadAutomationService,
  type LeadAutomationCondition,
  type LeadAutomationAction,
  type AdOrigin,
  type FormOrigin,
} from '@/services/leadAutomation/leadAutomationService';

// ============================================================================
// Catálogos por gatilho/ação
// ============================================================================

// Triggers cujo context emitido tem campos filtraveis (LeadFollowupListener etc).
const TRIGGERS_WITH_CONDITION = new Set([
  'lead.created',
  'lead.campaign_received',
  'lead.tag_added',
  'lead.message_received',
  'lead.stage_changed',
]);

export const triggerNeedsCondition = (trigger: string): boolean =>
  TRIGGERS_WITH_CONDITION.has(trigger);

// Params obrigatórios por action.type — chaves exatas do backend (LeadAutomation::Executor).
const ACTIONS_REQUIRING_PARAMS: Record<string, string[]> = {
  send_whatsapp_message:   ['message'],
  send_audio:              ['media_url'],
  send_image:              ['media_url'],
  send_video:              ['media_url'],
  send_document:           ['media_url'],
  send_sticker:            ['media_url'],
  start_followup_sequence: ['sequence_slug'],
  assign_broker:           ['user_id'],
  add_label:               ['label_id'],
  remove_label:            ['label_id'],
  move_pipeline_stage:     ['stage_id'],
  create_task:             ['title'],
  notify_group:            ['group_jid', 'message'],
  notify_user:             ['user_id', 'message'],
  send_quick_reply:        ['quick_reply_id'],
  notify_broker:           ['message'],
  notify_gestor:           ['message'],
  // assign_via_roleta e wait não têm params obrigatórios
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
  adOrigins: AdOrigin[];
  formOrigins: FormOrigin[];
  loading: boolean;
}

export function useAutomationResources(enabled: boolean): AutomationResources {
  const [labels, setLabels] = useState<ContactLabel[]>([]);
  const [sequences, setSequences] = useState<FollowupSequence[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, PipelineStage[]>>({});
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [adOrigins, setAdOrigins] = useState<AdOrigin[]>([]);
  const [formOrigins, setFormOrigins] = useState<FormOrigin[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [labelsRes, seqRes, usersRes, pipelinesRes, qrRes, adRes, formRes] = await Promise.allSettled([
        labelsService.getLabels(),
        followupSequencesService.getAll(),
        usersService.getUsers(),
        pipelinesService.getPipelines(),
        quickRepliesService.getQuickReplies(),
        leadAutomationService.getAdOrigins(),
        leadAutomationService.getFormOrigins(),
      ]);

      if (cancelled) return;

      if (labelsRes.status === 'fulfilled') setLabels(labelsRes.value.data ?? []);
      if (seqRes.status === 'fulfilled') setSequences(seqRes.value ?? []);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data ?? []);
      if (qrRes.status === 'fulfilled') setQuickReplies(qrRes.value.data ?? []);
      if (adRes.status === 'fulfilled') setAdOrigins(adRes.value ?? []);
      if (formRes.status === 'fulfilled') setFormOrigins(formRes.value ?? []);

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

  return { labels, sequences, users, pipelines, stagesByPipeline, quickReplies, adOrigins, formOrigins, loading };
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

  // --- lead.created ---
  // Origem do lead (opcional). Backend resolve 'source' do ad_referral no Executor:
  // formulario (Meta Lead Ads) | lead_whats_meta (CTWA) | organico.
  // Quando origem = Formulário, dá pra afunilar por form_id (qual formulário).
  // Condição emitida (sempre 1 só, o backend casa por form_id ou por source):
  //   form X selecionado → { form_id eq X }   (já implica formulário)
  //   formulário sem form específico → { source eq formulario }
  //   outras origens → { source eq <origem> }
  if (trigger === 'lead.created') {
    const field = condition?.field;
    const rawValue = typeof condition?.value === 'string' ? condition.value : '';
    const origin = field === 'form_id' ? 'formulario' : (field === 'source' ? rawValue : '');
    const formId = field === 'form_id' ? rawValue : '';

    const commitOrigin = (o: string) => {
      if (!o) return onChange(null);
      onChange({ field: 'source', operator: 'eq', value: o });
    };
    const commitForm = (fid: string) => {
      onChange(fid
        ? { field: 'form_id', operator: 'eq', value: fid }
        : { field: 'source', operator: 'eq', value: 'formulario' });
    };

    return (
      <div className="space-y-2">
        <div>
          <UILabel>Origem do lead (opcional)</UILabel>
          <select value={origin} onChange={e => commitOrigin(e.target.value)} className={baseSelectClass}>
            <option value="">Qualquer origem</option>
            <option value="formulario">Formulário (Meta Lead Ads)</option>
            <option value="lead_whats_meta">Lead Whats Meta (anúncio no WhatsApp)</option>
            <option value="organico">Orgânico (sem anúncio)</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Em branco = qualquer lead novo. <strong>Formulário</strong>: veio de um formulário de anúncio.{' '}
            <strong>Lead Whats Meta</strong>: clicou no anúncio e caiu direto no WhatsApp.
          </p>
        </div>

        {origin === 'formulario' && (
          <div>
            <UILabel>Qual formulário? (opcional)</UILabel>
            <select value={formId} onChange={e => commitForm(e.target.value)} className={baseSelectClass}>
              <option value="">Qualquer formulário</option>
              {resources.formOrigins.map(f => (
                <option key={f.form_id} value={f.form_id}>
                  {(f.form_name || f.form_id)}{f.count > 0 ? ` · ${f.count} lead${f.count === 1 ? '' : 's'}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Em branco = qualquer formulário. Escolha um pra esse fluxo valer só pros leads daquele formulário.
              {resources.formOrigins.length === 0 && ' (Nenhum formulário conectado ainda — veja Configurações → Formulários (Meta).)'}
            </p>
          </div>
        )}
      </div>
    );
  }

  // --- lead.campaign_received (Lead Whats Meta / CTWA) ---
  // Funil por anúncio: filtra por ad_id. O Executor resolve ad_id do ad_referral.
  if (trigger === 'lead.campaign_received') {
    const value = typeof condition?.value === 'string' ? condition.value : '';
    const commit = (v: string) =>
      onChange(v ? { field: 'ad_id', operator: 'eq', value: v } : null);
    const withId = resources.adOrigins.filter(o => o.ad_id);
    return (
      <div className="space-y-2">
        <div>
          <UILabel>Qual anúncio? (opcional)</UILabel>
          <select value={value} onChange={e => commit(e.target.value)} className={baseSelectClass}>
            <option value="">Qualquer anúncio (todo lead que veio de anúncio no WhatsApp)</option>
            {withId.map(o => (
              <option key={o.ad_id!} value={o.ad_id!}>
                {(o.title || o.campaign_name || o.ad_id)} · {o.count} lead{o.count === 1 ? '' : 's'}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Em branco = vale pra qualquer anúncio. Escolha um anúncio pra esse fluxo valer só pra ele.
            {withId.length === 0 && ' (Nenhum anúncio detectado ainda — cole o ID abaixo ou espere chegar lead de anúncio.)'}
          </p>
        </div>
        <div>
          <UILabel>Ou cole o ID do anúncio</UILabel>
          <Input
            value={value}
            onChange={e => commit(e.target.value)}
            placeholder="Ex: 120210..."
            className="mt-1"
          />
        </div>
      </div>
    );
  }

  // --- lead.tag_added ---
  // Backend emite context { contact_id, conversation_id, label: <nome da tag> }
  // matches?: actual = context['label'] → compara string ==.
  if (trigger === 'lead.tag_added') {
    const value = typeof condition?.value === 'string' ? condition.value : '';
    return (
      <div>
        <UILabel>Qual etiqueta? *</UILabel>
        <select
          value={value}
          onChange={e =>
            onChange({ field: 'label', operator: 'eq', value: e.target.value })
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

  // --- lead.message_received ---
  // Backend emite context { contact_id, conversation_id, message_id, content: <texto da msg> }
  // Operators do backend: 'eq' (igual exato) e 'contains' (substring).
  if (trigger === 'lead.message_received') {
    const value = typeof condition?.value === 'string' ? condition.value : '';
    const operator = condition?.operator === 'eq' ? 'eq' : 'contains';
    const commit = (op: string, val: string) =>
      onChange(val ? { field: 'content', operator: op, value: val } : null);
    return (
      <div className="space-y-2">
        <div>
          <UILabel>Comparação</UILabel>
          <select
            value={operator}
            onChange={e => commit(e.target.value, value)}
            className={baseSelectClass}
          >
            <option value="contains">Contém</option>
            <option value="eq">É igual a</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            <strong>Contém:</strong> dispara se a mensagem tiver a palavra em qualquer lugar (recomendado).{' '}
            <strong>É igual a:</strong> só dispara se a mensagem for exatamente a palavra-chave.
          </p>
        </div>
        <div>
          <UILabel>Palavra-chave (opcional)</UILabel>
          <Input
            value={value}
            onChange={e => commit(operator, e.target.value)}
            placeholder="Ex: visita, agendar, preço…"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Em branco = dispara em qualquer mensagem recebida.
          </p>
        </div>
      </div>
    );
  }

  // --- lead.stage_changed ---
  // Backend emite context { ..., from_stage_id, to_stage_id }.
  // Pra filtrar por estágio destino, usamos field=to_stage_id.
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
            onChange({ field: 'to_stage_id', operator: 'eq', value: e.target.value })
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

// Variáveis interpoladas pelo backend (LeadAutomation::Executor#interpolate).
const MESSAGE_VARS: { label: string; token: string }[] = [
  { label: 'Nome',          token: '{{nome}}' },
  { label: 'Nome completo', token: '{{nome_completo}}' },
  { label: 'Telefone',      token: '{{telefone}}' },
  { label: 'E-mail',        token: '{{email}}' },
  { label: 'Data',          token: '{{data}}' },
  { label: 'Hora',          token: '{{hora}}' },
  { label: 'Link do card',  token: '{{link_do_card}}' },
  { label: 'Origem',        token: '{{origem}}' },
  { label: 'Campanha',      token: '{{campanha}}' },
  { label: 'Conjunto',      token: '{{conjunto}}' },
  { label: 'Anúncio',       token: '{{anuncio}}' },
  { label: 'Título anúncio', token: '{{titulo_anuncio}}' },
  { label: 'Plataforma',    token: '{{plataforma}}' },
  { label: 'Respostas form', token: '{{respostas}}' },
];

// Chips de variável: 1 clique insere o token no campo. Reutilizável em msg/legenda/notificações.
function VariableChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      <span className="text-xs text-muted-foreground mr-1">Inserir variável:</span>
      {MESSAGE_VARS.map(v => (
        <button
          key={v.token}
          type="button"
          onClick={() => onInsert(v.token)}
          className="text-xs px-2 py-0.5 rounded-full border border-input bg-muted/40 hover:bg-muted transition-colors"
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function ActionEditor({ action, onChange, resources }: ActionEditorProps) {
  const params = (action.params ?? {}) as Record<string, string | number>;
  const setParam = (key: string, value: string | number) =>
    onChange({ ...action, params: { ...params, [key]: value } });
  const appendToParam = (key: string, token: string) =>
    setParam(key, `${String(params[key] ?? '')}${token}`);

  switch (action.type) {
    // ----- start_followup_sequence -----
    // Backend lookup: FollowupSequence.active.find_by(slug: slug). Value = slug, NÃO id.
    case 'start_followup_sequence':
      return (
        <Field label="Sequência de follow-up *">
          <select
            value={String(params.sequence_slug ?? '')}
            onChange={e => setParam('sequence_slug', e.target.value)}
            className={baseSelectClass}
          >
            <option value="">Selecione uma sequência</option>
            {resources.sequences.map(s => (
              <option key={s.id} value={s.slug}>
                {s.name}{!s.is_active ? ' (inativa)' : ''}
              </option>
            ))}
          </select>
        </Field>
      );

    // ----- send_whatsapp_message -----
    case 'send_whatsapp_message':
      return (
        <Field label="Mensagem *" hint="Toque numa variável pra inserir. No envio ela vira o dado real do lead.">
          <Textarea
            value={String(params.message ?? '')}
            onChange={e => setParam('message', e.target.value)}
            placeholder="Olá {{nome}}, tudo bem?"
            rows={3}
            className="mt-1 resize-none"
          />
          <VariableChips onInsert={tok => appendToParam('message', tok)} />
        </Field>
      );

    // ----- send_audio / send_image / send_video -----
    case 'send_audio':
    case 'send_image':
    case 'send_video':
    case 'send_sticker':
      return (
        <>
          <Field
            label="URL da mídia *"
            hint={action.type === 'send_sticker' ? 'PNG ou WebP. A Evolution converte pra figurinha.' : undefined}
          >
            <Input
              value={String(params.media_url ?? '')}
              onChange={e => setParam('media_url', e.target.value)}
              placeholder="https://..."
              className="mt-1"
            />
          </Field>
          {(action.type === 'send_image' || action.type === 'send_video') && (
            <Field label="Legenda">
              <Input
                value={String(params.caption ?? '')}
                onChange={e => setParam('caption', e.target.value)}
                placeholder="Opcional"
                className="mt-1"
              />
              <VariableChips onInsert={tok => appendToParam('caption', tok)} />
            </Field>
          )}
        </>
      );

    // ----- assign_broker -----
    // Backend lookup: User.find_by(id: user_id).
    case 'assign_broker':
      return (
        <Field label="Corretor *">
          <select
            value={String(params.user_id ?? '')}
            onChange={e => setParam('user_id', e.target.value)}
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
    // Backend lookup: Label.find_by(id: label_id). Value = UUID, NÃO título.
    case 'add_label':
    case 'remove_label':
      return (
        <Field label="Etiqueta *">
          <select
            value={String(params.label_id ?? '')}
            onChange={e => setParam('label_id', e.target.value)}
            className={baseSelectClass}
          >
            <option value="">Selecione uma etiqueta</option>
            {resources.labels.map(l => (
              <option key={l.id} value={l.id}>{l.title}</option>
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
    // Backend: HTTParty.post envia { number: group_jid, text: message } pro Evolution.
    case 'notify_group':
      return (
        <>
          <Field label="JID do grupo WhatsApp *" hint="ID do grupo no Evolution (ex: 120363xxxxxxxxxxx@g.us)">
            <Input
              value={String(params.group_jid ?? '')}
              onChange={e => setParam('group_jid', e.target.value)}
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
            <VariableChips onInsert={tok => appendToParam('message', tok)} />
          </Field>
        </>
      );

    // ----- notify_user -----
    // Backend: notify_user(user_id, message) -> manda no WhatsApp cadastrado do usuário.
    case 'notify_user': {
      const selected = resources.users.find(u => u.id === String(params.user_id ?? ''));
      const selectedWa = (selected as unknown as { whatsapp_number?: string })?.whatsapp_number;
      return (
        <>
          <Field label="Avisar qual usuário? *">
            <select
              value={String(params.user_id ?? '')}
              onChange={e => setParam('user_id', e.target.value)}
              className={baseSelectClass}
            >
              <option value="">Selecione um usuário</option>
              {resources.users.map(u => {
                const wa = (u as unknown as { whatsapp_number?: string }).whatsapp_number;
                return (
                  <option key={u.id} value={u.id}>
                    {u.name}{wa ? ` (${wa})` : ' — sem WhatsApp cadastrado'}
                  </option>
                );
              })}
            </select>
          </Field>
          {selected && !selectedWa && (
            <p className="text-xs text-red-500 mt-1">
              Esse usuário não tem WhatsApp cadastrado. Cadastre em Configurações &gt; Usuários pra ele receber o lembrete.
            </p>
          )}
          <Field label="Mensagem do lembrete *" hint="Enviada no WhatsApp do usuário escolhido. Toque numa variável pra inserir.">
            <Textarea
              value={String(params.message ?? '')}
              onChange={e => setParam('message', e.target.value)}
              placeholder="Novo lead do anúncio: {{nome_completo}} — {{telefone}}"
              rows={3}
              className="mt-1 resize-none"
            />
            <VariableChips onInsert={tok => appendToParam('message', tok)} />
          </Field>
        </>
      );
    }

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

    // ----- send_document -----
    case 'send_document':
      return (
        <>
          <Field label="URL do documento *" hint="PDF, DOCX, etc. Deve ser uma URL pública.">
            <Input
              value={String(params.media_url ?? '')}
              onChange={e => setParam('media_url', e.target.value)}
              placeholder="https://..."
              className="mt-1"
            />
          </Field>
          <Field label="Nome do arquivo">
            <Input
              value={String(params.filename ?? '')}
              onChange={e => setParam('filename', e.target.value)}
              placeholder="proposta.pdf"
              className="mt-1"
            />
          </Field>
        </>
      );

    // ----- assign_via_roleta -----
    case 'assign_via_roleta':
      return (
        <p className="text-sm text-muted-foreground mt-1">
          Atribui o lead ao proximo corretor disponivel conforme a roleta configurada para o inbox.
        </p>
      );

    // ----- wait -----
    case 'wait':
      return (
        <Field label="Aguardar (minutos) *">
          <Input
            type="number"
            min={1}
            value={Number(params.minutes ?? 60)}
            onChange={e => setParam('minutes', parseInt(e.target.value) || 1)}
            className="mt-1"
          />
        </Field>
      );

    // ----- notify_broker -----
    case 'notify_broker':
      return (
        <Field
          label="Mensagem para o corretor *"
          hint="Enviada no WhatsApp pessoal do corretor atribuido. Variaveis: {{nome}}, {{telefone}}, {{link_do_card}}"
        >
          <Textarea
            value={String(params.message ?? '')}
            onChange={e => setParam('message', e.target.value)}
            placeholder="Novo lead: {{nome}} — {{telefone}}"
            rows={3}
            className="mt-1 resize-none"
          />
          <VariableChips onInsert={tok => appendToParam('message', tok)} />
        </Field>
      );

    // ----- notify_gestor -----
    case 'notify_gestor':
      return (
        <Field
          label="Mensagem para o gestor *"
          hint="Enviada no numero do gestor configurado na Roleta. Variaveis: {{nome}}, {{telefone}}, {{link_do_card}}"
        >
          <Textarea
            value={String(params.message ?? '')}
            onChange={e => setParam('message', e.target.value)}
            placeholder="Lead {{nome}} atribuido a {{corretor}}"
            rows={3}
            className="mt-1 resize-none"
          />
          <VariableChips onInsert={tok => appendToParam('message', tok)} />
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
    // Condição opcional: message_received (keyword vazia = qualquer msg) e
    // lead.created (origem vazia = qualquer lead novo).
    const isOptional =
      trigger === 'lead.message_received' ||
      trigger === 'lead.created' ||
      trigger === 'lead.campaign_received';
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
  if (trigger === 'lead.created') {
    if (condition.field === 'form_id') {
      const f = resources.formOrigins.find(x => x.form_id === condition.value);
      return `Formulário: ${f?.form_name || condition.value}`;
    }
    const labels: Record<string, string> = {
      formulario: 'Formulário (Meta Lead Ads)',
      lead_whats_meta: 'Lead Whats Meta (anúncio no WhatsApp)',
      organico: 'Orgânico (sem anúncio)',
    };
    return `Origem: ${labels[String(condition.value)] ?? condition.value}`;
  }
  if (trigger === 'lead.campaign_received') {
    if (!condition?.value) return 'Qualquer anúncio';
    const o = resources.adOrigins.find(a => a.ad_id === condition.value);
    return `Anúncio: ${o?.title || o?.campaign_name || condition.value}`;
  }
  if (trigger === 'lead.tag_added') {
    return `Etiqueta: ${condition.value}`;
  }
  if (trigger === 'lead.message_received') {
    const op = condition.operator === 'eq' ? 'É igual a' : 'Contém';
    return `${op}: "${condition.value}"`;
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
      const seq = resources.sequences.find(s => s.slug === p.sequence_slug);
      return seq ? `Sequência: ${seq.name}` : 'Sequência: (não definida)';
    }
    case 'send_whatsapp_message':
      return p.message ? `"${String(p.message).slice(0, 60)}…"` : '(mensagem vazia)';
    case 'send_audio':
    case 'send_image':
    case 'send_video':
      return p.media_url ? `Mídia: ${String(p.media_url).slice(0, 40)}…` : '(sem mídia)';
    case 'send_sticker':
      return p.media_url ? `Figurinha: ${String(p.media_url).slice(0, 40)}…` : '(sem figurinha)';
    case 'assign_broker': {
      const u = resources.users.find(x => x.id === p.user_id);
      return u ? `Corretor: ${u.name}` : 'Corretor: (não definido)';
    }
    case 'add_label':
    case 'remove_label': {
      const l = resources.labels.find(x => x.id === p.label_id);
      return l ? `Etiqueta: ${l.title}` : 'Etiqueta: (não definida)';
    }
    case 'move_pipeline_stage': {
      const stages = p.pipeline_id ? resources.stagesByPipeline[String(p.pipeline_id)] : undefined;
      const stage = stages?.find(s => s.id === p.stage_id);
      return stage ? `Estágio: ${stage.name}` : 'Estágio: (não definido)';
    }
    case 'create_task':
      return p.title ? `Tarefa: ${p.title}` : '(tarefa sem título)';
    case 'notify_group':
      return p.group_jid ? `Grupo: ${String(p.group_jid).slice(0, 30)}…` : '(sem grupo)';
    case 'notify_user': {
      const u = resources.users.find(x => x.id === p.user_id);
      return u ? `Avisar: ${u.name}` : 'Avisar usuário: (não definido)';
    }
    case 'send_quick_reply': {
      const qr = resources.quickReplies.find(q => q.id === p.quick_reply_id);
      return qr ? `Resposta: ${qr.title}` : '(nao definida)';
    }
    case 'send_document':
      return p.filename ? `Documento: ${p.filename}` : p.media_url ? `Documento: ${String(p.media_url).slice(0, 40)}...` : '(sem documento)';
    case 'assign_via_roleta':
      return 'Distribui via roleta';
    case 'wait':
      return p.minutes ? `Aguarda ${p.minutes} min` : '(delay nao definido)';
    case 'notify_broker':
      return p.message ? `Corretor: "${String(p.message).slice(0, 50)}..."` : '(mensagem vazia)';
    case 'notify_gestor':
      return p.message ? `Gestor: "${String(p.message).slice(0, 50)}..."` : '(mensagem vazia)';
    default:
      return '';
  }
}
