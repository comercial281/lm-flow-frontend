import { useEffect, useState } from 'react';
import { Input, Label as UILabel, Textarea } from '@/components/ui/ds';
import { ExternalLink } from 'lucide-react';

import { messageFunnelsService } from '@/services/messageFunnels/messageFunnelsService';
import type { MessageFunnel } from '@/types/messageFunnels';
import { labelsService } from '@/services/contacts/labelsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import usersService from '@/services/users/usersService';
import { quickRepliesService } from '@/services/quickReplies/quickRepliesService';
import { followupSequencesService, FollowupSequence } from '@/services/followupSequences/followupSequencesService';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation } from '@/types/flowAutomations';
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
  type EvolutionInstance,
  WAIT_ACTION_NOTICE,
  missingActionParams,
} from '@/services/leadAutomation/leadAutomationService';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import SendFromField from '@/components/numbers/SendFromField';
import { applySendFrom, sendFromOf, sendFromProblem } from '@/features/numbers/sendFrom';
import { teamNameWarning } from '@/features/numbers/teamNameWarning';
import {
  acceptedByIds,
  acceptedByCondition,
  acceptedByOptions,
  acceptedBySummary,
  toggleAcceptedBy,
} from './acceptedByFilter';
import { Seletor } from '@/components/base/Seletor';
import { roletaConfigService, roletaLabel, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import { VariableChipBar } from '@/components/flowAutomations/VariableChipBar';
import { FLOW_KIND_COPY } from '@/features/flowAutomations/kind';

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
  'lead.no_reply_after',
  // Filtro opcional por quem aceitou (ver acceptedByFilter.ts).
  'lead.roleta_accepted',
]);

export const triggerNeedsCondition = (trigger: string): boolean =>
  TRIGGERS_WITH_CONDITION.has(trigger);

// Params obrigatórios por action.type: ACTION_REQUIRED_PARAMS, em
// leadAutomationService.ts (o construtor de fluxos usa o mesmo mapa).

// ============================================================================
// Resources (lookup pra dropdowns)
// ============================================================================

export interface AutomationResources {
  labels: ContactLabel[];
  sequences: FollowupSequence[];
  /** Os fluxos de follow-up (sprint 3): a ação "Iniciar follow-up" escolhe um deles. */
  followupFlows: FlowAutomation[];
  users: User[];
  pipelines: Pipeline[];
  stagesByPipeline: Record<string, PipelineStage[]>;
  quickReplies: QuickReply[];
  adOrigins: AdOrigin[];
  formOrigins: FormOrigin[];
  /** Funis ANTIGOS (MessageFunnel): só pra mostrar o nome na ação que ainda usa `funnel_id` (formato antigo). */
  messageFunnels: MessageFunnel[];
  /** Funis de conversa (Funis de mensagem, sprint 4): o que a ação "Disparar funil de mensagens" escolhe desde 05/10/2026. */
  conversationFunnels: FlowAutomation[];
  evolutionInstances: EvolutionInstance[];
  /** Todas as roletas (a ação "Distribuir pela roleta" oferece as ligadas + a escolhida). */
  roletas?: RoletaConfig[];
  reloadFunnels: () => void;
  reloadLabels: () => void;
  loading: boolean;
}

export function useAutomationResources(enabled: boolean): AutomationResources {
  const isSuperAdmin = useIsSuperAdmin();
  const [labels, setLabels] = useState<ContactLabel[]>([]);
  const [sequences, setSequences] = useState<FollowupSequence[]>([]);
  const [followupFlows, setFollowupFlows] = useState<FlowAutomation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, PipelineStage[]>>({});
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [adOrigins, setAdOrigins] = useState<AdOrigin[]>([]);
  const [formOrigins, setFormOrigins] = useState<FormOrigin[]>([]);
  const [messageFunnels, setMessageFunnels] = useState<MessageFunnel[]>([]);
  const [conversationFunnels, setConversationFunnels] = useState<FlowAutomation[]>([]);
  const [evolutionInstances, setEvolutionInstances] = useState<EvolutionInstance[]>([]);
  const [roletas, setRoletas] = useState<RoletaConfig[]>([]);
  const [loading, setLoading] = useState(false);

  // Recarrega a lista de funis de conversa (o "Recarregar" da ação, depois de
  // montar um funil em Funis de mensagem, noutra aba).
  const reloadFunnels = () => {
    flowAutomationsService.list({ kind: 'conversation' })
      .then(list => setConversationFunnels((list ?? []).filter(f => !f.archived_at)))
      .catch(() => { /* funis são opcionais — não trava a tela */ });
  };

  // Recarrega o catálogo de etiquetas (usado após criar uma etiqueta nova inline).
  const reloadLabels = () => {
    labelsService.getLabels()
      .then(res => setLabels(res.data ?? []))
      .catch(() => { /* catálogo é enriquecimento — não trava a tela */ });
  };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [labelsRes, seqRes, usersRes, pipelinesRes, qrRes, adRes, formRes, funnelsRes, evoRes, fuFlowsRes, convRes, roletasRes] = await Promise.allSettled([
        labelsService.getLabels(),
        followupSequencesService.getAll(),
        usersService.getUsers(),
        pipelinesService.getPipelines(),
        quickRepliesService.getQuickReplies(),
        leadAutomationService.getAdOrigins(),
        leadAutomationService.getFormOrigins(),
        messageFunnelsService.list({ activeOnly: false }),
        isSuperAdmin ? leadAutomationService.getEvolutionInstances() : Promise.resolve([]),
        flowAutomationsService.list({ kind: 'followup' }),
        flowAutomationsService.list({ kind: 'conversation' }),
        roletaConfigService.getAll(),
      ]);

      if (cancelled) return;

      if (labelsRes.status === 'fulfilled') setLabels(labelsRes.value.data ?? []);
      if (seqRes.status === 'fulfilled') setSequences(seqRes.value ?? []);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data ?? []);
      if (qrRes.status === 'fulfilled') setQuickReplies(qrRes.value.data ?? []);
      if (adRes.status === 'fulfilled') setAdOrigins(adRes.value ?? []);
      if (formRes.status === 'fulfilled') setFormOrigins(formRes.value ?? []);
      if (funnelsRes.status === 'fulfilled') setMessageFunnels(funnelsRes.value ?? []);
      if (evoRes.status === 'fulfilled') setEvolutionInstances(evoRes.value ?? []);
      if (fuFlowsRes.status === 'fulfilled') setFollowupFlows((fuFlowsRes.value ?? []).filter(f => !f.archived_at));
      if (convRes.status === 'fulfilled') setConversationFunnels((convRes.value ?? []).filter(f => !f.archived_at));
      if (roletasRes.status === 'fulfilled') setRoletas(roletasRes.value ?? []);

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

  return { labels, sequences, followupFlows, users, pipelines, stagesByPipeline, quickReplies, adOrigins, formOrigins, messageFunnels, conversationFunnels, evolutionInstances, roletas, reloadFunnels, reloadLabels, loading };
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

// Estado da instância em português. "open" é o que a Evolution chama de conectada;
// escolher uma desconectada é o caminho mais curto pro aviso não chegar.
function instanceStatusLabel(status: string): string {
  switch (status) {
    case 'open':       return 'conectada ✓';
    case 'connecting': return 'conectando…';
    case 'close':      return 'desconectada ⚠️';
    default:           return status || 'estado desconhecido';
  }
}

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
    // Formulários selecionados: aceita array (operator "in") ou valor único legado (eq).
    const selectedForms: string[] = field === 'form_id'
      ? (Array.isArray(condition?.value) ? condition!.value : (rawValue ? [rawValue] : []))
      : [];

    const commitOrigin = (o: string) => {
      if (!o) return onChange(null);
      onChange({ field: 'source', operator: 'eq', value: o });
    };
    const commitForms = (ids: string[]) => {
      // Nenhum marcado = qualquer formulário (só filtra por origem).
      onChange(ids.length
        ? { field: 'form_id', operator: 'in', value: ids }
        : { field: 'source', operator: 'eq', value: 'formulario' });
    };
    const toggleForm = (fid: string) => {
      commitForms(selectedForms.includes(fid)
        ? selectedForms.filter(x => x !== fid)
        : [...selectedForms, fid]);
    };

    return (
      <div className="space-y-2">
        <div>
          <UILabel>Origem do lead (opcional)</UILabel>
          <Seletor value={origin} onChange={e => commitOrigin(e.target.value)} className={baseSelectClass}>
            <option value="">Qualquer origem</option>
            <option value="formulario">Formulário (Meta Lead Ads)</option>
            <option value="formulario_site">Formulário do site / landing</option>
            <option value="lead_whats_meta">Lead Whats Meta (anúncio no WhatsApp)</option>
            <option value="organico">Orgânico (sem anúncio)</option>
          </Seletor>
          <p className="text-xs text-muted-foreground mt-1">
            Em branco = qualquer lead novo. <strong>Formulário</strong>: veio de um formulário de anúncio.{' '}
            <strong>Formulário do site</strong>: preencheu um formulário do site ou de uma landing.{' '}
            <strong>Lead Whats Meta</strong>: clicou no anúncio e caiu direto no WhatsApp.
          </p>
        </div>

        {origin === 'formulario' && (
          <div>
            <UILabel>Quais formulários? (opcional)</UILabel>
            <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {resources.formOrigins.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">
                  Nenhum formulário conectado ainda — veja Configurações → Formulários (Meta).
                </p>
              ) : (
                resources.formOrigins.map(f => (
                  <label
                    key={f.form_id}
                    className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-muted/50 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedForms.includes(f.form_id)}
                      onChange={() => toggleForm(f.form_id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="truncate">
                      {(f.form_name || f.form_id)}
                      {f.count > 0 ? ` · ${f.count} lead${f.count === 1 ? '' : 's'}` : ''}
                    </span>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Nenhum marcado = qualquer formulário. Marque um ou mais pra esse fluxo valer só pros leads
              daqueles formulários.
            </p>
          </div>
        )}
      </div>
    );
  }

  // --- lead.roleta_accepted ---
  // Filtro opcional por QUEM aceitou. Backend: context { assigned_user_id, ... }
  // casa com { assigned_user_id in [ids] }. Nenhum marcado = qualquer corretor.
  if (trigger === 'lead.roleta_accepted') {
    const selected = acceptedByIds(condition);
    const options = acceptedByOptions(resources.users, selected);
    const toggle = (id: string) => onChange(acceptedByCondition(toggleAcceptedBy(selected, id)));

    return (
      <div>
        <UILabel>Só quando quem aceitou for (opcional)</UILabel>
        <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">
              {resources.loading ? 'Carregando a equipe…' : 'Nenhum usuário encontrado na conta.'}
            </p>
          ) : (
            options.map(o => (
              <label
                key={o.id}
                className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-muted/50 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(o.id)}
                  onChange={() => toggle(o.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="truncate">
                  {o.name}
                  {o.deactivated && <span className="text-muted-foreground"> (desativado)</span>}
                  {o.missing && <span className="text-muted-foreground"> (não está mais na conta)</span>}
                </span>
              </label>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Nenhum marcado = vale para o aceite de qualquer corretor. Marque um ou mais para esta
          automação rodar só quando um deles aceitar — por exemplo, só os corretores que têm a
          IA Vendedora no próprio número. A mensagem continua saindo pelo número de quem aceitou.
        </p>
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
          <Seletor value={value} onChange={e => commit(e.target.value)} className={baseSelectClass}>
            <option value="">Qualquer anúncio (todo lead que veio de anúncio no WhatsApp)</option>
            {withId.map(o => (
              <option key={o.ad_id!} value={o.ad_id!}>
                {(o.title || o.campaign_name || o.ad_id)} · {o.count} lead{o.count === 1 ? '' : 's'}
              </option>
            ))}
          </Seletor>
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
        <Seletor
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
        </Seletor>
        {resources.labels.length === 0 && !resources.loading && (
          <p className="text-xs text-muted-foreground mt-1">
            Nenhuma etiqueta cadastrada. Crie em Configurações &rarr; Etiquetas.
          </p>
        )}
      </div>
    );
  }

  // --- lead.no_reply_after ---
  // Dispatcher (Followup::NoReplyEnrollJob) roda o executor com context[no_reply_minutes]=decorridos.
  // A condição no_reply_minutes gte X define o tempo (editável aqui).
  if (trigger === 'lead.no_reply_after') {
    const minutes = condition?.field === 'no_reply_minutes' ? (Number(condition.value) || 30) : 30;
    return (
      <div>
        <UILabel>Sem resposta após quantos minutos? *</UILabel>
        <Input
          type="number"
          min={1}
          value={minutes}
          onChange={e =>
            onChange({ field: 'no_reply_minutes', operator: 'gte', value: String(parseInt(e.target.value) || 1) })
          }
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Dispara quando o lead recebeu o 1º contato e não respondeu nesse tempo (ex: 30 = meia hora).
          Edite aqui quando quiser. A ação típica é "Adicionar etiqueta: follow-up".
        </p>
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
          <Seletor
            value={operator}
            onChange={e => commit(e.target.value, value)}
            className={baseSelectClass}
          >
            <option value="contains">Contém</option>
            <option value="eq">É igual a</option>
          </Seletor>
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
    return (
      <StageConditionEditor
        value={typeof condition?.value === 'string' ? condition.value : ''}
        resources={resources}
        onChange={stageId => onChange({ field: 'to_stage_id', operator: 'eq', value: stageId })}
      />
    );
  }

  return null;
}

// "Etapa alterada": primeiro o funil, depois as etapas DELE. Uma lista única
// "Funil → Etapa" com todas as etapas de todos os funis ficava longa e confusa
// (pedido do Tony, 03/10/2026). Grava só a etapa (`to_stage_id`): a etapa já
// diz de qual funil é, então o funil escolhido aqui é só pra filtrar a lista.
function StageConditionEditor({
  value,
  resources,
  onChange,
}: {
  value: string;
  resources: AutomationResources;
  onChange: (stageId: string) => void;
}) {
  const pipelineOfValue = Object.entries(resources.stagesByPipeline).find(([, stages]) =>
    stages.some(st => st.id === value),
  )?.[0] ?? '';
  const [pipelineId, setPipelineId] = useState(pipelineOfValue);
  useEffect(() => {
    if (pipelineOfValue) setPipelineId(pipelineOfValue);
  }, [pipelineOfValue]);
  const stages = pipelineId ? resources.stagesByPipeline[pipelineId] ?? [] : [];

  return (
    <div className="space-y-2">
      <div>
        <UILabel>Em qual funil? *</UILabel>
        <Seletor
          value={pipelineId}
          onChange={e => {
            setPipelineId(e.target.value);
            onChange('');
          }}
          className={baseSelectClass}
        >
          <option value="">Selecione um funil</option>
          {resources.pipelines.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Seletor>
      </div>
      <div>
        <UILabel>Para qual etapa? *</UILabel>
        <Seletor
          value={value}
          onChange={e => onChange(e.target.value)}
          className={baseSelectClass}
          disabled={!pipelineId}
        >
          <option value="">{pipelineId ? 'Selecione uma etapa' : 'Escolha o funil primeiro'}</option>
          {stages.map(st => (
            <option key={st.id} value={st.id}>{st.name}</option>
          ))}
        </Seletor>
      </div>
    </div>
  );
}

// ============================================================================
// PipelineFilterEditor — "vale só para os leads deste funil"
// ============================================================================

// A condição de funil é SEPARADA da condição do gatilho: ela responde uma
// pergunta sobre o LEAD ("em qual funil ele está?"), não sobre o evento. Por
// isso ela vive lado a lado com a origem, e não no lugar dela.
export const isPipelineCondition = (c: LeadAutomationCondition): boolean =>
  c.field === 'pipeline_id';

// "Card mudou de etapa" já escolhe a ETAPA, e etapa já diz de qual funil é.
// Oferecer o funil ali criaria duas verdades sobre a mesma coisa — e um filtro
// contraditório (etapa de um funil, funil de outro) nunca dispararia.
export const triggerAcceptsPipelineFilter = (trigger: string): boolean =>
  trigger !== 'lead.stage_changed';

// As condições que sobrevivem à troca de gatilho.
//
// A do GATILHO é sempre sobre o gatilho antigo (a etiqueta, a etapa, a origem):
// levada para outro ela fica gravada e invisível — o editor novo não desenha o
// campo dela — e segue barrando a automação sem nada na tela dizendo por quê.
// O filtro de funil é sobre o LEAD e atravessa, onde o gatilho novo o oferece.
export function conditionsOnTriggerChange(
  prevTrigger: string,
  nextTrigger: string,
  conditions: LeadAutomationCondition[],
): LeadAutomationCondition[] {
  const funil = triggerAcceptsPipelineFilter(nextTrigger) ? conditions.find(isPipelineCondition) : undefined;
  const doGatilho = prevTrigger === nextTrigger && triggerNeedsCondition(nextTrigger)
    ? conditions.filter(c => !isPipelineCondition(c))
    : [];
  return [...doGatilho, ...(funil ? [funil] : [])];
}

interface PipelineFilterEditorProps {
  trigger: string;
  condition: LeadAutomationCondition | null;
  onChange: (next: LeadAutomationCondition | null) => void;
  resources: AutomationResources;
}

export function PipelineFilterEditor({
  trigger, condition, onChange, resources,
}: PipelineFilterEditorProps) {
  if (!triggerAcceptsPipelineFilter(trigger)) return null;

  const value = typeof condition?.value === 'string' ? condition.value : '';

  return (
    <div>
      <UILabel>Funil (opcional)</UILabel>
      <Seletor
        value={value}
        onChange={e =>
          onChange(e.target.value
            ? { field: 'pipeline_id', operator: 'eq', value: e.target.value }
            : null)
        }
        className={baseSelectClass}
      >
        <option value="">Qualquer funil</option>
        {resources.pipelines.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </Seletor>
      <p className="text-xs text-muted-foreground mt-1">
        Em branco = vale para todo lead do CRM. Escolhendo um funil, essa automação
        só roda para o lead cujo card está nele — é assim que o mesmo CRM tem uma IA
        no funil de lançamento e outra no de locação.
        {trigger === 'lead.created' && (
          <>
            {' '}O lead de anúncio e de landing entra no funil logo depois de nascer,
            então essa automação espera o card aparecer antes de disparar (cerca de
            meio minuto). Sem funil escolhido, nada muda: dispara na hora.
          </>
        )}
      </p>
      {resources.pipelines.length === 0 && !resources.loading && (
        <p className="text-xs text-muted-foreground mt-1">
          Nenhum funil cadastrado ainda.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// ActionEditor — params específicos por action.type
// ============================================================================

interface ActionEditorProps {
  action: LeadAutomationAction;
  onChange: (next: LeadAutomationAction) => void;
  resources: AutomationResources;
}

// Chips de variável: 1 clique insere o token no fim do campo. A lista é a
// compartilhada com o construtor (features/flowAutomations/messageVariables.ts):
// as prontas e, dentro do construtor, as que a imobiliária criou.
function VariableChips({ onInsert }: { onInsert: (token: string) => void }) {
  return <VariableChipBar onInsert={onInsert} />;
}

export function ActionEditor({ action, onChange, resources }: ActionEditorProps) {
  const params = (action.params ?? {}) as Record<string, string | number>;
  const setParam = (key: string, value: string | number) =>
    onChange({ ...action, params: { ...params, [key]: value } });
  const appendToParam = (key: string, token: string) =>
    setParam(key, `${String(params[key] ?? '')}${token}`);
  const isSuperAdmin = useIsSuperAdmin();

  // Grupos de WhatsApp pro dropdown do "Notificar grupo" (carrega da instância escolhida).
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  // Por que a lista veio vazia (instância errada, fora do ar, sem grupo). Sem
  // isso o seletor só ficava sem opção, e não dava pra saber o que consertar.
  const [groupsReason, setGroupsReason] = useState<string | null>(null);
  const instanceParam = String(params.instance ?? '');
  useEffect(() => {
    if (action.type !== 'notify_group') return;
    let cancelled = false;
    setLoadingGroups(true);
    leadAutomationService
      .getGroupsResult(instanceParam || undefined)
      .then(r => { if (!cancelled) { setGroups(r.groups); setGroupsReason(r.reason); } })
      .catch(() => {
        if (!cancelled) {
          setGroups([]);
          setGroupsReason('Não foi possível carregar os grupos agora. Tente de novo em instantes.');
        }
      })
      .finally(() => { if (!cancelled) setLoadingGroups(false); });
    return () => { cancelled = true; };
  }, [action.type, instanceParam]);

  // Usuários do sistema com WhatsApp cadastrado — pra mandar o lembrete no privado deles.
  const usersWithWhatsapp = resources.users.filter(
    u => String((u as { whatsapp_number?: string }).whatsapp_number ?? '').trim() !== '',
  ) as Array<User & { whatsapp_number?: string }>;

  switch (action.type) {
    // ----- send_message_funnel -----
    // Desde 05/10/2026 escolhe um funil de CONVERSA (Funis de mensagem) e grava
    // `params.flow_automation_id`; o servidor começa o funil pro lead
    // (FlowAutomations::Starter), pelo número da conversa dele, mesmo jeito do
    // "Disparar funil" da conversa. A ação antiga (`funnel_id`, funil do editor
    // de antes) continua disparando igual e aparece como "formato antigo" até
    // alguém escolher um funil novo aqui.
    case 'send_message_funnel': {
      const atual = String(params.flow_automation_id ?? '');
      const antigoId = String(params.funnel_id ?? '');
      const antigo = !atual && antigoId ? resources.messageFunnels.find(f => f.id === antigoId) : undefined;
      const lista = resources.conversationFunnels ?? [];
      const conhecido = lista.some(f => f.id === atual);
      const meus = lista.filter(f => !f.team);
      const daEquipe = lista.filter(f => f.team);
      const estado = (f: FlowAutomation) =>
        f.guide_done === false ? ' (falta terminar o passo a passo)' : !f.is_enabled ? ' (desligado)' : '';
      const escolher = (id: string) => {
        const { funnel_id: _antigo, ...resto } = params;
        onChange({ ...action, params: id ? { ...resto, flow_automation_id: id } : { ...params, flow_automation_id: '' } });
      };
      const opcao = (f: FlowAutomation) => (
        <option key={f.id} value={f.id}>{f.name}{estado(f)}</option>
      );
      return (
        <Field
          label="Qual funil *"
          hint="Os funis ficam em Funis de mensagem. As mensagens saem pelo número da conversa do lead, com as esperas do funil. Desligado ou com o passo a passo pela metade, ele não dispara."
        >
          {!atual && antigoId && (
            <p className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
              Esta ação usa um funil do editor de antes:{' '}
              <strong>{antigo ? antigo.name : resources.loading ? 'carregando…' : 'funil que não existe mais'}</strong>{' '}
              (formato antigo). Ele continua disparando igual. Pra usar um funil de Funis de mensagem, escolha abaixo.
            </p>
          )}
          <Seletor
            value={atual}
            onChange={e => escolher(e.target.value)}
            className={baseSelectClass}
            aria-label="Qual funil"
          >
            <option value="">{!atual && antigoId ? 'Trocar por um funil de Funis de mensagem' : 'Escolha o funil'}</option>
            {atual && !conhecido && <option value={atual}>{resources.loading ? 'Carregando…' : 'Funil que não existe mais'}</option>}
            {meus.length > 0 && <optgroup label="Meus funis">{meus.map(opcao)}</optgroup>}
            {daEquipe.length > 0 && <optgroup label="Da equipe">{daEquipe.map(opcao)}</optgroup>}
          </Seletor>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
            <a
              href={atual && conhecido ? `${FLOW_KIND_COPY.conversation.listPath}/${atual}` : FLOW_KIND_COPY.conversation.listPath}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {atual && conhecido ? 'Abrir em Funis de mensagem' : '+ Novo funil em Funis de mensagem'}
            </a>
            <button type="button" className="text-muted-foreground hover:text-foreground underline" onClick={resources.reloadFunnels}>
              Recarregar a lista
            </button>
          </div>
          {lista.length === 0 && !resources.loading && (
            <p className="text-xs text-muted-foreground mt-1">
              Nenhum funil ainda. Monte um em <strong>Funis de mensagem</strong> (a partir de um modelo pronto) e volte aqui.
            </p>
          )}
        </Field>
      );
    }

    // ----- start_followup_flow -----
    // Sprint 3 (03/10/2026): o follow-up é um fluxo do construtor (aba Follow-up).
    case 'start_followup_flow': {
      const atual = String(params.flow_automation_id ?? '');
      const conhecido = resources.followupFlows.some(f => f.id === atual);
      return (
        <Field label="Qual follow-up *" hint="Os follow-ups ficam em Automações → Follow-up. Desligado, ele não recebe o lead.">
          <Seletor
            value={atual}
            onChange={e => setParam('flow_automation_id', e.target.value)}
            className={baseSelectClass}
            aria-label="Qual follow-up"
          >
            <option value="">Escolha o follow-up</option>
            {atual && !conhecido && <option value={atual}>{resources.loading ? 'Carregando…' : 'Follow-up que não existe mais'}</option>}
            {resources.followupFlows.map(f => (
              <option key={f.id} value={f.id}>
                {f.name}{!f.is_enabled ? ' (desligado)' : ''}
              </option>
            ))}
          </Seletor>
        </Field>
      );
    }

    // ----- start_followup_sequence -----
    // Formato antigo (funil de follow-up). Não é mais oferecida pra regra nova;
    // a que já existe continua editável, e o servidor manda o funil convertido
    // pro fluxo novo. Backend lookup: FollowupSequence.active.find_by(slug: slug).
    case 'start_followup_sequence':
      return (
        <Field
          label="Sequência de follow-up *"
          hint='Formato antigo. Pra escolher um dos follow-ups novos, troque a ação por "Iniciar follow-up".'
        >
          <Seletor
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
          </Seletor>
        </Field>
      );

    // ----- send_whatsapp_message -----
    // "Enviar pelo número" (fase 2b.2): por qual número sai. Escolher um número
    // (ou o do responsável) tira a "Instância de envio (admin)" — o servidor a
    // ignora com escolha feita, e o campo dela só aparece no automático (E26).
    // E o texto com o nome fixo de alguém da equipe ganha um aviso (E39).
    case 'send_whatsapp_message': {
      const envio = sendFromOf(params);
      const avisoNome = teamNameWarning(String(params.message ?? ''), resources.users);
      return (
        <>
          <Field label="Mensagem *" hint="Toque numa variável pra inserir. No envio ela vira o dado real do lead.">
            <Textarea
              value={String(params.message ?? '')}
              onChange={e => setParam('message', e.target.value)}
              placeholder="Olá {{nome}}, tudo bem?"
              rows={3}
              className="mt-1 resize-none"
            />
            <VariableChips onInsert={tok => appendToParam('message', tok)} />
            {avisoNome && <p className="text-xs text-amber-600 mt-1">{avisoNome}</p>}
          </Field>
          <SendFromField
            scope="lead_automation_rules"
            value={envio}
            onChange={v => onChange({ ...action, params: applySendFrom(params, v) })}
          />
          {isSuperAdmin && resources.evolutionInstances.length > 0 && !envio.send_from && (
            <Field
              label="Número de envio (admin)"
              hint="Só você vê este campo. Deixe em branco para usar o número padrão do cliente."
            >
              <Seletor
                value={String(params.sender_instance ?? '')}
                onChange={e => setParam('sender_instance', e.target.value)}
                className={baseSelectClass}
              >
                <option value="">— Padrão do cliente —</option>
                {resources.evolutionInstances.map(inst => (
                  <option key={inst.name} value={inst.name}>
                    {inst.name} {inst.status === 'open' ? '✓' : `(${inst.status})`}
                  </option>
                ))}
              </Seletor>
              {params.sender_instance && (
                <p className="text-xs text-amber-500 mt-1">
                  ⚠️ Mensagem enviada pelo número selecionado, não pelo número do cliente.
                </p>
              )}
            </Field>
          )}
        </>
      );
    }

    // ----- send_audio / send_image / send_video -----
    case 'send_audio':
    case 'send_image':
    case 'send_video':
    case 'send_sticker':
      return (
        <>
          <Field
            label="URL da mídia *"
            hint={action.type === 'send_sticker' ? 'PNG ou WebP. Chega no WhatsApp como figurinha.' : undefined}
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
          <Seletor
            value={String(params.user_id ?? '')}
            onChange={e => setParam('user_id', e.target.value)}
            className={baseSelectClass}
          >
            <option value="">Selecione um corretor</option>
            {resources.users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </Seletor>
        </Field>
      );

    // ----- add_label / remove_label -----
    // Backend lookup: Label.find_by(id: label_id). Value = UUID, NÃO título.
    case 'add_label':
    case 'remove_label':
      return (
        <Field label="Etiqueta *">
          <Seletor
            value={String(params.label_id ?? '')}
            onChange={e => setParam('label_id', e.target.value)}
            className={baseSelectClass}
          >
            <option value="">Selecione uma etiqueta</option>
            {resources.labels.map(l => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </Seletor>
        </Field>
      );

    // ----- move_pipeline_stage -----
    case 'move_pipeline_stage': {
      const pipelineId = String(params.pipeline_id ?? '');
      const stageId = String(params.stage_id ?? '');
      return (
        <>
          <Field label="Funil *">
            <Seletor
              value={pipelineId}
              onChange={e =>
                onChange({
                  ...action,
                  params: { ...params, pipeline_id: e.target.value, stage_id: '' },
                })
              }
              className={baseSelectClass}
            >
              <option value="">Selecione um funil</option>
              {resources.pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Seletor>
          </Field>
          {pipelineId && (
            <Field label="Etapa *">
              <Seletor
                value={stageId}
                onChange={e => setParam('stage_id', e.target.value)}
                className={baseSelectClass}
              >
                <option value="">Selecione uma etapa</option>
                {(resources.stagesByPipeline[pipelineId] ?? []).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Seletor>
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
          {/* Instância: LISTA, não campo digitado. O nome tem de bater caractere a
              caractere com o do painel — digitado, um espaço a mais devolvia lista
              de grupos vazia e nada explicava o motivo. Quem não enxerga a lista
              (cliente) continua com o campo livre. */}
          <Field
            label="Número"
            hint="De qual WhatsApp sai o aviso — e de onde os grupos são listados. Para grupo de cliente use a central Operacional (LM01)."
          >
            {resources.evolutionInstances.length > 0 ? (
              <Seletor
                value={String(params.instance ?? '')}
                onChange={e => setParam('instance', e.target.value)}
                className={baseSelectClass}
              >
                <option value="">— WhatsApp do próprio cliente —</option>
                {resources.evolutionInstances.map(inst => (
                  <option key={inst.name} value={inst.name}>
                    {inst.name} — {instanceStatusLabel(inst.status)}
                  </option>
                ))}
                {/* Valor já salvo que não veio na lista (instância renomeada/removida):
                    aparecer como opção evita que salvar a regra o apague sem aviso. */}
                {params.instance
                  && !resources.evolutionInstances.some(i => i.name === params.instance) && (
                  <option value={String(params.instance)}>
                    {String(params.instance)} — não encontrada no servidor
                  </option>
                )}
              </Seletor>
            ) : (
              <Input
                value={String(params.instance ?? '')}
                onChange={e => setParam('instance', e.target.value)}
                placeholder="Operacional (LM01)"
                className="mt-1"
              />
            )}
          </Field>
          <Field label="Destino do lembrete *" hint={loadingGroups ? 'Carregando…' : 'O grupo do cliente, ou um usuário (vai no WhatsApp privado dele).'}>
            <Seletor
              value={String(params.group_jid ?? '')}
              onChange={e => setParam('group_jid', e.target.value)}
              className={baseSelectClass}
            >
              <option value="">{loadingGroups ? 'Carregando…' : 'Selecione o destino'}</option>
              {groups.length > 0 && (
                <optgroup label="Grupo do cliente">
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </optgroup>
              )}
              {usersWithWhatsapp.length > 0 && (
                <optgroup label="Usuários (privado)">
                  {usersWithWhatsapp.map(u => (
                    <option key={u.id} value={String(u.whatsapp_number)}>{u.name} (privado)</option>
                  ))}
                </optgroup>
              )}
              {params.group_jid
                && !groups.some(g => g.id === params.group_jid)
                && !usersWithWhatsapp.some(u => String(u.whatsapp_number) === params.group_jid) && (
                <option value={String(params.group_jid)}>{String(params.group_jid)}</option>
              )}
            </Seletor>
            {/* Lista vazia com o motivo: quase sempre é o nome da instância
                escrito diferente do painel, ou a instância desconectada. */}
            {!loadingGroups && groups.length === 0 && groupsReason && (
              <p className="mt-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700">
                Nenhum grupo apareceu: {groupsReason}
              </p>
            )}
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
            <Seletor
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
            </Seletor>
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
          <Seletor
            value={String(params.quick_reply_id ?? '')}
            onChange={e => setParam('quick_reply_id', e.target.value)}
            className={baseSelectClass}
          >
            <option value="">Selecione uma resposta rápida</option>
            {resources.quickReplies.map(q => (
              <option key={q.id} value={q.id}>{q.title}</option>
            ))}
          </Seletor>
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
    // Roleta nova (06/10/2026): a ação escolhe a roleta, obrigatória (a roleta
    // não tem número).
    case 'assign_via_roleta': {
      const escolhida = String(params.roleta_config_id ?? '');
      const lista = (resources.roletas ?? []).filter(r => r.is_active || r.id === escolhida);
      return (
        <Field
          label="Roleta *"
          hint="Oferece o lead ao próximo da fila da roleta escolhida. Funciona com lead sem conversa."
        >
          <Seletor
            aria-label="Roleta"
            value={escolhida}
            onChange={e => {
              const next = { ...params };
              if (e.target.value) next.roleta_config_id = e.target.value;
              else delete next.roleta_config_id;
              onChange({ ...action, params: next });
            }}
            className={baseSelectClass}
          >
            <option value="">Escolha a roleta</option>
            {lista.map(r => (
              <option key={r.id} value={r.id}>{roletaLabel(r)}{r.is_active ? '' : ' (desligada)'}</option>
            ))}
            {escolhida && !lista.some(r => r.id === escolhida) && (
              <option value={escolhida}>Roleta escolhida (não existe mais)</option>
            )}
          </Seletor>
        </Field>
      );
    }

    // ----- wait -----
    case 'wait':
      return (
        <Field label="Aguardar (minutos) *" hint={`${WAIT_ACTION_NOTICE}. Pra esperar de verdade, use o construtor de fluxos.`}>
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
          hint="Enviada no WhatsApp pessoal do corretor atribuído. Variáveis: {{nome}}, {{telefone}}, {{link_do_card}}"
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
          hint="Enviada no número do gestor configurado na Roleta. Variáveis: {{nome}}, {{telefone}}, {{link_do_card}}"
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

    // ----- notify_push -----
    // Backend: notify_push(user_ids[], title, message) -> push no app (PWA/Modo Plantão) dos usuários.
    case 'notify_push': {
      const rawIds = (action.params as Record<string, unknown> | undefined)?.user_ids;
      const selectedIds: string[] = Array.isArray(rawIds) ? rawIds.map(String) : [];
      const setUserIds = (ids: string[]) =>
        onChange({ ...action, params: { ...params, user_ids: ids } as unknown as Record<string, string | number> });
      const toggleUser = (id: string) =>
        setUserIds(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
      return (
        <>
          <Field label="Notificar quais usuários? *" hint="Recebe o push só quem ativou o Modo Plantão no app/celular.">
            <div className="mt-1 max-h-44 overflow-y-auto rounded-md border border-input bg-background divide-y divide-input">
              {resources.users.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">Nenhum usuário cadastrado.</p>
              )}
              {resources.users.map(u => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(String(u.id))}
                    onChange={() => toggleUser(String(u.id))}
                  />
                  <span>{u.name}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Título da notificação" hint="Aparece em negrito no push. Padrão: LM Flow.">
            <Input
              value={String(params.title ?? '')}
              onChange={e => setParam('title', e.target.value)}
              placeholder="Novo lead!"
              className="mt-1"
            />
          </Field>
          <Field label="Mensagem do push *" hint="Texto do push. Toque numa variável pra inserir.">
            <Textarea
              value={String(params.message ?? '')}
              onChange={e => setParam('message', e.target.value)}
              placeholder="{{nome_completo}} acabou de entrar — {{telefone}}"
              rows={3}
              className="mt-1 resize-none"
            />
            <VariableChips onInsert={tok => appendToParam('message', tok)} />
          </Field>
        </>
      );
    }

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
      trigger === 'lead.campaign_received' ||
      trigger === 'lead.roleta_accepted';
    // Só a condição do GATILHO conta aqui. O filtro de funil viaja no mesmo
    // array e é sempre opcional — sem esta separação, escolher um funil faria
    // um gatilho que EXIGE condição (etiqueta, etapa) passar pela validação sem
    // ela, e a regra subiria sem o que a faz disparar.
    const triggerCondition = conditions.find(c => !isPipelineCondition(c));
    const hasValue =
      triggerCondition !== undefined &&
      triggerCondition.value !== '' &&
      triggerCondition.value !== undefined;
    if (!hasValue && !isOptional) {
      return {
        ok: false,
        error: `Esse gatilho exige uma condição (campo obrigatório acima).`,
      };
    }
  }

  for (const action of actions) {
    const [key] = missingActionParams(action);
    if (key === 'roleta_config_id') {
      return { ok: false, error: 'Escolha a roleta na ação "Distribuir pela roleta".' };
    }
    if (key) {
      return {
        ok: false,
        error: `Preencha "${key}" na ação "${action.type}".`,
      };
    }

    // "Enviar pelo número" (fase 2b.2): "um número específico" sem o número.
    if (action.type === 'send_whatsapp_message') {
      const problema = sendFromProblem(sendFromOf(action.params));
      if (problema) return { ok: false, error: problema };
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
  // Antes do gatilho: o filtro de funil vale em qualquer um deles, e sem esta
  // linha a lista mostraria o identificador cru do funil na tela.
  if (isPipelineCondition(condition)) {
    const funil = resources.pipelines.find(p => p.id === condition.value);
    return `Funil: ${funil?.name ?? condition.value}`;
  }
  if (trigger === 'lead.created') {
    if (condition.field === 'form_id') {
      const ids = Array.isArray(condition.value) ? condition.value : [condition.value];
      const names = ids.map(id => resources.formOrigins.find(x => x.form_id === id)?.form_name || id);
      return `${names.length > 1 ? 'Formulários' : 'Formulário'}: ${names.join(', ')}`;
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
    const entry = Object.entries(resources.stagesByPipeline).find(([, stages]) =>
      stages.some(s => s.id === condition.value),
    );
    const stage = entry?.[1].find(s => s.id === condition.value);
    const pipeline = entry ? resources.pipelines.find(p => p.id === entry[0]) : undefined;
    if (!stage) return `Para a etapa: ${condition.value}`;
    return pipeline ? `Funil ${pipeline.name} → etapa ${stage.name}` : `Para a etapa: ${stage.name}`;
  }
  if (trigger === 'lead.no_reply_after') {
    return `Sem resposta por ${condition.value} min`;
  }
  if (trigger === 'lead.roleta_accepted') {
    return acceptedBySummary(acceptedByIds(condition), resources.users);
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
    case 'start_followup_flow': {
      const flow = resources.followupFlows.find(f => f.id === p.flow_automation_id);
      return flow ? `Follow-up: ${flow.name}` : 'Follow-up: (não definido)';
    }
    case 'send_whatsapp_message':
      return p.message ? `"${String(p.message).slice(0, 60)}…"` : '(mensagem vazia)';
    case 'send_audio':
    case 'send_image':
    case 'send_video':
      return p.media_url ? `Mídia: ${String(p.media_url).slice(0, 40)}…` : '(sem mídia)';
    case 'send_sticker':
      return p.media_url ? `Figurinha: ${String(p.media_url).slice(0, 40)}…` : '(sem figurinha)';
    case 'send_message_funnel': {
      if (p.flow_automation_id) {
        const flow = (resources.conversationFunnels ?? []).find(x => x.id === p.flow_automation_id);
        return flow ? `Funil: ${flow.name}` : 'Funil: (não encontrado)';
      }
      if (p.funnel_id) {
        const f = (resources.messageFunnels ?? []).find(x => x.id === p.funnel_id);
        return `Funil: ${f ? f.name : '(não encontrado)'} (formato antigo)`;
      }
      return 'Funil: (não definido)';
    }
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
      return stage ? `Etapa: ${stage.name}` : 'Etapa: (não definida)';
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
    case 'assign_via_roleta': {
      if (!p.roleta_config_id) return 'Roleta do número da conversa';
      const r = (resources.roletas ?? []).find(x => x.id === p.roleta_config_id);
      return r ? `Roleta: ${roletaLabel(r)}` : 'Roleta: (não encontrada)';
    }
    case 'wait':
      return WAIT_ACTION_NOTICE;
    case 'notify_broker':
      return p.message ? `Corretor: "${String(p.message).slice(0, 50)}..."` : '(mensagem vazia)';
    case 'notify_gestor':
      return p.message ? `Gestor: "${String(p.message).slice(0, 50)}..."` : '(mensagem vazia)';
    case 'notify_push': {
      const ids = Array.isArray((p as Record<string, unknown>).user_ids) ? ((p as Record<string, unknown>).user_ids as string[]) : [];
      const names = ids.map(id => resources.users.find(x => String(x.id) === String(id))?.name).filter(Boolean);
      return names.length ? `Push p/ ${names.join(', ')}` : 'Push no app: (sem usuário)';
    }
    default:
      return '';
  }
}
