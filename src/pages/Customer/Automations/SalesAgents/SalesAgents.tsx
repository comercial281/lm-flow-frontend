import { useEffect, useState, useCallback } from 'react';
import {
  Button, Input, Label, Textarea,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/ds';
import { toast } from 'sonner';
import { Bot, Plus, Trash2, Send, FileText, Upload, RefreshCw, Loader2, Link2, Copy, Check, SlidersHorizontal, ImageIcon, Zap, AlertTriangle, Lightbulb, CalendarDays, Users, MessageSquare, Sparkles, X } from 'lucide-react';
import AiResultsPanel from '@/components/salesAgents/AiResultsPanel';
import type { AgentPerformance } from '@/types/aiResults';
import {
  salesAgentsService,
  type SalesAgent,
  type SalesAgentDocument,
  type SalesAgentMode,
  type SalesMethod,
  type GeneratedAgentConfig,
  type ActiveHours,
  type ActiveHoursMode,
  type ActiveHoursWindow,
  type HealthReport,
  type SalesAgentRun,
  type SalesAgentRunTotals,
  type PromptPreview,
  type SalesAgentTrigger,
  type SalesAgentTriggerType,
  type SalesAgentTriggerMatchMode,
  type BantConfig,
  type UsageLimits,
  type SalesAgentOpening,
  type SalesAgentLesson,
  type SalesAgentLessonKind,
  type SalesAgentTestResult,
  type SalesAgentPropertyLink,
  type TestHistoryItem,
  type TestMediaItem,
  type HandoffMode,
  type SalesAgentFollowupAction,
  type SalesAgentSuggestion,
  type SuggestionsPayload,
  type WeeklyReport,
  type WeeklyReportConfig,
  type WeeklyReportTargets,
} from '@/services/salesAgents/salesAgentsService';
import { DOCUMENT_TOPICS } from '@/features/salesAgents/documentTopics';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import { WeeklyWindowsEditor } from '@/components/schedule/WeeklyWindowsEditor';
import { WEEKDAYS } from '@/components/schedule/scheduleWindows';
import inboxesService from '@/services/channels/inboxesService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { followupSequencesService } from '@/services/followupSequences/followupSequencesService';

import { useConfirmacao } from '@/hooks/useConfirmacao';
import { usePergunta } from '@/hooks/usePergunta';
type Tab = 'config' | 'resultados' | 'sugestoes' | 'relatorios' | 'knowledge' | 'learning' | 'test' | 'diagnostico';

interface InboxOption {
  id: string | number;
  name: string;
}

const MODE_LABELS: Record<SalesAgentMode, string> = {
  seller: 'Vendedora completa',
  sdr: 'Só qualifica (SDR)',
  assistant: 'Assistente do corretor',
};

const MODE_HELP: Record<SalesAgentMode, string> = {
  seller: 'Conversa, tira dúvidas com a base, qualifica e passa o lead quente pro corretor.',
  sdr: 'Faz as perguntas de qualificação e já passa o lead qualificado pro corretor.',
  assistant: 'Não fala com o lead. Sugere a resposta e resume o lead pro corretor (nota interna).',
};

const TEMP_LABEL: Record<string, string> = {
  hot: 'Quente', warm: 'Morno', cold: 'Frio', unknown: 'Indefinido',
};

export default function SalesAgents() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [selected, setSelected] = useState<SalesAgent | null>(null);
  const [inboxes, setInboxes] = useState<InboxOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('config');
  // ⚠️ A chave vai LITERAL aqui. Os dois scanners do catálogo de funcionalidades
  // (sync e audit) leem o código por regex: trocar o literal por uma constante
  // tira a chave do catálogo no deploy seguinte, o painel de Funções deixa de
  // oferecer o botão de liberar, e ninguém é avisado.
  const insightsLiberado = useClientToggle('ia_insights');

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await salesAgentsService.list();
      setAgents(list);
      setSelected((prev) => (prev ? list.find((a) => a.id === prev.id) ?? null : null));
    } catch {
      toast.error('Erro ao carregar os agentes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    inboxesService
      .list()
      .then((res) => {
        const data = ((res as unknown as { data?: InboxOption[] }).data) ?? [];
        setInboxes(data.map((i) => ({ id: i.id, name: i.name })));
      })
      .catch(() => setInboxes([]));
  }, [loadAgents]);

  const createAgent = async () => {
    try {
      const agent = await salesAgentsService.create({
        name: 'Nova IA Vendedora',
        mode: 'seller',
        enabled: false,
        qualification_questions: ['Orçamento', 'Prazo de compra', 'Região de interesse', 'Precisa de financiamento'],
      });
      toast.success('Agente criado');
      await loadAgents();
      setSelected(agent);
      setTab('config');
    } catch {
      toast.error('Erro ao criar o agente');
    }
  };

  const saveAgent = async (patch: Partial<SalesAgent>) => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await salesAgentsService.update(selected.id, {
        name: patch.name ?? selected.name,
        enabled: patch.enabled ?? selected.enabled,
        mode: patch.mode ?? selected.mode,
        persona_role: patch.persona_role ?? selected.persona_role,
        persona_goal: patch.persona_goal ?? selected.persona_goal,
        instructions: patch.instructions ?? selected.instructions,
        greeting: patch.greeting ?? selected.greeting,
        handoff_message: patch.handoff_message ?? selected.handoff_message,
        qualification_questions: patch.qualification_questions ?? selected.qualification_questions,
        inbox_id: patch.inbox_id ?? selected.inbox_id,
        trigger_keyword: patch.trigger_keyword ?? selected.trigger_keyword,
        triggers: patch.triggers ?? selected.triggers,
        trigger_match_mode: patch.trigger_match_mode ?? selected.trigger_match_mode,
        bant_config: patch.bant_config ?? selected.bant_config,
        usage_limits: patch.usage_limits ?? selected.usage_limits,
        model: patch.model ?? selected.model,
        temperature: patch.temperature ?? selected.temperature,
        max_context_tokens: patch.max_context_tokens ?? selected.max_context_tokens,
        active_hours: patch.active_hours ?? selected.active_hours,
        followup_enabled: patch.followup_enabled ?? selected.followup_enabled,
        followup_only: patch.followup_only ?? selected.followup_only,
        followup_min_days: patch.followup_min_days ?? selected.followup_min_days,
        followup_max_days: patch.followup_max_days ?? selected.followup_max_days,
        followup_max_attempts: patch.followup_max_attempts ?? selected.followup_max_attempts,
        // As colunas e o funil entram com `in`, e não com `??`: limpar a escolha
        // manda `null`, e o `??` trocaria o null pelo valor antigo — a tela
        // mostraria "não escolhido" e o servidor continuaria com a coluna velha.
        followup_action: patch.followup_action ?? selected.followup_action,
        followup_stage_id: 'followup_stage_id' in patch ? patch.followup_stage_id : selected.followup_stage_id,
        followup_return_stage_id:
          'followup_return_stage_id' in patch ? patch.followup_return_stage_id : selected.followup_return_stage_id,
        followup_sequence_slug:
          'followup_sequence_slug' in patch ? patch.followup_sequence_slug : selected.followup_sequence_slug,
        followup_drip_enabled: patch.followup_drip_enabled ?? selected.followup_drip_enabled,
        followup_drip_min_leads: patch.followup_drip_min_leads ?? selected.followup_drip_min_leads,
        followup_drip_max_leads: patch.followup_drip_max_leads ?? selected.followup_drip_max_leads,
        followup_drip_min_minutes: patch.followup_drip_min_minutes ?? selected.followup_drip_min_minutes,
        followup_drip_max_minutes: patch.followup_drip_max_minutes ?? selected.followup_drip_max_minutes,
        audio_enabled: patch.audio_enabled ?? selected.audio_enabled,
        audio_mode: patch.audio_mode ?? selected.audio_mode,
        audio_voice_id: patch.audio_voice_id ?? selected.audio_voice_id,
        sales_method: patch.sales_method ?? selected.sales_method,
        social_proof: patch.social_proof ?? selected.social_proof,
        booking_enabled: patch.booking_enabled ?? selected.booking_enabled,
        visit_duration_minutes: patch.visit_duration_minutes ?? selected.visit_duration_minutes,
        example_conversations: patch.example_conversations ?? selected.example_conversations,
        locacao_enabled: patch.locacao_enabled ?? selected.locacao_enabled,
        escalate_on_frustration: patch.escalate_on_frustration ?? selected.escalate_on_frustration,
        escalate_on_human_request: patch.escalate_on_human_request ?? selected.escalate_on_human_request,
        escalate_on_ai_detected: patch.escalate_on_ai_detected ?? selected.escalate_on_ai_detected,
        ai_limits: patch.ai_limits ?? selected.ai_limits,
        crm_policy: patch.crm_policy ?? selected.crm_policy,
        transfer_config: patch.transfer_config ?? selected.transfer_config,
        ask_google_review: patch.ask_google_review ?? selected.ask_google_review,
        google_review_link: patch.google_review_link ?? selected.google_review_link,
        cross_sell_enabled: patch.cross_sell_enabled ?? selected.cross_sell_enabled,
        rich_media_enabled: patch.rich_media_enabled ?? selected.rich_media_enabled,
        visit_config: patch.visit_config ?? selected.visit_config,
        default_property_code: patch.default_property_code ?? selected.default_property_code,
        reply_delay_seconds: patch.reply_delay_seconds ?? selected.reply_delay_seconds,
        default_origin: patch.default_origin ?? selected.default_origin,
        intent_question: patch.intent_question ?? selected.intent_question,
        opening_image_url: patch.opening_image_url ?? selected.opening_image_url,
        opening_audio_url: patch.opening_audio_url ?? selected.opening_audio_url,
        openings: patch.openings ?? selected.openings,
        priority: patch.priority ?? selected.priority,
        followup_respect_active_hours: patch.followup_respect_active_hours ?? selected.followup_respect_active_hours,
        out_of_hours_reply: patch.out_of_hours_reply ?? selected.out_of_hours_reply,
        catalog_search_enabled: patch.catalog_search_enabled ?? selected.catalog_search_enabled,
        // ⚠️ Campo novo PRECISA entrar nesta lista. Ela monta o PATCH campo a
        // campo, e o que não estiver aqui é descartado sem erro nenhum: a tela
        // mostra o valor, o toast diz "Salvo", e nada foi salvo.
        message_split_enabled: patch.message_split_enabled ?? selected.message_split_enabled,
        message_split_max_parts: patch.message_split_max_parts ?? selected.message_split_max_parts,
        pipeline_move_enabled: patch.pipeline_move_enabled ?? selected.pipeline_move_enabled,
        pipeline_id: patch.pipeline_id ?? selected.pipeline_id,
        // A curtida ESTREOU sem estas três linhas, e foi exatamente o defeito que o
        // aviso acima descreve: a chave ficava imóvel na tela e o toast dizia "Salvo".
        // `??` serve para as três — lista vazia e zero não são nulos, então
        // "desmarquei todos os emojis" e "teto zero" chegam ao servidor como escolha.
        reaction_enabled: patch.reaction_enabled ?? selected.reaction_enabled,
        reaction_emojis: patch.reaction_emojis ?? selected.reaction_emojis,
        reaction_max_per_conversation: patch.reaction_max_per_conversation ?? selected.reaction_max_per_conversation,
        // `in` e não `??`: o mapa vazio ({}) é uma escolha legítima ("tirei todas
        // as colunas"), e `??` só trata null/undefined — mas a etapa REMOVIDA some
        // do objeto, então mandar o mapa antigo aqui ressuscitaria a coluna que o
        // gestor acabou de tirar.
        pipeline_stage_map: 'pipeline_stage_map' in patch ? patch.pipeline_stage_map : selected.pipeline_stage_map,
        // `in` e não `??`: aqui null quer dizer "apagar o texto e voltar pro
        // automático", e `??` trataria isso como "não mexeu", tornando o campo
        // impossível de limpar depois de preenchido uma vez.
        out_of_hours_message: 'out_of_hours_message' in patch ? patch.out_of_hours_message : selected.out_of_hours_message,
      });
      setSelected(updated);
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      toast.success('Salvo');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const deleteAgent = async (agent: SalesAgent) => {
    if (!(await confirmar({
      titulo: 'Excluir IA',
      descricao: <>Excluir a IA <strong>{agent.name}</strong>?</>,
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    try {
      await salesAgentsService.destroy(agent.id);
      toast.success('Excluído');
      if (selected?.id === agent.id) setSelected(null);
      await loadAgents();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <>
    <div className="flex h-full">
      {/* Lista */}
      <aside className="w-72 shrink-0 border-r border-sidebar-border p-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-1 h-6 rounded-full shrink-0"
              style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }}
            />
            <h2 className="text-base font-bold flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" /> IA Vendedora
            </h2>
          </div>
          <Button size="sm" onClick={createAgent}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma IA criada. Clique em + para começar.</p>
        ) : (
          <ul className="space-y-1">
            {agents.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => { setSelected(a); setTab('config'); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selected?.id === a.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-sidebar-accent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{a.name}</span>
                    <span className={`ml-2 h-2 w-2 rounded-full shrink-0 ${a.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                  <span className="text-xs text-muted-foreground">{MODE_LABELS[a.mode]}</span>
                  {/* Ligada e sem canal = nunca responde. A seleção do agente filtra
                      por inbox, então agente sem inbox_id não é candidato a nada.
                      Antes isso era silencioso: a IA parecia configurada e não era. */}
                  {a.enabled && !a.inbox_id && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> sem canal
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Editor */}
      <main className="flex-1 min-w-0 overflow-auto p-6">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Selecione ou crie uma IA Vendedora.
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Input
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  onBlur={() => saveAgent({ name: selected.name })}
                  className="text-lg font-semibold w-64"
                />
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.enabled}
                    onChange={(e) => saveAgent({ enabled: e.target.checked })}
                  />
                  {selected.enabled ? 'Ativa' : 'Desativada'}
                </label>
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteAgent(selected)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>

            {/* Abas */}
            <div className="flex gap-1 border-b border-sidebar-border mb-4">
              {(([
                ['config', 'Configuração'],
                ['resultados', 'Resultados'],
                // As duas abaixo são liberadas imobiliária por imobiliária. O gate
                // fica na ABA, nunca na rota — quem digitar o endereço chega na
                // tela, que é o padrão da casa (ver /bolsao e as Landings).
                ...(insightsLiberado ? ([['sugestoes', 'Sugestões'], ['relatorios', 'Relatórios']] as [Tab, string][]) : []),
                ['knowledge', 'Base de Conhecimento'],
                ['learning', 'Aprendizado'],
                ['test', 'Testar'],
                ['diagnostico', 'Diagnóstico'],
              ] as [Tab, string][])).map(
                ([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                      tab === key ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>

            {tab === 'config' && (
              <ConfigTab agent={selected} inboxes={inboxes} saving={saving} onChange={setSelected} onSave={saveAgent} />
            )}
            {tab === 'resultados' && <ResultsTab agent={selected} />}
            {tab === 'sugestoes' && insightsLiberado && <SuggestionsTab agent={selected} />}
            {tab === 'relatorios' && insightsLiberado && <ReportsTab />}
            {tab === 'knowledge' && <KnowledgeTab agent={selected} onCountChange={loadAgents} />}
            {tab === 'learning' && <LearningTab agent={selected} />}
            {tab === 'test' && <TestTab agent={selected} />}
            {tab === 'diagnostico' && <DiagnosticsTab agent={selected} />}
          </div>
        )}
      </main>
    </div>
      {dialogoDeConfirmacao}
    </>
  );
}

// ---------------- Config ----------------

// Formulário -> JSON: o dono responde e o Claude monta a config. Aplica no agente.
const WIZARD_QUESTIONS: { key: string; label: string; placeholder: string }[] = [
  { key: 'nome_da_imobiliaria', label: 'Nome da imobiliária / da IA', placeholder: 'Ex: Imobiliária Aurora' },
  { key: 'o_que_vende', label: 'O que vocês vendem/alugam e onde', placeholder: 'Ex: apartamentos de 2 e 3 quartos na zona sul de SP' },
  { key: 'tom_de_voz', label: 'Tom de voz da marca', placeholder: 'Ex: amigável, direto, próximo' },
  { key: 'diferenciais', label: 'Diferenciais', placeholder: 'Ex: atendimento rápido, visita no fim de semana' },
  { key: 'faz_locacao', label: 'Trabalham com locação?', placeholder: 'Ex: não, só venda' },
  { key: 'prova_social', label: 'Prova social / cases (opcional)', placeholder: 'Ex: a família Souza fechou em 2 semanas' },
];

function ConfigWizard({ onClose, onApply }: { onClose: () => void; onApply: (patch: Partial<SalesAgent>) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedAgentConfig | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const cfg = await salesAgentsService.generateConfig(answers);
      setResult(cfg);
    } catch {
      toast.error('Não consegui gerar. Verifique a chave de IA e tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!result) return;
    onApply({
      persona_role: result.persona_role,
      persona_goal: result.persona_goal,
      instructions: result.instructions,
      greeting: result.greeting,
      social_proof: result.social_proof,
      sales_method: result.sales_method,
      qualification_questions: result.qualification_questions,
    });
    toast.success('Config aplicada');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-background rounded-lg border border-sidebar-border w-full max-w-lg max-h-[85vh] overflow-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Configurar a IA por formulário</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        {!result ? (
          <>
            <p className="text-xs text-muted-foreground">Responda o básico e a IA monta a persona, o tom, as instruções e as perguntas sozinha.</p>
            {WIZARD_QUESTIONS.map((q) => (
              <div key={q.key}>
                <Label htmlFor={`w_${q.key}`} className="text-xs">{q.label}</Label>
                <Textarea id={`w_${q.key}`} rows={2} placeholder={q.placeholder} value={answers[q.key] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))} />
              </div>
            ))}
            <div className="flex justify-end">
              <Button type="button" onClick={generate} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar config'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Revise o que a IA montou. Ao aplicar, substitui a persona, instruções e perguntas do agente.</p>
            <div className="text-sm space-y-2">
              <div><span className="font-medium">Persona:</span> {result.persona_role}</div>
              <div><span className="font-medium">Objetivo:</span> {result.persona_goal}</div>
              <div><span className="font-medium">Saudação:</span> {result.greeting}</div>
              <div><span className="font-medium">Instruções:</span> <span className="text-muted-foreground">{result.instructions}</span></div>
              <div><span className="font-medium">Perguntas:</span> {result.qualification_questions.join(' · ')}</div>
              {result.social_proof && <div><span className="font-medium">Prova social:</span> {result.social_proof}</div>}
            </div>
            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setResult(null)}>Refazer</Button>
              <Button type="button" onClick={apply}>Aplicar no agente</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ConfigTab({
  agent, inboxes, saving, onChange, onSave,
}: {
  agent: SalesAgent;
  inboxes: InboxOption[];
  saving: boolean;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const questionsText = (agent.qualification_questions ?? []).join('\n');
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
          Configurar por formulário
        </Button>
      </div>
      {wizardOpen && <ConfigWizard onClose={() => setWizardOpen(false)} onApply={onSave} />}
      <div>
        <Label>Como a IA atua</Label>
        <div className="grid grid-cols-1 gap-2 mt-1">
          {(Object.keys(MODE_LABELS) as SalesAgentMode[]).map((m) => (
            <label
              key={m}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer ${
                agent.mode === m ? 'border-primary bg-primary/5' : 'border-sidebar-border'
              }`}
            >
              <input type="radio" name="mode" className="mt-1" checked={agent.mode === m} onChange={() => onSave({ mode: m })} />
              <div>
                <div className="text-sm font-medium">{MODE_LABELS[m]}</div>
                <div className="text-xs text-muted-foreground">{MODE_HELP[m]}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="inbox">Instância do WhatsApp que ela opera</Label>
        <select
          id="inbox"
          value={agent.inbox_id ?? ''}
          onChange={(e) => onSave({ inbox_id: e.target.value || null })}
          className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
        >
          <option value="">— Selecione o canal —</option>
          {inboxes.map((i) => (
            <option key={i.id} value={String(i.id)}>{i.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">Escolha a instância (número/canal do WhatsApp) onde a IA vai operar: ela recebe e responde os leads por essa instância.</p>
        {/* Sem canal a IA não é candidata a conversa nenhuma — a seleção filtra por
            inbox. Ligada e sem canal é o pior estado possível: parece pronta e não é. */}
        {agent.enabled && !agent.inbox_id && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
            <span>
              Esta IA está <strong>ligada, mas sem canal</strong> — ela não vai responder
              ninguém. Escolha a instância acima para ela começar a atender.
            </span>
          </div>
        )}
      </div>

      {/* Mais de um agente no mesmo canal é permitido (ex: um só pro lançamento X,
          outro pro resto). Antes disso a escolha era aleatória e podia trocar de
          agente no meio da conversa; agora quem tem gatilho específico ganha, e a
          prioridade desempata. */}
      <div>
        <Label htmlFor="priority">Prioridade neste canal</Label>
        <Input
          id="priority"
          type="number"
          className="mt-1 w-32"
          value={agent.priority ?? 0}
          onChange={(e) => onChange({ ...agent, priority: Number(e.target.value) })}
          onBlur={() => onSave({ priority: Number(agent.priority) || 0 })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Só importa se houver mais de uma IA no mesmo canal: quem tem gatilho específico atende primeiro e, em caso de empate, o número maior ganha. Uma vez que uma IA assume a conversa, ela continua até a transferência.
        </p>
      </div>

      <div>
        <Label htmlFor="keyword">Palavra-chave de ativação (opcional)</Label>
        <Input
          id="keyword"
          placeholder="Ex: fluxoimob"
          value={agent.trigger_keyword ?? ''}
          onChange={(e) => onChange({ ...agent, trigger_keyword: e.target.value })}
          onBlur={() => onSave({ trigger_keyword: (agent.trigger_keyword ?? '').trim() || null })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Se preenchido, a IA só entra na conversa quando o lead mandar essa palavra. Vazio = atende todo lead do canal. Ótimo pra testar sem afetar todos os leads.
        </p>
        {/* Este campo é um gatilho que mora FORA da lista de gatilhos abaixo.
            Quem apaga a lista inteira achando que liberou a IA pra todo mundo
            continua preso na palavra, sem nada na tela dizendo isso. */}
        {(agent.trigger_keyword ?? '').trim() !== '' && (
          <p className="text-xs text-amber-600 mt-1">
            Atenção: enquanto este campo estiver preenchido, a IA <strong>não</strong> atende todo lead do canal, mesmo que
            você apague todos os gatilhos da lista abaixo. Deixe o campo vazio para ela atender todo mundo.
          </p>
        )}
      </div>

      <TriggersSection agent={agent} onSave={onSave} />

      <div>
        <Label htmlFor="role">Quem ela é (persona)</Label>
        <Input
          id="role"
          placeholder="Ex: consultora de imóveis da Imobiliária X"
          value={agent.persona_role ?? ''}
          onChange={(e) => onChange({ ...agent, persona_role: e.target.value })}
          onBlur={() => onSave({ persona_role: agent.persona_role })}
        />
      </div>

      <div>
        <Label htmlFor="goal">Objetivo dela</Label>
        <Input
          id="goal"
          placeholder="Ex: entender o que o lead procura e agendar uma visita"
          value={agent.persona_goal ?? ''}
          onChange={(e) => onChange({ ...agent, persona_goal: e.target.value })}
          onBlur={() => onSave({ persona_goal: agent.persona_goal })}
        />
      </div>

      <div>
        <Label htmlFor="instructions">Instruções (tom, regras, o que fazer)</Label>
        <Textarea
          id="instructions"
          rows={4}
          placeholder="Ex: fale de forma calorosa, sempre confirme o telefone, ofereça agendar visita..."
          value={agent.instructions ?? ''}
          onChange={(e) => onChange({ ...agent, instructions: e.target.value })}
          onBlur={() => onSave({ instructions: agent.instructions })}
        />
      </div>

      <div>
        <Label htmlFor="greeting">Primeira mensagem (opcional)</Label>
        <Textarea
          id="greeting"
          rows={2}
          placeholder="Ex: Oi! Vi que você se interessou por um imóvel. Posso te ajudar?"
          value={agent.greeting ?? ''}
          onChange={(e) => onChange({ ...agent, greeting: e.target.value })}
          onBlur={() => onSave({ greeting: agent.greeting })}
        />
      </div>

      <div>
        <Label htmlFor="questions">Perguntas de qualificação (uma por linha)</Label>
        <Textarea
          id="questions"
          rows={5}
          value={questionsText}
          onChange={(e) => onChange({ ...agent, qualification_questions: e.target.value.split('\n') })}
          onBlur={() =>
            onSave({ qualification_questions: (agent.qualification_questions ?? []).map((q) => q.trim()).filter(Boolean) })
          }
        />
      </div>

      <div>
        <Label htmlFor="default_prop">Imóvel padrão (código da aba Imóveis)</Label>
        <Input
          id="default_prop"
          placeholder="Ex: ALMA"
          value={agent.default_property_code ?? ''}
          onChange={(e) => onChange({ ...agent, default_property_code: e.target.value })}
          onBlur={() => onSave({ default_property_code: (agent.default_property_code ?? '').trim().toUpperCase() || null })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Pra agente de UM empreendimento: a IA sempre usa este imóvel da aba Imóveis (dados, preço, condições), mesmo sem código na mensagem. Deixe vazio pra ela detectar o imóvel por código/anúncio.
        </p>
      </div>

      <BantSection agent={agent} onChange={onChange} onSave={onSave} />
      <RecepcaoSection agent={agent} onChange={onChange} onSave={onSave} />
      <VisitSection agent={agent} onChange={onChange} onSave={onSave} />
      <IntelligenceSection agent={agent} onChange={onChange} onSave={onSave} />
      <ScheduleSection agent={agent} onSave={onSave} />
      <LimitsSection agent={agent} onChange={onChange} onSave={onSave} />
      <AudioSection agent={agent} onChange={onChange} onSave={onSave} />
      <ReactionSection agent={agent} onSave={onSave} />
      <FollowupSection agent={agent} onChange={onChange} onSave={onSave} />
      <AdvancedSection agent={agent} onChange={onChange} onSave={onSave} />

      {saving && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</p>}
    </div>
  );
}

// ---------------- Horário de atuação ----------------

const SCHEDULE_OPTIONS: [ActiveHoursMode, string, string][] = [
  ['outside_business', 'Fora do horário comercial (18h às 07h)', 'Só responde à noite/madrugada — quando não tem ninguém no time.'],
  ['custom', 'Horário personalizado', 'Você escolhe a janela em que ela responde.'],
];

// Toggle liga/desliga reutilizável
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted-foreground/40'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ---------------- Áudio (voz) ----------------

const AUDIO_MODE_OPTIONS: { value: 'mirror' | 'always' | 'never'; label: string }[] = [
  { value: 'mirror', label: 'Espelhar o lead (recomendado) — voz só se ele mandou áudio' },
  { value: 'always', label: 'Sempre em áudio' },
  { value: 'never', label: 'Nunca (só texto)' },
];

/**
 * Curtir mensagem do cliente.
 *
 * A curtida SAI no WhatsApp do lead — não é marca interna —, então a lista de
 * emojis é decisão de marca da imobiliária, não do modelo. Nasce desligada:
 * ligar por padrão faria a IA começar a reagir no WhatsApp de leads de quem
 * nunca pediu.
 */
const REACTION_EMOJI_OPTIONS = ['👍', '❤️', '😂', '🙏', '🔥', '👏', '😍', '✅', '🎉', '😉'];

function ReactionSection({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const on = !!agent.reaction_enabled;
  const selecionados = agent.reaction_emojis ?? [];

  // O teto tem estado PRÓPRIO enquanto se digita, e só grava ao sair do campo.
  // Gravando a cada tecla, digitar "10" salvava 1 e depois 10; e apagar a caixa
  // pra redigitar salvava ZERO, que aqui quer dizer DESLIGAR a curtida.
  const [teto, setTeto] = useState(String(agent.reaction_max_per_conversation ?? 3));
  useEffect(() => {
    setTeto(String(agent.reaction_max_per_conversation ?? 3));
  }, [agent.id, agent.reaction_max_per_conversation]);

  // Caixa vazia ao sair = "não mexi", nunca zero: zero é uma escolha destrutiva
  // (desliga a curtida) e ninguém a faz apagando um campo pra redigitar.
  const gravarTeto = () => {
    const texto = teto.trim();
    if (texto === '' || Number.isNaN(Number(texto))) {
      setTeto(String(agent.reaction_max_per_conversation ?? 3));
      return;
    }
    onSave({ reaction_max_per_conversation: Number(texto) });
  };

  const alternar = (emoji: string) => {
    const proxima = selecionados.includes(emoji)
      ? selecionados.filter((e) => e !== emoji)
      : [...selecionados, emoji];
    // Lista vazia volta a valer o padrão de fábrica no servidor — nunca "nenhum
    // emoji", que seria indistinguível de a curtida estar quebrada.
    onSave({ reaction_emojis: proxima });
  };

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Curtir mensagens do cliente</div>
          <div className="text-xs text-muted-foreground">
            A IA reage com emoji na mensagem do lead, como uma pessoa faz. A curtida aparece no
            WhatsApp dele. Serve pra fechar conversa sem esticar: um "obrigado, até amanhã!" recebe
            um 👍 em vez de mais uma mensagem.
          </div>
        </div>
        <Toggle on={on} onChange={(v) => onSave({ reaction_enabled: v })} />
      </div>

      {on && (
        <div className="mt-3 space-y-3 pl-1">
          <div>
            <Label className="text-xs">Emojis que ela pode usar</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REACTION_EMOJI_OPTIONS.map((emoji) => {
                const ativo = selecionados.includes(emoji);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => alternar(emoji)}
                    aria-pressed={ativo}
                    className={`h-9 w-9 rounded-md border text-lg leading-none transition ${
                      ativo
                        ? 'border-primary bg-primary/10'
                        : 'border-sidebar-border bg-background opacity-50 hover:opacity-100'
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Nenhum marcado = a IA usa a lista padrão (👍 ❤️ 😂 🙏 🔥).
            </p>
          </div>

          <div>
            <Label htmlFor="reaction_max" className="text-xs">No máximo quantas curtidas por conversa</Label>
            <Input
              id="reaction_max"
              type="number"
              min={0}
              max={20}
              value={teto}
              onChange={(e) => setTeto(e.target.value)}
              onBlur={gravarTeto}
              className="mt-1 w-28"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Curtida demais deixa de ser gentileza e vira ruído. Zero desliga a curtida.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AudioSection({ agent, onChange, onSave }: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const on = agent.audio_enabled;
  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Áudio (voz)</div>
          <div className="text-xs text-muted-foreground">
            A IA sempre ENTENDE os áudios do lead (transcrição automática). Ligue aqui pra ela também RESPONDER em voz.
          </div>
        </div>
        <Toggle on={!!on} onChange={(v) => onSave({ audio_enabled: v })} />
      </div>

      {on && (
        <div className="mt-3 space-y-3 pl-1">
          <div>
            <Label htmlFor="audio_mode" className="text-xs">Quando responder por áudio</Label>
            <select
              id="audio_mode"
              value={agent.audio_mode ?? 'mirror'}
              onChange={(e) => onSave({ audio_mode: e.target.value as 'mirror' | 'always' | 'never' })}
              className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
            >
              {AUDIO_MODE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="audio_voice" className="text-xs">Voz (ID do ElevenLabs)</Label>
            <Input
              id="audio_voice"
              placeholder="rnJZLKxtlBZt77uIED10 (Sergio, padrão)"
              value={agent.audio_voice_id ?? ''}
              onChange={(e) => onChange({ ...agent, audio_voice_id: e.target.value })}
              onBlur={() => onSave({ audio_voice_id: (agent.audio_voice_id ?? '').trim() || null })}
            />
            <p className="text-xs text-muted-foreground mt-1">A IA fala como homem — use uma voz masculina. Vazio = Sergio (padrão).</p>
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_WINDOW: ActiveHoursWindow = { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] };

function ScheduleSection({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const hours: ActiveHours = agent.active_hours ?? {};
  const mode: ActiveHoursMode = hours.mode ?? 'always';
  const enabled = mode !== 'always';
  const windows: ActiveHoursWindow[] = hours.windows?.length ? hours.windows : [DEFAULT_WINDOW];

  const commit = (patch: Partial<ActiveHours>) =>
    onSave({ active_hours: { ...hours, tz: hours.tz ?? 'America/Sao_Paulo', ...patch } });

  const toggleEnabled = (on: boolean) => commit({ mode: on ? 'custom' : 'always', windows: on ? windows : hours.windows });
  const setMode = (m: ActiveHoursMode) =>
    commit({ mode: m, windows: m === 'custom' && !hours.windows?.length ? [DEFAULT_WINDOW] : hours.windows });

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Horário de atuação</Label>
          <p className="text-xs text-muted-foreground">Desligado = a IA responde a qualquer hora (24h).</p>
        </div>
        <Toggle on={enabled} onChange={toggleEnabled} />
      </div>

      {enabled && (
        <div className="grid grid-cols-1 gap-2 mt-2">
          {SCHEDULE_OPTIONS.map(([m, title, help]) => (
            <label
              key={m}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer ${
                mode === m ? 'border-primary bg-primary/5' : 'border-sidebar-border'
              }`}
            >
              <input type="radio" name="schedule_mode" className="mt-1" checked={mode === m} onChange={() => setMode(m)} />
              <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="text-xs text-muted-foreground">{help}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Várias janelas, cada uma com seus dias. Antes só existia UMA janela e os
          dias nem apareciam: "segunda a sexta das 8h às 18h, fechado no almoço"
          era impossível de configurar.

          O editor mora em components/schedule desde que a roleta passou a ter
          horário também — duas cópias da regra de dias/meia-noite divergiriam. */}
      {enabled && mode === 'custom' && (
        <div className="mt-2">
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => commit({ mode: 'custom', windows: [DEFAULT_WINDOW] })}
          >
            Aplicar horário comercial padrão (08h às 18h, seg a sex)
          </button>
        </div>
      )}
      {enabled && mode === 'custom' && (
        <WeeklyWindowsEditor
          value={windows}
          idPrefix="ia_win"
          onChange={(next) => commit({ mode: 'custom', windows: next })}
        />
      )}

      {enabled && <OutOfHoursSection agent={agent} onSave={onSave} />}
    </div>
  );
}

// Fora do horário o lead recebia SILÊNCIO: o sistema só parava de responder e
// ninguém retomava depois. Aqui o dono liga um aviso automático, que não passa
// pelo Claude (custo zero) e sai no máximo uma vez por conversa por dia.
function OutOfHoursSection({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const on = !!agent.out_of_hours_reply;
  const [draft, setDraft] = useState(agent.out_of_hours_message ?? '');

  useEffect(() => { setDraft(agent.out_of_hours_message ?? ''); }, [agent.id, agent.out_of_hours_message]);

  return (
    <div className="mt-4 pt-3 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Avisar quem escrever fora do horário</div>
          <div className="text-xs text-muted-foreground">
            Sem isso, o lead que manda mensagem de madrugada não recebe absolutamente nada.
          </div>
        </div>
        <Toggle on={on} onChange={(v) => onSave({ out_of_hours_reply: v })} />
      </div>

      {on && (
        <div className="mt-2">
          <Label htmlFor="ooh_msg" className="text-xs">Mensagem (opcional)</Label>
          <Textarea
            id="ooh_msg"
            rows={2}
            className="mt-1"
            placeholder="Vazio = a IA escreve sozinha e já diz quando volta (ex: “te respondo amanhã às 8h”)."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => onSave({ out_of_hours_message: draft.trim() || null })}
          />
        </div>
      )}
    </div>
  );
}

// ---------------- Qualificação, método de venda e visita ----------------

const SALES_METHOD_OPTIONS: [SalesMethod, string, string][] = [
  ['consultative', 'Consultiva + SPIN (recomendado)', 'Descobre a história e a dor da pessoa antes de oferecer. A visita nasce natural, sem empurrão.'],
  ['spin', 'SPIN estruturado', 'Conduz mais explicitamente pelas etapas de descoberta (situação, problema, implicação, solução).'],
  ['direct', 'Direta', 'Lead já quente: confirma o essencial e vai direto pro agendamento da visita.'],
];

function VisitSection({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const method = agent.sales_method ?? 'consultative';
  const booking = agent.booking_enabled ?? true;
  const examples = agent.example_conversations ?? [];

  const updateExample = (i: number, field: 'lead' | 'resposta', value: string) => {
    const next = examples.map((ex, idx) => (idx === i ? { ...ex, [field]: value } : ex));
    onChange({ ...agent, example_conversations: next });
  };
  const commitExamples = () => {
    const clean = (agent.example_conversations ?? [])
      .map((ex) => ({ lead: (ex.lead ?? '').trim(), resposta: (ex.resposta ?? '').trim() }))
      .filter((ex) => ex.resposta);
    onSave({ example_conversations: clean });
  };
  const addExample = () => onSave({ example_conversations: [...examples, { lead: '', resposta: '' }] });
  const removeExample = (i: number) => onSave({ example_conversations: examples.filter((_, idx) => idx !== i) });

  return (
    <div className="pt-2 border-t border-sidebar-border space-y-4">
      <div>
        <Label htmlFor="sales_method">Como a IA conduz a venda</Label>
        <select
          id="sales_method"
          value={method}
          onChange={(e) => onSave({ sales_method: e.target.value as SalesMethod })}
          className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
        >
          {SALES_METHOD_OPTIONS.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          {SALES_METHOD_OPTIONS.find(([id]) => id === method)?.[2]}
        </p>
      </div>

      <div>
        <Label htmlFor="social_proof">Prova social / cases (a IA usa pra gerar confiança, sem inventar)</Label>
        <Textarea
          id="social_proof"
          rows={3}
          placeholder="Ex: A família Souza fechou o apê dos sonhos com a gente em 2 semanas."
          value={agent.social_proof ?? ''}
          onChange={(e) => onChange({ ...agent, social_proof: e.target.value })}
          onBlur={() => onSave({ social_proof: (agent.social_proof ?? '').trim() || null })}
        />
        <p className="text-xs text-muted-foreground mt-1">A IA só cita o que estiver aqui (nunca inventa número ou case).</p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Agendar visita sozinha</div>
            <div className="text-xs text-muted-foreground">
              Quando o lead topar, a IA marca a visita direto (com dia e hora), cria o agendamento e dispara os lembretes. Desligado = ela passa pro corretor marcar.
            </div>
          </div>
          <Toggle on={!!booking} onChange={(v) => onSave({ booking_enabled: v })} />
        </div>
        {booking && (
          <div className="mt-3 pl-7 space-y-3">
            <div>
              <Label htmlFor="visit_dur" className="text-xs">Duração da visita (minutos)</Label>
              <Input id="visit_dur" type="number" min={15} max={480} value={agent.visit_duration_minutes ?? 60} className="mt-1 w-28"
                onChange={(e) => onChange({ ...agent, visit_duration_minutes: Number(e.target.value) })}
                onBlur={() => onSave({ visit_duration_minutes: Math.max(15, Number(agent.visit_duration_minutes) || 60) })} />
            </div>
            <VisitWindows agent={agent} onSave={onSave} />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <Label>Exemplos de conversas que funcionaram (a IA imita o tom)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addExample}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-2">
          Cole trechos reais que deram certo: o que o lead disse e como um bom corretor respondeu. A IA aprende o ritmo e o jeito humano (não copia literal).
        </p>
        {examples.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhum exemplo ainda. Opcional, mas ajuda muito a humanizar.</p>
        )}
        <div className="space-y-3">
          {examples.map((ex, i) => (
            <div key={i} className="rounded-md border border-sidebar-border p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Exemplo {i + 1}</span>
                <button type="button" onClick={() => removeExample(i)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                placeholder="O que o lead disse (ex: quero um 2 quartos até 300 mil)"
                value={ex.lead ?? ''}
                onChange={(e) => updateExample(i, 'lead', e.target.value)}
                onBlur={commitExamples}
              />
              <Textarea
                rows={2}
                placeholder="Como o corretor respondeu (ex: boa! tá procurando pra morar ou investir?)"
                value={ex.resposta ?? ''}
                onChange={(e) => updateExample(i, 'resposta', e.target.value)}
                onBlur={commitExamples}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Janelas de disponibilidade da visita ----------------

function VisitWindows({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const c = agent.visit_config ?? {};
  const days = c.days ?? [1, 2, 3, 4, 5];
  const blockedDates = c.blocked_dates ?? [];
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const patch = (p: Partial<NonNullable<SalesAgent['visit_config']>>) => onSave({ visit_config: { ...c, ...p } });
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    patch({ days: next });
  };
  const addBlockedDate = () => {
    if (!newBlockedDate || blockedDates.includes(newBlockedDate)) return;
    patch({ blocked_dates: [...blockedDates, newBlockedDate].sort() });
    setNewBlockedDate('');
  };
  const removeBlockedDate = (d: string) => patch({ blocked_dates: blockedDates.filter((x) => x !== d) });

  return (
    <div className="space-y-2">
      <Label className="text-xs">Quando a IA pode marcar visita</Label>
      <div className="flex flex-wrap gap-1">
        {WEEKDAYS.map(([d, label]) => (
          <button key={d} type="button" onClick={() => toggleDay(d)}
            className={`px-2 py-1 rounded text-xs border ${days.includes(d) ? 'bg-primary/10 text-primary border-primary/40' : 'border-sidebar-border text-muted-foreground'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <Label htmlFor="vw_start" className="text-xs">Das</Label>
          <Input id="vw_start" type="time" value={c.start ?? '09:00'} className="mt-1 w-28"
            onChange={(e) => patch({ start: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="vw_end" className="text-xs">até</Label>
          <Input id="vw_end" type="time" value={c.end ?? '18:00'} className="mt-1 w-28"
            onChange={(e) => patch({ end: e.target.value })} />
        </div>
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <Label htmlFor="vw_min" className="text-xs">Antecedência mín. (horas)</Label>
          <Input id="vw_min" type="number" min={0} max={720} value={c.min_advance_hours ?? 24} className="mt-1 w-24"
            onChange={(e) => patch({ min_advance_hours: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="vw_max" className="text-xs">máx. (dias)</Label>
          <Input id="vw_max" type="number" min={1} max={365} value={c.max_advance_days ?? 30} className="mt-1 w-24"
            onChange={(e) => patch({ max_advance_days: Number(e.target.value) })} />
        </div>
      </div>

      {/* Granularidade de CALENDÁRIO, além do dia da semana recorrente: feriado,
          plantão fechado, manutenção — datas específicas que nunca aparecem como
          opção pra IA, mesmo caindo num dia da semana liberado acima. */}
      <div className="pt-2">
        <Label className="text-xs">Datas bloqueadas no calendário (feriado, plantão fechado etc)</Label>
        <div className="flex items-end gap-2 mt-1">
          <Input type="date" value={newBlockedDate} className="w-40"
            onChange={(e) => setNewBlockedDate(e.target.value)} />
          <Button type="button" variant="outline" size="sm" onClick={addBlockedDate} disabled={!newBlockedDate}>
            <Plus className="h-3 w-3 mr-1" /> Bloquear data
          </Button>
        </div>
        {blockedDates.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-1">Nenhuma data bloqueada.</p>
        ) : (
          <div className="flex flex-wrap gap-1 mt-2">
            {blockedDates.map((d) => (
              <span key={d} className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-sidebar-border">
                {d}
                <button type="button" onClick={() => removeBlockedDate(d)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sem isto, dois leads diferentes podiam sair com o MESMO horário marcado
          pro mesmo imóvel — a IA não enxergava a visita agendada pelo OUTRO lead. */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          <Label className="text-xs">Evitar dois leads no mesmo horário</Label>
          <p className="text-xs text-muted-foreground">Antes de marcar, confere se já não tem outra visita no mesmo imóvel no mesmo horário.</p>
        </div>
        <Toggle on={c.avoid_double_booking !== false} onChange={(v) => patch({ avoid_double_booking: v })} />
      </div>
    </div>
  );
}

// ---------------- Inteligência, limites e escopo (Fase 3) ----------------

function CheckRow({ checked, onChange, title, desc }: {
  checked: boolean; onChange: (v: boolean) => void; title: string; desc?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div>
        <div className="text-sm font-medium">{title}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
    </label>
  );
}

// ---------------- BANT (qualificação estruturada) ----------------

const BANT_DEFAULT_QUESTIONS: Record<keyof Pick<BantConfig, 'budget_question' | 'authority_question' | 'need_question' | 'timeline_question'>, string> = {
  budget_question: 'Qual faixa de investimento você tem em mente pra esse imóvel?',
  authority_question: 'Essa decisão é só sua ou mais alguém participa (cônjuge, sócio, família)?',
  need_question: 'O que está fazendo você procurar um imóvel agora?',
  timeline_question: 'Em quanto tempo pretende fechar negócio?',
};

function BantSection({ agent, onChange, onSave }: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const cfg: BantConfig = agent.bant_config ?? {};
  const on = !!cfg.enabled;
  const patch = (p: Partial<BantConfig>) => onChange({ ...agent, bant_config: { ...cfg, ...p } });
  const commit = (p: Partial<BantConfig>) => onSave({ bant_config: { ...cfg, ...p } });

  const field = (key: keyof typeof BANT_DEFAULT_QUESTIONS, label: string) => (
    <div>
      <Label htmlFor={`bant_${key}`} className="text-xs">{label}</Label>
      <Textarea
        id={`bant_${key}`}
        rows={2}
        className="mt-1"
        placeholder={BANT_DEFAULT_QUESTIONS[key]}
        value={cfg[key] ?? ''}
        onChange={(e) => patch({ [key]: e.target.value } as Partial<BantConfig>)}
        onBlur={() => commit({ [key]: (cfg[key] ?? '').trim() || undefined } as Partial<BantConfig>)}
      />
    </div>
  );

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Qualificação BANT</div>
          <div className="text-xs text-muted-foreground">
            Budget, Authority, Need, Timeline: os 4 pontos que decidem se o lead está pronto pra avançar. A IA cobre
            os 4 ao longo da conversa (sem virar interrogatório) e registra o que descobrir.
          </div>
        </div>
        <Toggle on={on} onChange={(v) => onSave({ bant_config: { ...cfg, enabled: v } })} />
      </div>

      {on && (
        <div className="mt-3 space-y-3 pl-1">
          {field('budget_question', 'Orçamento (Budget)')}
          {field('authority_question', 'Quem decide (Authority)')}
          {field('need_question', 'Necessidade real (Need)')}
          {field('timeline_question', 'Prazo (Timeline)')}

          <div>
            <Label htmlFor="bant_criteria" className="text-xs">Critério de qualificação</Label>
            <Textarea
              id="bant_criteria"
              rows={3}
              className="mt-1"
              placeholder="Ex: qualificado quando tem orçamento compatível com o imóvel E decide sozinho ou já envolveu quem decide E quer fechar em até 3 meses"
              value={cfg.qualify_criteria ?? ''}
              onChange={(e) => patch({ qualify_criteria: e.target.value })}
              onBlur={() => commit({ qualify_criteria: (cfg.qualify_criteria ?? '').trim() || undefined })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Escreva em texto livre o que torna um lead qualificado pra você. A IA usa isso pra marcar o lead como
              qualificado ou não (aparece como etiqueta na conversa). Vazio = ela nunca decide sozinha.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Limites de volume e uso ----------------

function LimitsSection({ agent, onChange, onSave }: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const limits: UsageLimits = agent.usage_limits ?? {};
  const patch = (p: Partial<UsageLimits>) => onChange({ ...agent, usage_limits: { ...limits, ...p } });
  const commit = (p: Partial<UsageLimits>) => onSave({ usage_limits: { ...limits, ...p } });

  const numField = (
    key: keyof UsageLimits, label: string, help: string, id: string,
  ) => (
    <div>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        placeholder="Sem limite"
        className="mt-1 w-40"
        value={limits[key] ?? ''}
        onChange={(e) => patch({ [key]: e.target.value === '' ? null : Number(e.target.value) } as Partial<UsageLimits>)}
        onBlur={() => commit({ [key]: limits[key] || null } as Partial<UsageLimits>)}
      />
      <p className="text-xs text-muted-foreground mt-1">{help}</p>
    </div>
  );

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="text-sm font-medium mb-1">Limites de volume e uso</div>
      <div className="text-xs text-muted-foreground mb-3">
        Tetos de VOLUME (diferente dos "Limites da IA" acima, que são de conteúdo). Uma conversa já em andamento
        nunca é cortada, mesmo com o teto batido — só a entrada de lead NOVO para. Vazio = sem limite.
      </div>
      <div className="space-y-3">
        {numField('max_new_leads_per_day', 'Máx. de leads novos por dia', 'Depois desse número de leads NOVOS no dia, a IA para de puxar conversa nova (quem já está conversando continua).', 'lim_leads')}
        {numField('max_active_conversations', 'Máx. de conversas ativas ao mesmo tempo', 'Teto de conversas em aberto que a IA está tocando ao mesmo tempo.', 'lim_conv')}
        {numField('daily_budget_usd', 'Orçamento diário (USD)', 'Quando o gasto do dia (mesma conta da aba Resultados) bate este valor, a IA para de atender lead novo até o dia seguinte.', 'lim_budget')}
      </div>
    </div>
  );
}

// ---------------- Print / áudio: subir arquivo ou colar link ----------------

/**
 * O campo continua guardando uma URL — o que muda é de onde ela vem. Antes só dava
 * pra colar link, o que na prática significava ter que hospedar a imagem em algum
 * lugar antes; quem tinha o print no computador ficava sem saída e não usava o
 * recurso. O campo de colar link segue disponível pra quem já usa.
 */
function MediaField({
  agentId, kind, label, value, onChange, onSave,
}: {
  agentId: string;
  kind: 'image' | 'audio';
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  const accept = kind === 'image' ? '.jpg,.jpeg,.png,.webp' : '.mp3,.ogg,.m4a,.wav';
  const hint = kind === 'image' ? 'JPG, PNG ou WebP' : 'MP3, OGG, M4A ou WAV';

  const upload = async (file: File) => {
    setProgress(0);
    try {
      const { url } = await salesAgentsService.uploadMedia(agentId, file, kind, setProgress);
      onChange(url);
      onSave(url);
      toast.success('Arquivo enviado');
    } catch {
      toast.error('Não consegui enviar o arquivo');
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-3">
        {value && kind === 'image' && (
          <img src={value} alt="" className="h-14 w-14 rounded object-cover border border-sidebar-border" />
        )}
        {value && kind === 'audio' && (
          <audio src={value} controls className="h-9 max-w-[220px]" />
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs px-2 py-1 rounded border border-sidebar-border cursor-pointer hover:border-primary/50">
            {value ? 'Trocar' : 'Escolher arquivo'}
            <input
              type="file" className="hidden" accept={accept}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
            />
          </label>
          {value && (
            <button type="button" className="text-xs text-red-500 hover:underline"
                    onClick={() => { onChange(''); onSave(''); }}>
              Remover
            </button>
          )}
          <button type="button" className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setShowUrl((v) => !v)}>
            ou colar um link
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{hint}, até 25 MB.</p>
      {progress !== null && (
        <div className="mt-2 h-1.5 bg-sidebar-border rounded overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {showUrl && (
        <Input
          className="mt-2"
          placeholder={kind === 'image' ? 'https://...jpg' : 'https://...ogg'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onSave(value.trim())}
        />
      )}
    </div>
  );
}

// ---------------- Recepção inicial (primeiro contato) ----------------

function RecepcaoSection({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const openings = agent.openings ?? [];

  const patchOpening = (i: number, patch: Partial<SalesAgentOpening>) => {
    const next = openings.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    onChange({ ...agent, openings: next });
  };
  const commitOpenings = (next: SalesAgentOpening[]) => onSave({ openings: next });
  const addOpening = () =>
    commitOpenings([...openings, { label: 'Nova campanha', origins: [], form_ids: [], keywords: [] }]);
  const removeOpening = (i: number) => commitOpenings(openings.filter((_, idx) => idx !== i));

  const list = (arr?: string[]) => (arr ?? []).join(', ');
  const toArr = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  return (
    <div className="pt-2 border-t border-sidebar-border space-y-5">
      <div>
        <div className="text-sm font-medium">Recepção inicial (primeiro contato)</div>
        <div className="text-xs text-muted-foreground">
          A abertura padrão da IA: nome do lead, apresentação, de onde ele veio e a pergunta que segmenta a intenção.
          Print e áudio são opcionais. Sem eles, a IA manda só os textos.
        </div>
      </div>

      <div>
        <Label htmlFor="default_origin">De onde o lead veio (origem)</Label>
        <Input
          id="default_origin"
          placeholder="Ex: nosso anúncio do Instagram"
          value={agent.default_origin ?? ''}
          onChange={(e) => onChange({ ...agent, default_origin: e.target.value })}
          onBlur={() => onSave({ default_origin: (agent.default_origin ?? '').trim() || null })}
        />
        <p className="text-xs text-muted-foreground mt-1">A IA cita isso na abertura quando o lead não traz a origem do anúncio.</p>
      </div>

      <div>
        <Label htmlFor="intent_question">Pergunta de intenção (fecha a abertura)</Label>
        <Textarea
          id="intent_question"
          rows={2}
          placeholder="Ex: seu foco é moradia, investimento ou ainda tá só sondando?"
          value={agent.intent_question ?? ''}
          onChange={(e) => onChange({ ...agent, intent_question: e.target.value })}
          onBlur={() => onSave({ intent_question: (agent.intent_question ?? '').trim() || null })}
        />
        <p className="text-xs text-muted-foreground mt-1">É a pergunta que gera diálogo e segmenta o lead. A IA sempre fecha a abertura com ela.</p>
      </div>

      <div>
        <Label htmlFor="reply_delay">Tempo de espera antes de responder (segundos)</Label>
        <Input
          id="reply_delay"
          type="number"
          min={0}
          max={120}
          placeholder="10"
          value={agent.reply_delay_seconds ?? ''}
          onChange={(e) => onChange({ ...agent, reply_delay_seconds: e.target.value === '' ? 0 : Number(e.target.value) })}
          onBlur={() => onSave({ reply_delay_seconds: Math.max(0, Number(agent.reply_delay_seconds) || 0) })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          A IA espera esse tempo pra juntar mensagens antes de responder. Se o lead manda 2-3 mensagens seguidas, ela lê todas e responde uma vez, com contexto. Vazio/0 = padrão de 10s.
        </p>
      </div>

      {/*
        Fica colado no campo acima de propósito: os dois falam do ritmo da conversa.
        Aquele é o tempo de ESPERA (juntar o que o lead mandou); este é o ritmo da
        RESPOSTA (espalhar o que a IA vai mandar). Separá-los faria procurar em
        dois lugares a mesma coisa.
      */}
      <div className="rounded-md border p-3 space-y-3">
        <CheckRow
          checked={agent.message_split_enabled !== false}
          onChange={(v) => { onChange({ ...agent, message_split_enabled: v }); onSave({ message_split_enabled: v }); }}
          title="Responder em várias mensagens"
          desc="A IA divide a resposta em mensagens curtas, com 'digitando...' entre elas, como um corretor no WhatsApp. Desligada, ela manda tudo numa mensagem só."
        />
        {agent.message_split_enabled !== false && (
          <div>
            <Label htmlFor="message_split_max_parts">No máximo quantas mensagens por resposta</Label>
            <Input
              id="message_split_max_parts"
              type="number"
              min={2}
              max={4}
              placeholder="3"
              value={agent.message_split_max_parts ?? ''}
              onChange={(e) => onChange({ ...agent, message_split_max_parts: e.target.value === '' ? 0 : Number(e.target.value) })}
              onBlur={() => onSave({ message_split_max_parts: Math.min(4, Math.max(2, Number(agent.message_split_max_parts) || 3)) })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              É teto, não meta: resposta curta continua saindo numa mensagem só. O limite de 4 existe porque
              rajada de mensagens é o que mais faz o WhatsApp tratar um número como robô.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <MediaField
          agentId={agent.id} kind="image" label="Print de abertura (opcional)"
          value={agent.opening_image_url ?? ''}
          onChange={(v) => onChange({ ...agent, opening_image_url: v })}
          onSave={(v) => onSave({ opening_image_url: v || null })}
        />
        <MediaField
          agentId={agent.id} kind="audio" label="Áudio de abertura (opcional)"
          value={agent.opening_audio_url ?? ''}
          onChange={(v) => onChange({ ...agent, opening_audio_url: v })}
          onSave={(v) => onSave({ opening_audio_url: v || null })}
        />
      </div>

      {/* Recepções por campanha */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium">Recepções por campanha</div>
          <Button variant="outline" size="sm" onClick={addOpening}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          Abertura, pergunta, print e áudio diferentes por origem, formulário do Meta ou palavra-chave. A IA usa a 1ª que combinar; senão, a recepção padrão acima.
        </div>

        {openings.length === 0 && (
          <div className="text-xs text-muted-foreground italic">Nenhuma. A IA usa a recepção padrão pra todos.</div>
        )}

        <div className="space-y-4">
          {openings.map((o, i) => (
            <div key={i} className="rounded-lg border border-sidebar-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Input
                  className="font-medium"
                  placeholder="Nome (ex: Alma Panamby - Instagram)"
                  value={o.label ?? ''}
                  onChange={(e) => patchOpening(i, { label: e.target.value })}
                  onBlur={() => commitOpenings(openings)}
                />
                <Button variant="ghost" size="sm" onClick={() => removeOpening(i)} title="Remover">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Origens (vírgula)</Label>
                  <Input placeholder="instagram, alma, campanha X"
                    value={list(o.origins)}
                    onChange={(e) => patchOpening(i, { origins: toArr(e.target.value) })}
                    onBlur={() => commitOpenings(openings)} />
                </div>
                <div>
                  <Label className="text-xs">IDs de formulário Meta (vírgula)</Label>
                  <Input placeholder="123456789"
                    value={list(o.form_ids)}
                    onChange={(e) => patchOpening(i, { form_ids: toArr(e.target.value) })}
                    onBlur={() => commitOpenings(openings)} />
                </div>
                <div>
                  <Label className="text-xs">Palavras-chave (vírgula)</Label>
                  <Input placeholder="alma, torre 2"
                    value={list(o.keywords)}
                    onChange={(e) => patchOpening(i, { keywords: toArr(e.target.value) })}
                    onBlur={() => commitOpenings(openings)} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Abertura desta campanha</Label>
                <Textarea rows={2} placeholder="Deixe vazio pra usar a padrão"
                  value={o.greeting ?? ''}
                  onChange={(e) => patchOpening(i, { greeting: e.target.value })}
                  onBlur={() => commitOpenings(openings)} />
              </div>
              <div>
                <Label className="text-xs">Pergunta de intenção desta campanha</Label>
                <Textarea rows={2} placeholder="Deixe vazio pra usar a padrão"
                  value={o.intent_question ?? ''}
                  onChange={(e) => patchOpening(i, { intent_question: e.target.value })}
                  onBlur={() => commitOpenings(openings)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <MediaField
                  agentId={agent.id} kind="image" label="Print desta campanha"
                  value={o.image_url ?? ''}
                  onChange={(v) => patchOpening(i, { image_url: v })}
                  onSave={(v) => commitOpenings(openings.map((op, idx) => (idx === i ? { ...op, image_url: v } : op)))}
                />
                <MediaField
                  agentId={agent.id} kind="audio" label="Áudio desta campanha"
                  value={o.audio_url ?? ''}
                  onChange={(v) => patchOpening(i, { audio_url: v })}
                  onSave={(v) => commitOpenings(openings.map((op, idx) => (idx === i ? { ...op, audio_url: v } : op)))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Quando ela passa para um corretor ----------------

/**
 * O cenário de repasse: a única coisa que a imobiliária tem para dizer QUANDO a IA
 * entrega o lead a um humano. Até aqui quem decidia era a IA sozinha, a cada resposta.
 *
 * Cartões, e não uma lista suspensa, porque cada opção muda o volume de lead que cai no
 * colo do corretor — a consequência precisa estar visível na hora de escolher, não
 * escondida atrás de um clique.
 *
 * O primeiro cartão é "Como está hoje" e é o que fica marcado em toda imobiliária que já
 * existe: cenário novo não muda o comportamento de quem nunca escolheu nada.
 */
const HANDOFF_OPTIONS: { value: HandoffMode | ''; title: string; desc: string }[] = [
  {
    value: '',
    title: 'Como está hoje',
    desc: 'Ela passa quando julgar necessário. É o que já estava valendo.',
  },
  {
    value: 'duvida',
    title: 'Ao menor sinal de dúvida',
    desc: 'Qualquer insegurança dela vira repasse. O corretor recebe bastante lead, e cedo.',
  },
  {
    value: 'temperatura',
    title: 'Só quando o lead estiver quente',
    desc: 'Ela conduz sozinha — qualifica, manda material, oferece a visita — e só entrega o lead depois que ele esquenta.',
  },
  {
    value: 'sem_resposta',
    title: 'Só se ela não souber responder',
    desc: 'Repassa quando a resposta não está no que você deu a ela, ou quando as Instruções mandam passar aquele caso.',
  },
  {
    value: 'pos_visita',
    title: 'Só depois de agendar a visita',
    desc: 'O mais autônomo: ela só entrega com a visita marcada, ou quando bate numa objeção que tentou contornar e não conseguiu.',
  },
];

function HandoffPolicySection({ agent, onSave }: {
  agent: SalesAgent;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const cfg = agent.transfer_config ?? {};
  const mode = cfg.mode ?? '';
  const minTemp = cfg.min_temperature ?? 'hot';

  // Trocar de cenário LIMPA a temperatura mínima do cenário anterior, de propósito: ela
  // só significa alguma coisa dentro do cenário da temperatura, e deixá-la pendurada
  // faria o cartão voltar com uma escolha antiga que ninguém lembra de ter feito.
  const pick = (value: HandoffMode | '') => {
    if (value === '') { onSave({ transfer_config: {} }); return; }
    onSave({ transfer_config: value === 'temperatura' ? { mode: value, min_temperature: minTemp } : { mode: value } });
  };

  return (
    <div>
      <div className="text-sm font-medium mb-1">Quando ela passa para um corretor</div>
      <div className="text-xs text-muted-foreground mb-2">
        Escolha um cenário. Ele vale para todos os leads deste atendimento.
      </div>

      <div className="space-y-2">
        {HANDOFF_OPTIONS.map((opt) => {
          const escolhido = mode === opt.value;
          return (
            <div
              key={opt.value || 'padrao'}
              className={`rounded-md border p-3 transition-colors ${escolhido ? 'border-primary bg-primary/5' : 'border-sidebar-border'}`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="handoff_mode"
                  className="mt-1"
                  checked={escolhido}
                  onChange={() => pick(opt.value)}
                />
                <div>
                  <div className="text-sm font-medium">{opt.title}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </label>

              {/* A partir de que temperatura ela entrega. Só aparece dentro do cartão
                  escolhido: solto, o campo pareceria valer para os outros cenários. */}
              {opt.value === 'temperatura' && escolhido && (
                <div className="mt-2 ml-7">
                  <Label htmlFor="handoff_min_temperature">A partir de</Label>
                  <select
                    id="handoff_min_temperature"
                    value={minTemp}
                    onChange={(e) => onSave({
                      transfer_config: { mode: 'temperatura', min_temperature: e.target.value as 'hot' | 'warm' },
                    })}
                    className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="hot">Lead quente</option>
                    <option value="warm">Lead morno ou quente</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    É a mesma leitura que aparece no painel <em>O que a IA entendeu</em>, dentro da conversa.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A IA move o card do lead no funil conforme a conversa anda.
//
// O mapa é "etapa da IA -> coluna DESTA imobiliária", e não a IA escolhendo a
// coluna pelo nome: cada cliente batiza as colunas do jeito dele, e deixar a IA
// adivinhar faria o card parar de andar em silêncio no dia em que alguém
// renomeasse uma coluna.
//
// Etapa sem coluna escolhida = a IA não mexe no card naquela etapa. É o que
// permite ligar só o "visita agendada" e deixar o resto quieto.
const PIPELINE_MOVE_STAGES: Array<[string, string, string]> = [
  ['descobrindo', 'Descobrindo o que o lead quer', 'Primeiras mensagens, ainda entendendo a procura.'],
  ['qualificando', 'Qualificando', 'Já sabe região, orçamento ou prazo.'],
  ['pronto_para_visita', 'Pronto para visita', 'O lead demonstrou interesse real em conhecer o imóvel.'],
  ['agendando', 'Combinando dia e hora', 'Está fechando o horário da visita com o lead.'],
  ['agendado', 'Visita agendada', 'A visita foi marcada de verdade (a IA criou a visita).'],
  ['transferir', 'Passou pro corretor', 'A IA entregou o lead para uma pessoa.'],
];

function PipelineMoveSection({
  agent, onSave,
}: {
  agent: SalesAgent;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const [pipelines, setPipelines] = useState<PipelineOpt[]>([]);
  const [stages, setStages] = useState<StageOpt[]>([]);
  const ligado = agent.pipeline_move_enabled === true;
  const funil = agent.pipeline_id ?? '';
  const mapa = agent.pipeline_stage_map ?? {};

  useEffect(() => {
    if (!ligado) return;
    pipelinesService.getPipelines()
      .then((res: unknown) => {
        const raw = (res as { data?: PipelineOpt[] }).data ?? (Array.isArray(res) ? (res as PipelineOpt[]) : []);
        setPipelines(raw.map((p) => ({ id: String(p.id), name: p.name })));
      })
      .catch(() => setPipelines([]));
  }, [ligado]);

  useEffect(() => {
    if (!ligado || !funil) { setStages([]); return; }
    pipelinesService.getPipelineStages(funil)
      .then((res: unknown) => {
        const raw = (res as { data?: StageOpt[] }).data ?? (Array.isArray(res) ? (res as StageOpt[]) : []);
        setStages(raw.map((st) => ({ id: String(st.id), name: st.name })));
      })
      .catch(() => setStages([]));
  }, [ligado, funil]);

  // Trocar de funil LIMPA o mapa: as colunas do mapa antigo são de outro funil, e
  // o servidor as recusaria uma a uma — o gestor veria as escolhas guardadas e
  // nenhum card andando.
  const trocarFunil = (id: string) => onSave({ pipeline_id: id || null, pipeline_stage_map: {} });

  const escolherColuna = (stage: string, stageId: string) => {
    const proximo = { ...mapa };
    if (stageId) proximo[stage] = stageId; else delete proximo[stage];
    onSave({ pipeline_stage_map: proximo });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Mover o card no funil</div>
          <div className="text-xs text-muted-foreground">
            Conforme a conversa anda, a IA leva o card para a coluna que você escolher.
            O histórico do card mostra o movimento como feito pela IA.
          </div>
        </div>
        <Toggle on={ligado} onChange={(v) => onSave({ pipeline_move_enabled: v })} />
      </div>

      {ligado && (
        <div className="mt-3 pl-7 space-y-3">
          <div>
            <Label htmlFor="pipeline_move_funil" className="text-xs">Em qual funil</Label>
            <select
              id="pipeline_move_funil"
              value={funil}
              onChange={(e) => trocarFunil(e.target.value)}
              className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
            >
              <option value="">— escolha o funil —</option>
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {funil && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Para cada momento da conversa, escolha a coluna. Momento sem coluna escolhida:
                a IA não mexe no card.
              </div>
              {PIPELINE_MOVE_STAGES.map(([key, titulo, ajuda]) => (
                <div key={key} className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{titulo}</div>
                    <div className="text-xs text-muted-foreground">{ajuda}</div>
                  </div>
                  <select
                    value={mapa[key] ?? ''}
                    onChange={(e) => escolherColuna(key, e.target.value)}
                    className="w-48 shrink-0 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
                  >
                    <option value="">— não mover —</option>
                    {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                A IA só empurra o card para a frente. Se o corretor já levou o lead para uma
                coluna mais adiantada, ela não puxa de volta.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IntelligenceSection({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const limits = agent.ai_limits ?? {};
  const crm = agent.crm_policy ?? {};
  const setLimit = (k: keyof typeof limits, v: boolean) => onSave({ ai_limits: { ...limits, [k]: v } });
  const setCrm = (k: keyof typeof crm, v: boolean) => onSave({ crm_policy: { ...crm, [k]: v } });

  return (
    <div className="pt-2 border-t border-sidebar-border space-y-5">
      {/* Escopo: locação */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Trabalha com locação (aluguel)</div>
          <div className="text-xs text-muted-foreground">
            Desligue se a imobiliária só vende. A IA foca em venda e redireciona quem procura aluguel.
          </div>
        </div>
        <Toggle on={agent.locacao_enabled !== false} onChange={(v) => onSave({ locacao_enabled: v })} />
      </div>

      {/* Cenário de repasse: a decisão grande vem ANTES das exceções dela. */}
      <HandoffPolicySection agent={agent} onSave={onSave} />

      {/* Escalação: passar pro humano */}
      <div>
        <div className="text-sm font-medium mb-1">Passar pro humano na hora quando…</div>
        <div className="text-xs text-muted-foreground mb-1">
          Estes três valem em qualquer cenário escolhido acima — inclusive lead irritado.
        </div>
        <CheckRow checked={agent.escalate_on_frustration !== false} onChange={(v) => onSave({ escalate_on_frustration: v })}
          title="O lead se irritar" desc="Detecta frustração/reclamação e passa pro corretor com jeito." />
        <CheckRow checked={agent.escalate_on_human_request !== false} onChange={(v) => onSave({ escalate_on_human_request: v })}
          title="O lead pedir uma pessoa" desc="Quando pede pra falar com um corretor/humano." />
        <CheckRow checked={agent.escalate_on_ai_detected !== false} onChange={(v) => onSave({ escalate_on_ai_detected: v })}
          title="O lead perceber que é IA" desc={'Se perguntar "é um robô?", ela não mente e passa pra uma pessoa.'} />
      </div>

      {/* Limites da IA */}
      <div>
        <div className="text-sm font-medium mb-1">Limites da IA (o que ela NÃO faz)</div>
        <div className="text-xs text-muted-foreground mb-1">Se perguntada, ela encaminha pro corretor com naturalidade.</div>
        <CheckRow checked={!!limits.address} onChange={(v) => setLimit('address', v)} title="Não passar endereço exato do imóvel" />
        <CheckRow checked={!!limits.discount} onChange={(v) => setLimit('discount', v)} title="Não negociar desconto" />
        <CheckRow checked={!!limits.price} onChange={(v) => setLimit('price', v)} title="Não fechar preço final / proposta" />
        <CheckRow checked={!!limits.iptu} onChange={(v) => setLimit('iptu', v)} title="Não informar IPTU" />
      </div>

      {/* Filtro de qualidade antes do CRM */}
      <div>
        <div className="text-sm font-medium mb-1">Quem vai pro CRM (filtro de qualidade)</div>
        <div className="text-xs text-muted-foreground mb-1">Deixe desligado pra não sujar o CRM com lead ruim. Comprador quente sempre vai.</div>
        <CheckRow checked={!!crm.cold} onChange={(v) => setCrm('cold', v)} title="Enviar leads frios ao CRM" />
        <CheckRow checked={!!crm.capture} onChange={(v) => setCrm('capture', v)}
          title="Enviar captação (quem quer vender) ao CRM de vendas" desc="Desligado: vira etiqueta de captação, não polui o funil de compradores." />
        <CheckRow checked={crm.invalid !== false} onChange={(v) => setCrm('invalid', v)} title="Enviar leads sem contato válido ao CRM" />
      </div>

      {/* Mover o card no funil. Fica logo abaixo do filtro de qualidade porque as
          duas respondem à mesma pergunta — o que a IA faz DENTRO do CRM: a de cima
          decide quem entra, esta decide para onde vai depois que entrou. */}
      <PipelineMoveSection agent={agent} onSave={onSave} />

      {/* Extras */}
      <div>
        <div className="text-sm font-medium mb-1">Extras</div>
        <CheckRow checked={agent.cross_sell_enabled !== false} onChange={(v) => onSave({ cross_sell_enabled: v })}
          title="Oferecer outras opções" desc="Quando não tem o imóvel exato, sugere alternativas reais e não perde o lead." />
        <CheckRow checked={agent.rich_media_enabled !== false} onChange={(v) => onSave({ rich_media_enabled: v })}
          title="Mandar foto e link do imóvel" desc="Envia mídia do imóvel de interesse no WhatsApp." />
        {/* Sem isto, "Oferecer outras opções" era promessa vazia: a IA só
            enxergava o imóvel do anúncio e não tinha como consultar o cadastro. */}
        <CheckRow checked={agent.catalog_search_enabled !== false} onChange={(v) => onSave({ catalog_search_enabled: v })}
          title="Consultar o cadastro de imóveis"
          desc="Deixa a IA buscar imóveis reais do seu cadastro (bairro, quartos, faixa de preço) pra sugerir alternativa. Sem isso ela só conhece o imóvel do anúncio." />
        {/* O book já está no cadastro do imóvel — não precisa ser subido de novo na
            aba de arquivos. Vale pra todo imóvel que tenha book salvo, inclusive os
            que forem cadastrados depois. */}
        <CheckRow checked={agent.send_property_book_enabled !== false} onChange={(v) => onSave({ send_property_book_enabled: v })}
          title="Mandar o book do imóvel"
          desc="O PDF que já está cadastrado no imóvel. Não precisa subir de novo aqui." />
        {agent.send_property_book_enabled !== false && (
          <div className="mt-2 pl-7">
            <Label htmlFor="book_rule" className="text-xs">Quando ela pode mandar o book</Label>
            <Textarea
              id="book_rule" rows={2} className="mt-1"
              placeholder="Ex: só quando o lead pedir o book, o material completo ou a apresentação do empreendimento"
              defaultValue={agent.book_send_rule ?? ''}
              onBlur={(e) => onSave({ book_send_rule: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Vale pro book de qualquer imóvel. Em branco, ela só manda quando o lead pedir.
            </p>
          </div>
        )}
      </div>

      {/* Avaliação no Google */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Pedir avaliação no Google</div>
            <div className="text-xs text-muted-foreground">Após um bom atendimento, convida o lead a avaliar (reputação/SEO).</div>
          </div>
          <Toggle on={!!agent.ask_google_review} onChange={(v) => onSave({ ask_google_review: v })} />
        </div>
        {agent.ask_google_review && (
          <div className="mt-2 pl-7">
            <Label htmlFor="g_review" className="text-xs">Link de avaliação do Google</Label>
            <Input id="g_review" placeholder="https://g.page/.../review" className="mt-1"
              value={agent.google_review_link ?? ''}
              onChange={(e) => onChange({ ...agent, google_review_link: e.target.value })}
              onBlur={() => onSave({ google_review_link: (agent.google_review_link ?? '').trim() || null })} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Follow-up automático ----------------

function FollowupSection({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const on = agent.followup_enabled;
  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Follow-up automático</div>
          <div className="text-xs text-muted-foreground">
            Se o lead sumir, a IA volta sozinha na cadência que você definir. Infinito por padrão. Desligado = não dispara nada.
          </div>
          {/* Os dois follow-ups do produto NÃO se sobrepõem, e a diferença nunca
              esteve escrita em lugar nenhum: aqui só entra quem já respondeu
              alguma vez (sem mensagem do lead não há o que reengajar); quem nunca
              respondeu é do Robô Sem Resposta, em Automações. */}
          <div className="text-xs text-muted-foreground mt-1">
            Pega <strong>quem já respondeu alguma vez e depois sumiu</strong>. Quem nunca
            respondeu nenhuma vez é do <em>Robô Sem Resposta</em>, em Automações.
          </div>
        </div>
        <Toggle on={!!on} onChange={(v) => onSave({ followup_enabled: v })} />
      </div>

      {on && (
        <div className="mt-3 space-y-3 pl-7">
          <FollowupActionPicker agent={agent} onSave={onSave} />

          <FollowupDripRow agent={agent} onChange={onChange} onSave={onSave} />

          <div className="flex items-end gap-3">
            <div>
              <Label htmlFor="fu_min" className="text-xs">A cada (mín. dias)</Label>
              <Input id="fu_min" type="number" min={1} max={365} value={agent.followup_min_days ?? 2} className="mt-1 w-24"
                onChange={(e) => onChange({ ...agent, followup_min_days: Number(e.target.value) })}
                onBlur={() => onSave({ followup_min_days: Math.max(1, Number(agent.followup_min_days) || 2) })} />
            </div>
            <div>
              <Label htmlFor="fu_max" className="text-xs">até (máx. dias)</Label>
              <Input id="fu_max" type="number" min={1} max={365} value={agent.followup_max_days ?? 3} className="mt-1 w-24"
                onChange={(e) => onChange({ ...agent, followup_max_days: Number(e.target.value) })}
                onBlur={() => onSave({ followup_max_days: Math.max(Number(agent.followup_min_days) || 1, Number(agent.followup_max_days) || 3) })} />
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              {agent.followup_action === 'ai'
                ? 'A IA espera um tempo aleatório nessa faixa entre cada follow-up.'
                : 'Quanto tempo de silêncio até a IA entregar o lead ao funil.'}
            </p>
          </div>

          {/* O teto de cutucadas só faz sentido quando é a IA que cutuca. Entregando
              ao funil ela age UMA vez e sai de cena — quem manda dali em diante é o
              funil, com o número de mensagens que ele tem. */}
          {agent.followup_action === 'ai' && (
            <div>
              <Label htmlFor="fu_max_att" className="text-xs">Máximo de follow-ups (0 = infinito, para sempre)</Label>
              <Input id="fu_max_att" type="number" min={0} value={agent.followup_max_attempts ?? 0} className="mt-1 w-40"
                onChange={(e) => onChange({ ...agent, followup_max_attempts: Number(e.target.value) })}
                onBlur={() => onSave({ followup_max_attempts: Math.max(0, Number(agent.followup_max_attempts) || 0) })} />
            </div>
          )}

          {/* O follow-up nunca olhou o horário de atuação: um agente configurado
              pra atender "só fora do comercial" cutucava lead às 14h. Virou
              escolha — desligado é como sempre funcionou. */}
          <CheckRow
            checked={!!agent.followup_respect_active_hours}
            onChange={(v) => onSave({ followup_respect_active_hours: v })}
            title="Seguir também o horário de atuação"
            desc="Desligado, o follow-up sai em qualquer dia entre 9h e 20h. Ligado, respeita os dias e as janelas que você configurou acima."
          />

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={agent.followup_only} onChange={(e) => onSave({ followup_only: e.target.checked })} />
            <div>
              <div className="text-sm font-medium">Só follow-up (não responde ao vivo)</div>
              <div className="text-xs text-muted-foreground">
                A IA não conversa com o lead — apenas faz os follow-ups de reengajamento. O atendimento ao vivo fica com o corretor.
              </div>
            </div>
          </label>
        </div>
      )}
    </div>
  );
}

function FollowupDripRow({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const on = agent.followup_drip_enabled !== false;
  const num = (v: number | undefined, padrao: number) => (v === undefined || v === null ? padrao : v);

  return (
    <div className="rounded-md border border-sidebar-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Ir aos poucos, como gente</div>
          <div className="text-xs text-muted-foreground">
            Em vez de mandar todo mundo de uma vez, a IA pega um punhado de leads, espera, pega
            outro punhado. O tempo de espera muda a cada vez — ritmo certinho denuncia robô tanto
            quanto rajada.
          </div>
        </div>
        <Toggle on={on} onChange={(v) => onSave({ followup_drip_enabled: v })} />
      </div>

      {on ? (
        <div className="mt-3 space-y-2 pl-1">
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-sm pb-2">Pega de</span>
            <Input type="number" min={1} max={20} aria-label="mínimo de leads por vez"
              className="w-16" value={num(agent.followup_drip_min_leads, 2)}
              onChange={(e) => onChange({ ...agent, followup_drip_min_leads: Number(e.target.value) })}
              onBlur={() => onSave({ followup_drip_min_leads: Math.min(20, Math.max(1, Number(agent.followup_drip_min_leads) || 2)) })} />
            <span className="text-sm pb-2">a</span>
            <Input type="number" min={1} max={20} aria-label="máximo de leads por vez"
              className="w-16" value={num(agent.followup_drip_max_leads, 3)}
              onChange={(e) => onChange({ ...agent, followup_drip_max_leads: Number(e.target.value) })}
              onBlur={() => onSave({ followup_drip_max_leads: Math.min(20, Math.max(Number(agent.followup_drip_min_leads) || 1, Number(agent.followup_drip_max_leads) || 3)) })} />
            <span className="text-sm pb-2">leads por vez, esperando de</span>
            <Input type="number" min={1} max={240} aria-label="pausa mínima em minutos"
              className="w-16" value={num(agent.followup_drip_min_minutes, 3)}
              onChange={(e) => onChange({ ...agent, followup_drip_min_minutes: Number(e.target.value) })}
              onBlur={() => onSave({ followup_drip_min_minutes: Math.min(240, Math.max(1, Number(agent.followup_drip_min_minutes) || 3)) })} />
            <span className="text-sm pb-2">a</span>
            <Input type="number" min={1} max={240} aria-label="pausa máxima em minutos"
              className="w-16" value={num(agent.followup_drip_max_minutes, 5)}
              onChange={(e) => onChange({ ...agent, followup_drip_max_minutes: Number(e.target.value) })}
              onBlur={() => onSave({ followup_drip_max_minutes: Math.min(240, Math.max(Number(agent.followup_drip_min_minutes) || 1, Number(agent.followup_drip_max_minutes) || 5)) })} />
            <span className="text-sm pb-2">minutos entre um e outro.</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Dá cerca de <strong>{estimativaPorDia(agent)} leads por dia</strong>, das 9h às 20h.
            Aumente a espera para ir mais devagar — número novo, ou primeira vez ligando num
            cliente com muito lead parado, pede calma.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-600">
          Desligado, a IA entrega todos os leads vencidos de uma vez — até 200 a cada passada. Ao
          ligar a chave num cliente com muito lead parado, isso vira uma enxurrada de mensagens
          saindo do mesmo número.
        </p>
      )}
    </div>
  );
}

// Conta de padeiro para o gestor enxergar o ritmo antes de salvar: 11 horas de
// janela (9h às 20h), punhado médio dividido pela pausa média.
function estimativaPorDia(agent: SalesAgent): number {
  const leads = ((Number(agent.followup_drip_min_leads) || 2) + (Number(agent.followup_drip_max_leads) || 3)) / 2;
  const pausa = ((Number(agent.followup_drip_min_minutes) || 3) + (Number(agent.followup_drip_max_minutes) || 5)) / 2;
  if (pausa <= 0) return 0;
  return Math.round(((11 * 60) / pausa) * leads);
}

// As três saídas do follow-up. As duas de baixo não consomem IA: as mensagens do
// funil já estão escritas, então cutucar o lead deixa de custar por lead e por vez.
const FOLLOWUP_ACTIONS: [SalesAgentFollowupAction, string, string][] = [
  ['ai', 'A IA escreve a mensagem',
   'Personalizada com base na conversa inteira e no imóvel de interesse. É a que mais converte — e a única que consome IA a cada envio.'],
  ['pipeline', 'Mover o card para uma coluna',
   'A IA leva o card para a coluna que você escolher e sai de cena. Quem manda a mensagem é o funil de follow-up que essa coluna dispara. Não consome IA.'],
  ['sequence', 'Disparar um funil pronto',
   'A IA coloca o lead no funil escolhido, sem mexer no card. Para quem não usa o quadro de funil. Não consome IA.'],
];

function FollowupActionPicker({
  agent, onSave,
}: {
  agent: SalesAgent;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const [stages, setStages] = useState<StageOpt[]>([]);
  const [funis, setFunis] = useState<{ slug: string; name: string }[]>([]);
  const acao = agent.followup_action ?? 'ai';
  const pipeline = agent.pipeline_id ?? '';

  // As colunas são as do funil já escolhido em "Mover o card no funil", logo
  // acima: um segundo seletor de funil aqui criaria duas verdades sobre onde a IA
  // age no quadro, e trocar uma sem a outra deixaria o card num funil e a coluna
  // no outro.
  useEffect(() => {
    if (acao !== 'pipeline' || !pipeline) { setStages([]); return; }
    pipelinesService.getPipelineStages(pipeline)
      .then((res: unknown) => {
        const raw = (res as { data?: StageOpt[] }).data ?? (Array.isArray(res) ? (res as StageOpt[]) : []);
        setStages(raw.map((st) => ({ id: String(st.id), name: st.name })));
      })
      .catch(() => setStages([]));
  }, [acao, pipeline]);

  useEffect(() => {
    if (acao !== 'sequence') { setFunis([]); return; }
    followupSequencesService.getAll()
      .then((lista) => setFunis(lista.filter((f) => f.is_active).map((f) => ({ slug: f.slug, name: f.name }))))
      .catch(() => setFunis([]));
  }, [acao]);

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">Quando o lead sumir</div>
      {FOLLOWUP_ACTIONS.map(([valor, titulo, ajuda]) => (
        <label key={valor} className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            className="mt-1"
            name={`followup_action_${agent.id}`}
            checked={acao === valor}
            onChange={() => onSave({ followup_action: valor })}
          />
          <div>
            <div className="text-sm">{titulo}</div>
            <div className="text-xs text-muted-foreground">{ajuda}</div>
          </div>
        </label>
      ))}

      {acao === 'pipeline' && (
        <div className="mt-2 space-y-2 pl-7">
          {!pipeline ? (
            <p className="text-xs text-amber-600">
              Escolha antes o funil em <strong>Mover o card no funil</strong>, logo acima — é dele que
              saem as colunas.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-sm">Coluna para o lead que sumiu</div>
                <select
                  value={agent.followup_stage_id ?? ''}
                  onChange={(e) => onSave({ followup_stage_id: e.target.value || null })}
                  className="w-52 shrink-0 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
                >
                  <option value="">— escolha a coluna —</option>
                  {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-sm">Quando ele voltar a responder, o card vai para</div>
                <select
                  value={agent.followup_return_stage_id ?? ''}
                  onChange={(e) => onSave({ followup_return_stage_id: e.target.value || null })}
                  className="w-52 shrink-0 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
                >
                  <option value="">Primeira coluna do funil (Novo)</option>
                  {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                Quem manda a mensagem é o funil que essa coluna dispara — configure a entrada
                <em> Card entrou numa coluna</em> em Automações → Follow-up, senão o card muda de
                lugar e ninguém fala com o lead. A IA só empurra o card para a frente: card que o
                corretor já levou para uma coluna adiantada ela não puxa de volta.
              </p>
            </>
          )}
        </div>
      )}

      {acao === 'sequence' && (
        <div className="mt-2 space-y-2 pl-7">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm">Qual funil</div>
            <select
              value={agent.followup_sequence_slug ?? ''}
              onChange={(e) => onSave({ followup_sequence_slug: e.target.value || null })}
              className="w-52 shrink-0 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
            >
              <option value="">— escolha o funil —</option>
              {funis.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Só aparecem os funis ativos. O card não é movido neste modo — se você usa o quadro,
            prefira a opção de cima, que também deixa o lead sumido visível numa coluna.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------- Ajustes avançados ----------------

const MODEL_OPTIONS: [string, string][] = [
  ['claude-sonnet-4-5-20250929', 'Equilibrada — Sonnet (padrão, recomendado)'],
  ['claude-haiku-4-5-20251001', 'Mais rápida e barata — Haiku'],
];

// Criatividade amigável -> temperatura do modelo.
const TEMP_OPTIONS: [number, string, string][] = [
  [0.2, 'Mais objetiva', 'Respostas curtas e diretas, segue o script à risca.'],
  [0.4, 'Equilibrada (padrão)', 'Boa mistura de naturalidade e foco.'],
  [0.7, 'Mais criativa', 'Respostas mais soltas e variadas.'],
];

function nearestTemp(v: number): number {
  return TEMP_OPTIONS.reduce((best, [t]) => (Math.abs(t - v) < Math.abs(best - v) ? t : best), TEMP_OPTIONS[1][0]);
}

function AdvancedSection({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const [open, setOpen] = useState(false);
  const modelKnown = MODEL_OPTIONS.some(([id]) => id === agent.model);
  const tempSel = nearestTemp(agent.temperature ?? 0.4);

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Ajustes avançados
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4 pl-1">
          <div>
            <Label htmlFor="adv_model">Modelo de IA (inteligência x custo)</Label>
            <select
              id="adv_model"
              value={modelKnown ? agent.model : ''}
              onChange={(e) => onSave({ model: e.target.value })}
              className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
            >
              {!modelKnown && <option value="">Personalizado: {agent.model}</option>}
              {MODEL_OPTIONS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Sonnet é o padrão. Haiku responde mais rápido e custa menos, mas é menos esperta.</p>
          </div>

          <div>
            <Label htmlFor="adv_temp">Criatividade das respostas</Label>
            <select
              id="adv_temp"
              value={tempSel}
              onChange={(e) => onSave({ temperature: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
            >
              {TEMP_OPTIONS.map(([t, label, help]) => (
                <option key={t} value={t}>{label} — {help}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="adv_ctx" className="text-xs">Quanto da base de conhecimento ela lê por resposta (tokens)</Label>
            <Input
              id="adv_ctx"
              type="number"
              min={1000}
              max={100000}
              step={1000}
              value={agent.max_context_tokens ?? 8000}
              className="mt-1 w-40"
              onChange={(e) => onChange({ ...agent, max_context_tokens: Number(e.target.value) })}
              onBlur={() => onSave({ max_context_tokens: Math.max(1000, Number(agent.max_context_tokens) || 8000) })}
            />
            <p className="text-xs text-muted-foreground mt-1">Maior = lê mais da base (respostas mais completas), porém mais caro. Padrão 8000.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Gatilhos de ativação (multi) ----------------

const TRIGGER_TYPES: { value: SalesAgentTriggerType; label: string }[] = [
  // Primeiro da lista porque é o que quase todo mundo quer: contato e lead não
  // são a mesma coisa — toda mensagem de número desconhecido vira contato, mas
  // só quem entra no funil é lead. É a definição que o resto do sistema já usa.
  { value: 'pipeline', label: 'É lead (tem card no funil)' },
  { value: 'keyword', label: 'Contém/é igual a palavra' },
  { value: 'origin', label: 'Origem do lead' },
  { value: 'property', label: 'Imóvel (código / form)' },
  { value: 'pipeline_stage', label: 'Coluna de pipeline' },
  { value: 'tag', label: 'Tem a tag' },
];

const TRIGGER_MATCH_MODE_OPTIONS: [SalesAgentTriggerMatchMode, string, string][] = [
  ['any', 'Qualquer gatilho ativa (OU)', 'Basta UM dos gatilhos abaixo bater pra IA entrar na conversa.'],
  ['all', 'Todos os gatilhos juntos (E)', 'Só ativa quando TODOS os gatilhos abaixo baterem ao mesmo tempo — pra combinar mais de uma condição.'],
];

interface PipelineOpt { id: string; name: string }
interface StageOpt { id: string; name: string }

function newTrigger(type: SalesAgentTriggerType): SalesAgentTrigger {
  switch (type) {
    case 'keyword': return { type, value: '', match_type: 'contains' };
    case 'origin': return { type, mode: 'ads' };
    case 'property': return { type, mode: 'any' };
    case 'pipeline_stage': return { type, pipeline_id: '', stage_id: '' };
    // pipeline_id vazio = qualquer funil, que é o caso normal.
    case 'pipeline': return { type, mode: 'any', pipeline_id: '' };
    case 'tag': return { type, value: '' };
  }
}

function TriggersSection({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const triggers = agent.triggers ?? [];
  const [pipelines, setPipelines] = useState<PipelineOpt[]>([]);
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, StageOpt[]>>({});

  useEffect(() => {
    pipelinesService.getPipelines()
      .then((res: unknown) => {
        const raw = (res as { data?: PipelineOpt[] }).data ?? (Array.isArray(res) ? (res as PipelineOpt[]) : []);
        setPipelines(raw.map((p) => ({ id: String(p.id), name: p.name })));
      })
      .catch(() => setPipelines([]));
  }, []);

  const loadStages = (pipelineId: string) => {
    if (!pipelineId || stagesByPipeline[pipelineId]) return;
    pipelinesService.getPipelineStages(pipelineId)
      .then((res: unknown) => {
        const raw = (res as { data?: StageOpt[] }).data ?? (Array.isArray(res) ? (res as StageOpt[]) : []);
        setStagesByPipeline((prev) => ({ ...prev, [pipelineId]: raw.map((s) => ({ id: String(s.id), name: s.name })) }));
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    triggers.forEach((t) => { if (t.type === 'pipeline_stage' && t.pipeline_id) loadStages(t.pipeline_id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggers]);

  const commit = (next: SalesAgentTrigger[]) => onSave({ triggers: next });
  const update = (i: number, patch: Partial<SalesAgentTrigger>) => commit(triggers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const remove = (i: number) => commit(triggers.filter((_, idx) => idx !== i));
  const add = () => commit([...triggers, newTrigger('keyword')]);

  const matchMode = agent.trigger_match_mode ?? 'any';

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <Label>Gatilhos de ativação (avançado)</Label>
      </div>
      <p className="text-xs text-muted-foreground mt-1 mb-2">
        Sem nenhum gatilho = atende todo lead do canal (além da palavra-chave acima, que sempre restringe sozinha).
      </p>

      {triggers.length > 1 && (
        <div className="grid grid-cols-1 gap-2 mb-2">
          {TRIGGER_MATCH_MODE_OPTIONS.map(([m, title, help]) => (
            <label key={m} className={`flex items-start gap-3 p-2 rounded-md border cursor-pointer text-sm ${
              matchMode === m ? 'border-primary bg-primary/5' : 'border-sidebar-border'
            }`}>
              <input type="radio" name="trigger_match_mode" className="mt-1"
                checked={matchMode === m} onChange={() => onSave({ trigger_match_mode: m })} />
              <div>
                <div className="font-medium">{title}</div>
                <div className="text-xs text-muted-foreground">{help}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {triggers.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 p-2 rounded-md border border-sidebar-border">
            <select
              value={t.type}
              onChange={(e) => commit(triggers.map((tr, idx) => (idx === i ? newTrigger(e.target.value as SalesAgentTriggerType) : tr)))}
              className="rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
            >
              {TRIGGER_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
            </select>

            {t.type === 'keyword' && (
              <>
                <select value={t.match_type ?? 'contains'} onChange={(e) => update(i, { match_type: e.target.value as 'contains' | 'equals' })}
                  className="rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm">
                  <option value="contains">Contém</option>
                  <option value="equals">É exatamente</option>
                </select>
                <Input className="flex-1 min-w-40" placeholder="palavra (ex: fluxoimob)" value={t.value ?? ''}
                  onChange={(e) => update(i, { value: e.target.value })} onBlur={() => commit(triggers)} />
              </>
            )}

            {t.type === 'tag' && (
              <Input className="flex-1 min-w-40" placeholder="tag (ex: vip)" value={t.value ?? ''}
                onChange={(e) => update(i, { value: e.target.value })} onBlur={() => commit(triggers)} />
            )}

            {t.type === 'origin' && (
              <select value={t.mode ?? 'ads'} onChange={(e) => update(i, { mode: e.target.value })}
                className="rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm">
                <option value="ads">Só anúncios (FB/IG/Google)</option>
                <option value="all">Todos os leads</option>
              </select>
            )}

            {t.type === 'property' && (
              <>
                <select value={t.mode ?? 'any'} onChange={(e) => update(i, { mode: e.target.value })}
                  className="rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm">
                  <option value="any">Qualquer imóvel (veio de form/anúncio de imóvel)</option>
                  <option value="code">Imóvel específico (código)</option>
                </select>
                {t.mode === 'code' && (
                  <Input className="w-32" placeholder="código" value={t.code ?? ''}
                    onChange={(e) => update(i, { code: e.target.value })} onBlur={() => commit(triggers)} />
                )}
              </>
            )}

            {t.type === 'pipeline' && (
              <>
                <select
                  value={t.pipeline_id ?? ''}
                  onChange={(e) => update(i, { pipeline_id: e.target.value })}
                  className="rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
                >
                  <option value="">Qualquer funil</option>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{`Só o funil ${p.name}`}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">
                  Card arquivado não conta — lead que saiu do funil e volta a escrever fica pro humano.
                </span>
              </>
            )}

            {t.type === 'pipeline_stage' && (
              <>
                <select value={t.pipeline_id ?? ''} onChange={(e) => { loadStages(e.target.value); update(i, { pipeline_id: e.target.value, stage_id: '' }); }}
                  className="rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm">
                  <option value="">— pipeline —</option>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={t.stage_id ?? ''} onChange={(e) => update(i, { stage_id: e.target.value })} disabled={!t.pipeline_id}
                  className="rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm">
                  <option value="">— coluna —</option>
                  {(stagesByPipeline[t.pipeline_id ?? ''] ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </>
            )}

            <button onClick={() => remove(i)} className="ml-auto text-muted-foreground hover:text-red-500" title="Remover gatilho">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Button size="sm" variant="outline" onClick={add} className="mt-2">
        <Plus className="h-4 w-4 mr-1" /> Adicionar gatilho
      </Button>
    </div>
  );
}

// ---------------- Knowledge ----------------

// ---------------- Aprendizado (feedback -> regras + exemplos) ----------------

const LESSON_KIND_LABEL: Record<SalesAgentLessonKind, string> = {
  rule: 'Regra',
  good_example: 'Exemplo bom',
  bad_example: 'Exemplo ruim',
};

function LearningTab({ agent }: { agent: SalesAgent }) {
  const [lessons, setLessons] = useState<SalesAgentLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [rule, setRule] = useState('');
  const [busy, setBusy] = useState(false);
  // exemplo (bom ou ruim)
  const [exContext, setExContext] = useState('');
  const [exReply, setExReply] = useState('');
  const [exKind, setExKind] = useState<'good_example' | 'bad_example'>('good_example');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLessons(await salesAgentsService.listLessons(agent.id));
    } catch {
      toast.error('Erro ao carregar o aprendizado');
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => { load(); }, [load]);

  const addRule = async () => {
    const c = rule.trim();
    if (!c) return;
    setBusy(true);
    try {
      await salesAgentsService.createLesson(agent.id, 'rule', c);
      setRule('');
      toast.success('Ensinado');
      await load();
    } catch {
      toast.error('Erro ao ensinar');
    } finally {
      setBusy(false);
    }
  };

  const addExample = async () => {
    const c = exReply.trim();
    if (!c) return;
    setBusy(true);
    try {
      await salesAgentsService.createLesson(agent.id, exKind, c, exContext.trim() || undefined);
      setExContext(''); setExReply('');
      toast.success('Exemplo salvo');
      await load();
    } catch {
      toast.error('Erro ao salvar exemplo');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await salesAgentsService.destroyLesson(agent.id, id);
      setLessons((prev) => prev.filter((l) => l.id !== id));
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Ensine a IA com o tempo. Ela não re-treina o modelo: o que você escreve vira regra ou exemplo que ela passa a seguir nas próximas conversas.
      </p>

      {/* Ensinar por regra */}
      <div>
        <Label>Ensinar a IA (regra / correção)</Label>
        <Textarea
          rows={3}
          placeholder="Ex: sempre ofereça agendar uma visita. Nunca fale de preço antes de saber o orçamento. Seja mais informal."
          value={rule}
          onChange={(e) => setRule(e.target.value)}
        />
        <Button size="sm" className="mt-2" onClick={addRule} disabled={busy || !rule.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Ensinar
        </Button>
      </div>

      {/* Exemplo bom/ruim */}
      <div className="pt-2 border-t border-sidebar-border">
        <Label>Ensinar por exemplo</Label>
        <div className="flex gap-2 mt-1 mb-2">
          <button
            onClick={() => setExKind('good_example')}
            className={`px-3 py-1 rounded-md text-sm border ${exKind === 'good_example' ? 'border-primary bg-primary/5 text-primary' : 'border-sidebar-border'}`}
          >👍 Resposta boa</button>
          <button
            onClick={() => setExKind('bad_example')}
            className={`px-3 py-1 rounded-md text-sm border ${exKind === 'bad_example' ? 'border-primary bg-primary/5 text-primary' : 'border-sidebar-border'}`}
          >👎 Resposta ruim</button>
        </div>
        <Input className="mb-2" placeholder="O que o lead disse (opcional)" value={exContext} onChange={(e) => setExContext(e.target.value)} />
        <Textarea
          rows={2}
          placeholder={exKind === 'good_example' ? 'A resposta ideal que ela deveria dar' : 'A resposta que ela NÃO deve dar'}
          value={exReply}
          onChange={(e) => setExReply(e.target.value)}
        />
        <Button size="sm" className="mt-2" onClick={addExample} disabled={busy || !exReply.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Salvar exemplo
        </Button>
      </div>

      {/* Lista */}
      <div className="pt-2 border-t border-sidebar-border">
        <Label>O que ela já aprendeu ({lessons.length})</Label>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">Nada ainda. Ensine acima.</p>
        ) : (
          <ul className="space-y-2 mt-2">
            {lessons.map((l) => (
              <li key={l.id} className="flex items-start gap-2 p-2 rounded-md border border-sidebar-border">
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${l.kind === 'bad_example' ? 'bg-red-500/10 text-red-500' : l.kind === 'good_example' ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary'}`}>
                  {LESSON_KIND_LABEL[l.kind]}
                </span>
                <div className="flex-1 min-w-0 text-sm">
                  {l.context && <div className="text-xs text-muted-foreground truncate">Lead: {l.context}</div>}
                  <div className="break-words">{l.content}</div>
                </div>
                <button onClick={() => remove(l.id)} className="text-muted-foreground hover:text-red-500" title="Remover">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Aceitos no upload de arquivo. PDF entrou junto com o envio: é o formato em que a
// imobiliária tem TODO o material dela (book, planta, memorial) e a base recusava.
const DOC_ACCEPT = '.pdf,.txt,.md,.csv,.docx,.xlsx,.jpg,.jpeg,.png,.webp';
const DOC_MAX_BYTES = 25 * 1024 * 1024;
// De quanto em quanto tempo re-buscar a lista enquanto algum arquivo estiver
// "Processando". A extração leva segundos; 4s é o mesmo ritmo da importação de imóveis.
const DOC_POLL_MS = 4000;

function KnowledgeTab({ agent, onCountChange }: { agent: SalesAgent; onCountChange: () => void }) {
  const [docs, setDocs] = useState<SalesAgentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  // Arquivo em edição na ficha "Como a IA deve usar este arquivo".
  const [editing, setEditing] = useState<SalesAgentDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await salesAgentsService.listDocuments(agent.id));
    } catch {
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => { load(); }, [load]);

  // Enquanto houver arquivo em "Processando", re-busca sozinha. Sem isto a lista era
  // carregada uma vez e nunca mais: o upload chama load() milissegundos após criar o
  // item, quando ele AINDA está pendente por definição — então ficava escrito
  // "Processando..." para sempre na tela, mesmo com o servidor já tendo terminado.
  // Mesmo padrão da importação de imóveis (PropertyImportDialog).
  const temPendente = docs.some(d => d.status === 'pending');
  useEffect(() => {
    if (!temPendente) return;
    const id = setInterval(() => {
      salesAgentsService.listDocuments(agent.id).then(setDocs).catch(() => { /* silencioso: é atualização de fundo */ });
    }, DOC_POLL_MS);
    return () => clearInterval(id);
  }, [temPendente, agent.id]);

  const addText = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await salesAgentsService.createTextDocument(agent.id, title.trim() || 'Conhecimento', text.trim());
      setTitle(''); setText('');
      toast.success('Adicionado à base');
      await load(); onCountChange();
    } catch {
      toast.error('Erro ao adicionar');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (file.size > DOC_MAX_BYTES) {
      toast.error(`"${file.name}" tem mais de 25 MB. Reduza o arquivo antes de subir.`);
      return;
    }
    setBusy(true); setProgress(0);
    try {
      const doc = await salesAgentsService.uploadFileDocument(agent.id, file, undefined, setProgress);
      toast.success('Arquivo enviado. Diga agora como a IA deve usar ele.');
      await load(); onCountChange();
      // Abre a ficha na sequência: subir sem responder "quando enviar" deixa o
      // arquivo mudo, e ninguém volta depois pra preencher.
      setEditing(doc);
    } catch {
      toast.error('Erro no upload');
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  const remove = async (doc: SalesAgentDocument) => {
    try {
      await salesAgentsService.destroyDocument(agent.id, doc.id);
      await load(); onCountChange();
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <div className="space-y-5">
      {/* O texto antigo mandava "suba a tabela de imóveis" e dizia que a IA
          respondia SÓ com base nisto. Deixou de ser verdade quando a busca no
          catálogo entrou: ela consulta os imóveis cadastrados a cada mensagem.
          Pior que desatualizado, o conselho era ruim — uma tabela colada aqui
          envelhece e passa a contradizer o preço real do cadastro. */}
      <div className="text-sm text-muted-foreground space-y-2">
        <p>
          O mesmo arquivo serve pras <strong>duas coisas</strong>: a IA aprende com ele e, se você deixar,
          manda ele pro lead no WhatsApp. Sobe uma vez só.
        </p>
        <p>
          Os <strong>imóveis já estão conectados</strong>: a IA consulta o cadastro do cliente a cada mensagem e
          usa preço e características de lá, sempre atualizados. Não precisa subir tabela de imóveis aqui.
        </p>
        <p>
          Use esta base para o que <strong>não</strong> está no cadastro: condições de pagamento, documentação,
          FAQ, argumentário, política da imobiliária, diferenciais do bairro.
        </p>
        <p className="text-amber-600 dark:text-amber-500">
          Evite colar tabela de preços: ela não se atualiza junto com o cadastro e vira uma segunda versão da
          verdade — a IA passa a ter duas respostas diferentes para o mesmo imóvel.
        </p>
      </div>

      <div className="border border-sidebar-border rounded-md p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Colar texto</div>
        <Input placeholder="Título (ex: Tabela de imóveis)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={4} placeholder="Cole aqui o texto do conhecimento..." value={text} onChange={(e) => setText(e.target.value)} />
        <Button size="sm" onClick={addText} disabled={busy || !text.trim()}>Adicionar</Button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-sidebar-border'
        }`}
      >
        <label className="flex flex-col items-center gap-1 cursor-pointer">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Arraste um arquivo aqui ou clique para escolher</span>
          <span className="text-xs text-muted-foreground">PDF, DOCX, XLSX, CSV, TXT, JPG, PNG — até 25 MB</span>
          <input
            type="file"
            className="hidden"
            accept={DOC_ACCEPT}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
          />
        </label>
        {progress !== null && (
          <div className="mt-3 h-1.5 bg-sidebar-border rounded overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum arquivo ainda.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between border border-sidebar-border rounded-md px-3 py-2 gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  {d.media_kind === 'image' ? <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="truncate">{d.title}</span>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                  {d.sendable && <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">Envia</span>}
                  {d.learnable && d.status === 'ready' && (
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">Aprende</span>
                  )}
                  {d.send_mode === 'link' && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">Vai como link</span>
                  )}
                  {d.send_mode === 'blocked' && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">Grande demais</span>
                  )}
                  {d.size_label && <span>{d.size_label}</span>}
                  {d.status === 'ready' && <span>{d.char_count} caracteres</span>}
                  {d.status === 'pending' && <span>Processando...</span>}
                  {/* Arquivo íntegro, só sem texto: o envio funciona. Pintar de
                      vermelho aqui fazia o dono apagar e subir de novo. */}
                  {d.status === 'no_text' && (
                    <span className="text-amber-600 dark:text-amber-500">Sem texto pra aprender</span>
                  )}
                  {d.status === 'failed' && <span className="text-red-500">Falhou: {d.error_message}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Também em "Processando", não só em falha: um arquivo cujo
                    processamento se perdeu num deploy fica pendente sem nenhuma
                    alavanca — era preciso apagar e subir de novo pra destravar. */}
                {(d.status === 'failed' || d.status === 'pending') && (
                  <Button variant="ghost" size="sm" title="Tentar de novo" onClick={() => salesAgentsService.reprocessDocument(agent.id, d.id).then(load)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" title="Como a IA usa este arquivo" onClick={() => setEditing(d)}>
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Remover" onClick={() => remove(d)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <FileConfigDialog
          agentId={agent.id}
          doc={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// ---------------- Ficha "Como a IA deve usar este arquivo" ----------------

/**
 * As perguntas de uso do arquivo. Escritas em português, elas são o que ensina a IA
 * a hora certa de mandar — não existe lista de palavra-chave por trás.
 */
function FileConfigDialog({
  agentId, doc, onClose, onSaved,
}: {
  agentId: string; doc: SalesAgentDocument; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [sendable, setSendable] = useState(doc.sendable);
  const [learnable, setLearnable] = useState(doc.learnable);
  const [sendOnce, setSendOnce] = useState(doc.send_once);
  const [when, setWhen] = useState(doc.send_when ?? '');
  const [whenNot, setWhenNot] = useState(doc.send_when_not ?? '');
  const [caption, setCaption] = useState(doc.send_caption ?? '');
  const [topics, setTopics] = useState<string[]>(doc.send_topics ?? []);
  const [codes, setCodes] = useState((doc.property_codes ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  const toggleTopic = (slug: string) =>
    setTopics((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  const save = async () => {
    setSaving(true);
    try {
      await salesAgentsService.updateDocument(agentId, doc.id, {
        title: title.trim() || doc.title,
        sendable, learnable, send_once: sendOnce,
        send_when: when.trim(),
        send_when_not: whenNot.trim(),
        send_caption: caption.trim(),
        send_topics: topics,
        property_codes: codes.split(',').map((c) => c.trim()).filter(Boolean),
      });
      toast.success('Salvo');
      onSaved();
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Como a IA deve usar este arquivo</DialogTitle>
          <DialogDescription>
            O que você escrever aqui é o que ela lê na hora de decidir. Escreva como explicaria pra um corretor novo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="doc_title">Nome do arquivo</Label>
            <Input id="doc_title" value={title} onChange={(e) => setTitle(e.target.value)}
                   placeholder="Ex: Planta do 2 dormitórios - Alma Panamby" />
            <p className="text-xs text-muted-foreground mt-1">É por este nome que ela se refere ao arquivo.</p>
          </div>

          <div className="border-t border-sidebar-border pt-3 space-y-2">
            <CheckRow
              checked={sendable} onChange={setSendable}
              title="A IA pode enviar este arquivo pro lead"
              desc="Desligado, ele serve só pra ela aprender."
            />
            {sendable && doc.send_mode === 'link' && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Arquivo grande ({doc.size_label}). A IA manda o link em vez do arquivo.
              </p>
            )}
            {sendable && doc.send_mode === 'blocked' && (
              <p className="text-xs text-red-500">
                Arquivo grande demais ({doc.size_label}) e sem endereço público pra oferecer. Reduza o arquivo.
              </p>
            )}
          </div>

          {sendable && (
            <div className="space-y-4 border-l-2 border-primary/30 pl-3">
              <div>
                <Label>Assunto do arquivo</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {DOCUMENT_TOPICS.map((t) => (
                    <button
                      key={t.slug} type="button" onClick={() => toggleTopic(t.slug)}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        topics.includes(t.slug)
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-sidebar-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="doc_when">Quando enviar</Label>
                <Textarea id="doc_when" rows={2} value={when} onChange={(e) => setWhen(e.target.value)}
                          placeholder="Ex: quando o lead pedir a planta ou perguntar como são divididos os cômodos" />
              </div>

              <div>
                <Label htmlFor="doc_when_not">Quando NÃO enviar</Label>
                <Textarea id="doc_when_not" rows={2} value={whenNot} onChange={(e) => setWhenNot(e.target.value)}
                          placeholder="Ex: antes de o lead dizer o que procura; se ele só quer alugar" />
              </div>

              <div>
                <Label htmlFor="doc_caption">Mensagem que vai junto</Label>
                <Input id="doc_caption" value={caption} onChange={(e) => setCaption(e.target.value)}
                       placeholder="Ex: segue a planta do 2 dormitórios, qualquer dúvida me chama" />
              </div>

              <div>
                <Label htmlFor="doc_codes">Vale para quais imóveis</Label>
                <Input id="doc_codes" value={codes} onChange={(e) => setCodes(e.target.value)}
                       placeholder="Ex: AP123, AP124" />
                <p className="text-xs text-muted-foreground mt-1">
                  Códigos separados por vírgula. Em branco, vale pra qualquer conversa.
                </p>
              </div>

              <CheckRow
                checked={sendOnce} onChange={setSendOnce}
                title="Enviar no máximo uma vez por conversa"
                desc="Evita repetir o mesmo arquivo pro lead."
              />
            </div>
          )}

          <div className="border-t border-sidebar-border pt-3">
            <CheckRow
              checked={learnable} onChange={setLearnable}
              title="Usar o conteúdo deste arquivo na base de conhecimento"
              desc="Desligue em arquivo que é só pra enviar."
            />
            {doc.status === 'no_text' && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Este arquivo não tem texto pra aprender (parece escaneado ou é imagem). O envio funciona normalmente.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Link de anúncio (por imóvel) ----------------

function PropertyLinkBox({
  agent, propertyCode, onCodeChange,
}: {
  agent: SalesAgent;
  propertyCode: string;
  onCodeChange: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SalesAgentPropertyLink | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await salesAgentsService.propertyLink(agent.id, propertyCode.trim() || undefined);
      setResult(r);
    } catch {
      toast.error('Não foi possível gerar o link. Confira se o canal de WhatsApp está conectado no agente.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result?.link) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('Link copiado');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <div className="border border-sidebar-border rounded-md p-4 space-y-3 bg-muted/10">
      <div className="flex items-center gap-2 text-sm font-medium"><Link2 className="h-4 w-4" /> Link de anúncio com IA</div>
      <p className="text-xs text-muted-foreground">
        Cole este link no anúncio (Facebook, Google, YouTube) ou na landing do imóvel. O lead clica, cai no WhatsApp com
        a mensagem pronta e a IA já sabe de qual imóvel ele veio.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Código do imóvel (ex: AP123)"
          value={propertyCode}
          onChange={(e) => onCodeChange(e.target.value)}
        />
        <Button size="sm" onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar link'}
        </Button>
      </div>
      {result?.link && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input readOnly value={result.link} className="text-xs" />
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mensagem pré-pronta: <span className="italic">"{result.message}"</span>
            {result.property && <> — imóvel <strong>{result.property.code}</strong> ({result.property.title})</>}
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        O mesmo código digitado aqui também é usado no teste abaixo, pra você ver a IA falando desse imóvel.
      </p>
    </div>
  );
}

// Par chave/valor do formulário do Meta. Estado local pra os dois campos não
// remontarem a lista inteira a cada tecla.
function FormAnswerAdder({ onAdd }: { onAdd: (key: string, value: string) => void }) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const add = () => {
    if (!key.trim() || !value.trim()) return;
    onAdd(key.trim(), value.trim());
    setKey('');
    setValue('');
  };

  return (
    <div className="flex gap-2">
      <Input placeholder="Pergunta (ex: Quando pretende comprar?)" value={key} onChange={(e) => setKey(e.target.value)} />
      <Input
        placeholder="Resposta (ex: Nos próximos 3 meses)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
      />
      <Button variant="outline" size="sm" onClick={add} disabled={!key.trim() || !value.trim()}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ---------------- Test ----------------

// Turno da conversa de teste. `media` é só de exibição — a API recebe apenas
// role/content, igual antes.
type TestTurn = TestHistoryItem & { media?: TestMediaItem[] };

// Cenário de teste: o contexto do lead + a primeira mensagem dele.
//
// Preencher nome, origem, interesse e formulário na mão a cada teste dá
// preguiça, e a preguiça leva a testar sempre o mesmo caso fácil — justamente
// o que não revela problema. Um clique monta o cenário inteiro.
interface TestScenario {
  id: string;
  label: string;
  hint: string;
  contactName: string;
  source: string;
  interest: string;
  formAnswers: Record<string, string>;
  /**
   * Conversa que JÁ aconteceu antes deste turno. Vazio = primeiro contato.
   *
   * Muda o comportamento na raiz, não só o clima: o prompt escolhe entre três
   * aberturas conforme o histórico. Com mensagem da IA no histórico ele entra em
   * CONTINUIDADE ("você JÁ conversou com este lead, NÃO recomece"); sem nada, roda
   * o roteiro de abertura inteiro, terminando na pergunta de intenção. Testar
   * "lead que já visitou" digitando uma frase num chat vazio testa o caso errado.
   */
  history?: TestHistoryItem[];
  /** Próxima mensagem do lead, já no campo — é só apertar enviar. */
  firstMessage: string;
}

// Os casos que separam uma IA que funciona de uma que parece funcionar. Cada um
// checa um comportamento específico, descrito no `hint`.
//
// Metade tem conversa já semeada, e não é enfeite: o prompt escolhe a abertura
// pelo histórico. Um lead "que já visitou" digitado num chat VAZIO é, pro
// sistema, um primeiro contato — ele roda o roteiro de abertura e a pergunta de
// intenção, e o teste acaba medindo o caso errado.
const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'ctwa',
    label: 'Veio do anúncio',
    hint: 'O caso mais comum. Confere se ela abre citando o empreendimento e faz a pergunta de intenção — sem despejar preço.',
    contactName: 'Camila',
    source: 'Anúncio Instagram — clique para WhatsApp',
    interest: '',
    formAnswers: {},
    firstMessage: 'oi, vi o anúncio',
  },
  {
    id: 'form',
    label: 'Formulário do Meta',
    hint: 'O lead já respondeu no anúncio. Ela NÃO pode perguntar de novo o que está aqui embaixo.',
    contactName: 'Rodrigo',
    source: 'Formulário Meta Lead Ads',
    interest: '',
    formAnswers: {
      'Quando pretende comprar?': 'Nos próximos 3 meses',
      'Faixa de investimento': 'Até 450 mil',
      'É para morar ou investir?': 'Morar',
    },
    firstMessage: 'oi',
  },
  {
    id: 'visitou-primeiro-contato',
    label: 'Visitou, 1º contato',
    hint: 'Visitou o plantão no fim de semana e manda a PRIMEIRA mensagem. Sem histórico, o prompt roda o roteiro de abertura — confira se ela insiste na pergunta de intenção mesmo o lead já tendo visitado.',
    contactName: 'Patrícia',
    source: 'Anúncio Instagram',
    interest: 'Já visitou o decorado',
    formAnswers: {},
    firstMessage: 'eu já visitei semana passada, queria as plantas e o lazer',
  },
  {
    id: 'conversa-andando',
    label: 'Conversa em andamento',
    hint: 'A IA já falou antes. Tem que CONTINUAR de onde parou: nada de se reapresentar, repetir a saudação ou refazer a pergunta de intenção.',
    contactName: 'Patrícia',
    source: 'Anúncio Instagram',
    interest: '',
    formAnswers: {},
    history: [
      { role: 'user', content: 'oi, vi o anúncio' },
      {
        role: 'assistant',
        content:
          'Patrícia, olá, tudo bem? Sou o Eduardo, consultor imobiliário. Vi que você se cadastrou agorinha no nosso anúncio. Queria entender de fato o que você está buscando: seu foco é moradia, investimento, ou ainda não sabe e tá só sondando?',
      },
      { role: 'user', content: 'é pra morar, eu e meu marido' },
      {
        role: 'assistant',
        content: 'Que bom, Patrícia. Vocês estão pensando em quantos quartos? E tem alguma região que faz mais sentido pro dia a dia de vocês?',
      },
      { role: 'user', content: '2 quartos, de preferência perto do metrô' },
    ],
    firstMessage: 'consegue me mandar as plantas?',
  },
  {
    id: 'voltou',
    label: 'Sumiu e voltou',
    hint: 'Conversa parada há dias e o lead reaparece. Ela tem que retomar o assunto, não abrir de novo como se fosse um lead novo.',
    contactName: 'Thiago',
    source: 'Anúncio Facebook',
    interest: '',
    formAnswers: {},
    history: [
      { role: 'user', content: 'quanto tá o de 2 quartos?' },
      {
        role: 'assistant',
        content:
          'Thiago, tudo bem? Sou o Eduardo. Antes de falar de valor, queria entender: é pra morar ou pra investir?',
      },
      { role: 'user', content: 'investir' },
      {
        role: 'assistant',
        content: 'Show. Qual faixa de investimento você tá confortável pra esse tipo de projeto?',
      },
    ],
    firstMessage: 'desculpa a demora, sumi aqui. ainda dá pra ver esse apê?',
  },
  {
    id: 'fora-do-perfil',
    label: 'Fora do perfil',
    hint: 'Pede algo que o imóvel do anúncio não é. Confere se ela oferece alternativa REAL do catálogo, com preço, em vez de empurrar pro corretor.',
    contactName: 'Marcos',
    source: 'Anúncio Facebook',
    interest: '',
    formAnswers: {},
    firstMessage: 'esse é muito pequeno, tem de 3 quartos em outro bairro?',
  },
  {
    id: 'sondando',
    label: 'Só sondando',
    hint: 'Sem intenção definida. Ela tem que nutrir com leveza, sem pressão e sem insistir na pergunta de intenção.',
    contactName: 'Bruno',
    source: 'Anúncio Instagram',
    interest: '',
    formAnswers: {},
    firstMessage: 'to só dando uma olhada por enquanto',
  },
];

// Cenários que o próprio usuário salva. localStorage e não banco: é ferramenta
// de bancada, some se trocar de navegador, e não vale poluir a config do agente
// (que é dado de produção) com material de teste.
const SCENARIOS_KEY = 'lmflow:sales-agent-test-scenarios';

function loadSavedScenarios(): TestScenario[] {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    return raw ? (JSON.parse(raw) as TestScenario[]) : [];
  } catch {
    return [];
  }
}

function persistScenarios(list: TestScenario[]) {
  try {
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(list));
  } catch {
    // Cota cheia ou storage bloqueado: o cenário se perde, mas o teste continua.
  }
}

function TestTab({ agent }: { agent: SalesAgent }) {
  const { perguntar, dialogoDePergunta } = usePergunta();
  const [history, setHistory] = useState<TestTurn[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SalesAgentTestResult | null>(null);
  const [propertyCode, setPropertyCode] = useState('');
  // O runner real manda a mídia UMA vez por imóvel, não a cada mensagem. Sem isto
  // o teste repetiria a foto em todo turno e daria uma impressão errada.
  const [mediaShownFor, setMediaShownFor] = useState<string | null>(null);

  // Contexto do lead. O nome era chumbado como "Lead Teste" e origem, interesse e
  // respostas do formulário nunca eram enviados — o backend sempre aceitou os
  // quatro. Sem eles a IA não sabe que o lead veio de um anúncio nem o que ele já
  // respondeu, e a conversa de teste sai mais fria e mais genérica que a real.
  const [contactName, setContactName] = useState('Lead Teste');
  const [source, setSource] = useState('');
  const [interest, setInterest] = useState('');
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const [loadRef, setLoadRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<TestScenario[]>(() => loadSavedScenarios());

  // Aplicar um cenário SUBSTITUI a conversa pela do cenário (vazia, quando ele
  // não tem histórico). Mesclar com o que estava na tela criaria uma conversa que
  // não existe em lugar nenhum — e o histórico é justamente o que decide se o
  // prompt abre do zero ou continua de onde parou.
  const applyScenario = (s: TestScenario) => {
    setContactName(s.contactName);
    setSource(s.source);
    setInterest(s.interest);
    setFormAnswers({ ...s.formAnswers });
    setMessage(s.firstMessage);
    setHistory((s.history ?? []).map((m) => ({ ...m })));
    setLast(null);
    setMediaShownFor(null);
  };

  const saveCurrentScenario = async () => {
    const label = await perguntar({
      titulo: 'Salvar cenário',
      descricao: 'A conversa da tela vira o histórico do cenário, pra você poder repetir este caso depois.',
      rotuloDoCampo: 'Nome do cenário',
      placeholder: 'Ex.: lead frio que some no meio',
      rotuloDaAcao: 'Salvar cenário',
    });
    if (!label) return;

    const scenario: TestScenario = {
      id: `custom-${label.toLowerCase().replace(/\s+/g, '-')}`,
      label,
      hint: 'Cenário salvo por você.',
      contactName,
      source,
      interest,
      formAnswers: { ...formAnswers },
      // A conversa da tela vira o histórico do cenário — inclusive a que você
      // acabou de rodar. É assim que se guarda "aquele caso que deu errado" pra
      // conferir depois se a mudança no prompt resolveu.
      history: history.map(({ role, content }) => ({ role, content })),
      firstMessage: message.trim(),
    };
    // Mesmo nome sobrescreve, em vez de duplicar na lista.
    const next = [...savedScenarios.filter((s) => s.id !== scenario.id), scenario];
    setSavedScenarios(next);
    persistScenarios(next);
    toast.success(`Cenário "${label}" salvo`);
  };

  const removeScenario = (id: string) => {
    const next = savedScenarios.filter((s) => s.id !== id);
    setSavedScenarios(next);
    persistScenarios(next);
  };

  const send = async () => {
    if (!message.trim()) return;
    const userMsg = message.trim();
    const code = propertyCode.trim();
    setMessage('');
    setBusy(true);
    const apiHistory: TestHistoryItem[] = history.map(({ role, content }) => ({ role, content }));
    const newHistory: TestTurn[] = [...history, { role: 'user', content: userMsg }];
    setHistory(newHistory);
    try {
      const result = await salesAgentsService.testRun(agent.id, userMsg, apiHistory, {
        contactName: contactName.trim() || 'Lead Teste',
        source: source.trim(),
        interest: interest.trim(),
        formAnswers,
        propertyCode: code,
      });
      const firstTimeForThisProperty = mediaShownFor !== code;
      const media = firstTimeForThisProperty ? result.media ?? [] : [];
      if (media.length > 0) setMediaShownFor(code);
      // Uma bolha por MENSAGEM, não por turno: é assim que o lead recebe quando a
      // quebra está ligada. Mostrar uma bolha só faria quem liga a chave e testa
      // aqui concluir que ela não funciona. A mídia fica pendurada na última,
      // porque no atendimento real ela sai depois de todo o texto.
      const parts = result.reply_parts?.length ? result.reply_parts : [result.reply];
      setHistory([
        ...newHistory,
        ...parts.map((content, i) => ({
          role: 'assistant' as const,
          content,
          media: i === parts.length - 1 ? media : [],
        })),
      ]);
      setLast(result);
    } catch {
      toast.error('Erro no teste (verifique se a chave da IA está configurada)');
    } finally {
      setBusy(false);
    }
  };

  const loadRealConversation = async () => {
    const ref = loadRef.trim();
    if (!ref) return;
    setLoading(true);
    try {
      // Aceita ID de conversa ou telefone: quem está testando quase sempre tem o
      // telefone à mão, não o UUID.
      const isPhone = /^[\d\s()+-]+$/.test(ref);
      const ctx = await salesAgentsService.conversationContext(
        agent.id,
        isPhone ? { phone: ref } : { conversationId: ref },
      );
      setHistory(ctx.history);
      setContactName(ctx.contact_name ?? 'Lead Teste');
      setSource(ctx.source ?? '');
      setInterest(ctx.interest ?? '');
      setFormAnswers(ctx.form_answers ?? {});
      if (ctx.property_code) setPropertyCode(ctx.property_code);
      setMediaShownFor(null);
      setLast(null);
      toast.success(`Conversa carregada — ${ctx.history.length} mensagens`);
    } catch {
      toast.error('Não achei essa conversa (tente o telefone com DDD ou o ID).');
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setHistory([]);
    setLast(null);
    setMediaShownFor(null);
    setFormAnswers({});
    setSource('');
    setInterest('');
    setContactName('Lead Teste');
  };

  const formAnswerEntries = Object.entries(formAnswers);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Converse como se fosse o lead. Não envia nada no WhatsApp — é só teste.</p>

      {/* Carregar conversa real: o teste digitado à mão não reproduz o que o lead
          traz (nome, campanha, formulário, imóvel resolvido), e é justamente isso
          que faz a IA saber do que está falando. Só leitura — nada é enviado. */}
      <div className="border border-sidebar-border rounded-md p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bot className="h-4 w-4" /> Carregar uma conversa real
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Telefone com DDD ou ID da conversa"
            value={loadRef}
            onChange={(e) => setLoadRef(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void loadRealConversation(); }}
          />
          <Button variant="outline" onClick={() => void loadRealConversation()} disabled={loading || !loadRef.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Carregar'}
          </Button>
          {history.length > 0 && (
            <Button variant="ghost" onClick={clearAll}>Limpar</Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Traz o histórico e o contexto de um lead de verdade pra você continuar a conversa daqui.
          Não envia mensagem nem grava nada — pode apontar pra um lead ativo.
        </p>
      </div>

      {/* Cenários prontos. Cada um monta o contexto inteiro e já deixa a primeira
          mensagem no campo — é só apertar enviar. Sem isto, digitar tudo de novo
          a cada teste leva a testar sempre o mesmo caso fácil, que é o que menos
          revela problema. */}
      <div className="border border-sidebar-border rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4" /> Cenários
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void saveCurrentScenario()}>
            Salvar o atual
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TEST_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.hint}
              onClick={() => applyScenario(s)}
              className="inline-flex items-center gap-1 rounded-md border border-sidebar-border px-2.5 py-1 text-xs hover:bg-muted transition-colors"
            >
              {s.label}
              {/* Marca quem já vem com conversa: é a diferença entre testar a
                  abertura e testar a continuidade, e não dá pra adivinhar pelo nome. */}
              {(s.history?.length ?? 0) > 0 && (
                <span className="text-[10px] text-muted-foreground" title="Já vem com conversa">
                  💬
                </span>
              )}
            </button>
          ))}
          {savedScenarios.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center rounded-md border border-primary/40 bg-primary/5 text-xs"
            >
              <button
                type="button"
                title={s.hint}
                onClick={() => applyScenario(s)}
                className="px-2.5 py-1 hover:bg-primary/10 rounded-l-md transition-colors"
              >
                {s.label}
              </button>
              <button
                type="button"
                title="Remover cenário"
                onClick={() => removeScenario(s.id)}
                className="px-1.5 py-1 text-muted-foreground hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Passe o mouse pra ver o que cada um testa. Os marcados com 💬 já vêm com uma conversa
          anterior — e isso muda a resposta: sem histórico ela abre do zero, com histórico ela
          continua de onde parou. Aplicar um cenário substitui a conversa da tela.
          Ao salvar o seu, a conversa atual vai junto.
        </p>
      </div>

      {/* Contexto do lead. O backend sempre aceitou estes campos; a tela mandava
          só o nome, chumbado como "Lead Teste". */}
      <div className="border border-sidebar-border rounded-md p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4" /> Contexto do lead
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <Label htmlFor="test_name" className="text-xs">Nome</Label>
            <Input id="test_name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="test_source" className="text-xs">Origem</Label>
            <Input
              id="test_source"
              placeholder="Anúncio Instagram — Vivaz Mooca"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="test_interest" className="text-xs">Interesse inicial</Label>
            <Input
              id="test_interest"
              placeholder="2 quartos até 400 mil"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Respostas do formulário do Meta</Label>
          {formAnswerEntries.length > 0 && (
            <div className="space-y-1 mt-1 mb-2">
              {formAnswerEntries.map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{k}:</span>
                  <span className="flex-1 truncate text-muted-foreground">{v}</span>
                  <button
                    type="button"
                    className="text-red-500 hover:underline"
                    onClick={() => setFormAnswers((prev) => {
                      const next = { ...prev };
                      delete next[k];
                      return next;
                    })}
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>
          )}
          <FormAnswerAdder onAdd={(k, v) => setFormAnswers((prev) => ({ ...prev, [k]: v }))} />
          <p className="text-xs text-muted-foreground mt-1">
            A IA usa pra não perguntar de novo o que o lead já respondeu no anúncio.
          </p>
        </div>
      </div>

      <PropertyLinkBox agent={agent} propertyCode={propertyCode} onCodeChange={setPropertyCode} />

      <div className="border border-sidebar-border rounded-md p-3 h-72 overflow-auto space-y-2 bg-muted/20">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Mande uma mensagem pra ver a IA responder.</p>
        ) : (
          history.map((h, i) => (
            <div key={i} className="space-y-1">
              <div className={`flex ${h.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${h.role === 'user' ? 'bg-background border' : 'bg-primary/10 text-foreground'}`}>
                  {h.content}
                </div>
              </div>
              {(h.media ?? []).map((m, j) => (
                <div key={j} className="flex justify-end">
                  <TestMediaBubble item={m} />
                </div>
              ))}
            </div>
          ))
        )}
        {busy && <div className="flex justify-end"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Mensagem do lead..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <Button onClick={send} disabled={busy || !message.trim()}><Send className="h-4 w-4" /></Button>
      </div>

      {last && (
        <div className="text-xs text-muted-foreground border border-sidebar-border rounded-md p-3 space-y-1">
          <div>Temperatura: <strong>{TEMP_LABEL[last.temperature] ?? last.temperature}</strong></div>
          {last.should_transfer && <div className="text-amber-600">Transferiria pro corretor: {last.transfer_reason}</div>}
          {last.lead_summary && <div>Resumo: {last.lead_summary}</div>}
        </div>
      )}

      {dialogoDePergunta}
    </div>
  );
}

// A foto/link que o lead REAL receberia. Aqui não há canal pra enviar, então em
// vez de a mídia sumir — deixando a IA parecer que prometeu "te mando as fotos"
// e não cumpriu — mostramos o que teria ido, com a foto de verdade.
function TestMediaBubble({ item }: { item: TestMediaItem }) {
  if (item.type === 'image') {
    return (
      <div className="max-w-[80%] rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
        <img src={item.url} alt="Foto do imóvel" className="w-full max-h-48 object-cover" />
        <div className="px-3 py-2 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium">
            <ImageIcon className="h-3 w-3" /> Foto enviada no WhatsApp
          </div>
          {item.caption && <p className="text-xs text-muted-foreground whitespace-pre-line">{item.caption}</p>}
        </div>
      </div>
    );
  }

  // Arquivo que ela MANDARIA. O painel não envia nada — é aqui que dá pra calibrar
  // as regras de "quando enviar" sem gastar mensagem com lead de verdade.
  if (item.type === 'file') {
    return (
      <div className="max-w-[80%] rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium mb-0.5">
          <FileText className="h-3 w-3" /> Arquivo enviado no WhatsApp
        </div>
        <div className="text-xs font-medium break-words">{item.title}</div>
        {item.caption && <p className="text-xs text-muted-foreground whitespace-pre-line">{item.caption}</p>}
        {item.reason && <p className="text-[11px] text-muted-foreground mt-1 italic">Por quê: {item.reason}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-[80%] rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium mb-0.5">
        <Link2 className="h-3 w-3" /> Link enviado no WhatsApp
      </div>
      <a href={item.url} target="_blank" rel="noreferrer" className="text-xs underline break-all">
        {item.url}
      </a>
    </div>
  );
}

// ---------------- Sugestões (a IA relê as conversas e propõe melhorias) ----------------

const SUGGESTION_PERIODS: [number, string][] = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']];

const WEEKDAY_OPTIONS: [number, string][] = [
  [1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado'], [7, 'Domingo'],
];

// Selo por categoria. A cor separa o que é da IA do que é recado para gente.
const SUGGESTION_STYLE: Record<string, string> = {
  objecao: 'bg-amber-500/10 text-amber-600',
  pergunta: 'bg-blue-500/10 text-blue-600',
  travamento: 'bg-red-500/10 text-red-500',
  operacao: 'bg-violet-500/10 text-violet-500',
};

function SuggestionsTab({ agent }: { agent: SalesAgent }) {
  const [data, setData] = useState<SuggestionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [days, setDays] = useState(30);
  const [mostrarDescartadas, setMostrarDescartadas] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await salesAgentsService.listSuggestions(agent.id));
    } catch {
      // Leitura que a própria tela dispara ao abrir não grita: o pedaço
      // simplesmente não aparece. Aviso é para quando a pessoa clicou.
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => { void load(); }, [load]);

  const analisar = async () => {
    setAnalyzing(true);
    try {
      const novo = await salesAgentsService.analyzeSuggestions(agent.id, days);
      setData(novo);
      toast.success(novo.created ? `${novo.created} sugestão(ões) nova(s)` : 'Nenhum padrão novo desta vez');
    } catch (e) {
      // Aqui a pessoa CLICOU: o motivo em português vem do servidor.
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Não consegui analisar agora.');
    } finally {
      setAnalyzing(false);
    }
  };

  const aplicar = async (s: SalesAgentSuggestion) => {
    setBusyId(s.id);
    try {
      await salesAgentsService.applySuggestion(agent.id, s.id);
      toast.success('Aplicada — virou lição na aba Aprendizado');
      await load();
    } catch {
      toast.error('Não consegui transformar em lição.');
    } finally {
      setBusyId(null);
    }
  };

  const descartar = async (s: SalesAgentSuggestion) => {
    setBusyId(s.id);
    try {
      await salesAgentsService.dismissSuggestion(agent.id, s.id);
      await load();
    } catch {
      toast.error('Não consegui descartar.');
    } finally {
      setBusyId(null);
    }
  };

  const salvarAuto = async (patch: { auto?: boolean; weekday?: number; hour?: number }) => {
    try {
      const auto = await salesAgentsService.saveSuggestionConfig(agent.id, patch);
      setData((prev) => (prev ? { ...prev, auto } : prev));
      toast.success('Salvo');
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  const todas = data?.suggestions ?? [];
  const visiveis = mostrarDescartadas ? todas : todas.filter((s) => s.status !== 'dismissed');
  const descartadas = todas.length - todas.filter((s) => s.status !== 'dismissed').length;
  const noTeto = (data?.lessons_active ?? 0) >= (data?.lessons_cap ?? 12);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        A IA relê as conversas que ela atendeu e aponta o que se repete: a objeção que derruba
        lead, a pergunta que ela não soube responder, onde a conversa morre. O que é sobre o jeito
        de ela falar você aplica com um clique e vira lição. O que é sobre o time fica como recado.
      </p>

      {/* Analisar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {SUGGESTION_PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                days === value
                  ? 'bg-primary/10 text-primary border-primary/40 font-medium'
                  : 'border-sidebar-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => void analisar()} disabled={analyzing} className="ml-auto">
          {analyzing
            ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Lendo as conversas…</>
            : <><Sparkles className="h-4 w-4 mr-1" /> Analisar agora</>}
        </Button>
      </div>

      {/* Automático */}
      <div className="rounded-lg border border-sidebar-border bg-sidebar p-4 space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data?.auto.auto ?? false}
            onChange={(e) => void salvarAuto({ auto: e.target.checked })}
          />
          Analisar sozinha toda semana
        </label>
        <p className="text-xs text-muted-foreground">
          Cada análise é uma consulta paga à IA. Desligada, ela só roda quando você clica em
          <span className="font-medium"> Analisar agora</span>.
        </p>
        {data?.auto.auto && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select
              value={data.auto.weekday}
              onChange={(e) => void salvarAuto({ weekday: Number(e.target.value) })}
              className="rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm"
            >
              {WEEKDAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <span className="text-sm text-muted-foreground">às</span>
            <select
              value={data.auto.hour}
              onChange={(e) => void salvarAuto({ hour: Number(e.target.value) })}
              className="rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Lista */}
      {loading && !data ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-sidebar-border bg-sidebar p-4">
          Nenhuma sugestão ainda. Clique em <span className="font-medium">Analisar agora</span> — a IA
          precisa de conversas atendidas no período para encontrar um padrão.
        </p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              busy={busyId === s.id}
              onApply={() => void aplicar(s)}
              onDismiss={() => void descartar(s)}
            />
          ))}
        </ul>
      )}

      {descartadas > 0 && (
        <button
          type="button"
          onClick={() => setMostrarDescartadas((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {mostrarDescartadas ? 'Esconder' : 'Ver'} {descartadas} descartada(s)
        </button>
      )}

      {/* Rodapé: o que já custou e quanto a IA de fato lê */}
      {data && (
        <div className="pt-3 border-t border-sidebar-border text-xs text-muted-foreground space-y-1">
          {data.last_analysis_at && (
            <p>
              Última análise em {new Date(data.last_analysis_at).toLocaleDateString('pt-BR')}
              {data.last_analysis_cost_usd > 0 && ` — custou US$ ${data.last_analysis_cost_usd.toFixed(4)}`}
            </p>
          )}
          <p className={noTeto ? 'text-amber-600' : undefined}>
            {data.lessons_active} lição(ões) ativa(s).
            {noTeto
              ? ` A IA lê no máximo ${data.lessons_cap} de cada tipo: aplicar mais não muda o comportamento dela. Remova as que já não valem, na aba Aprendizado.`
              : ` Ela lê até ${data.lessons_cap} de cada tipo.`}
          </p>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion, busy, onApply, onDismiss,
}: {
  suggestion: SalesAgentSuggestion;
  busy: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const conversas = suggestion.evidence?.conversations ?? 0;
  const citacoes = suggestion.evidence?.quotes ?? [];
  const aplicada = suggestion.status === 'applied';
  const descartada = suggestion.status === 'dismissed';

  return (
    <li className={`rounded-lg border border-sidebar-border p-4 space-y-2 ${descartada ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${SUGGESTION_STYLE[suggestion.category] ?? 'bg-primary/10 text-primary'}`}>
          {suggestion.category_label}
        </span>
        {/* ⚠️ O selo do time não é enfeite: ele explica por que não existe botão
            de aplicar. Recado para gente virando lição faria a IA repetir isso
            para o lead. */}
        {suggestion.target === 'equipe' && (
          <span className="text-xs px-2 py-0.5 rounded shrink-0 bg-sidebar text-muted-foreground border border-sidebar-border">
            <Users className="h-3 w-3 inline mr-1" />Recado para o time
          </span>
        )}
        {aplicada && (
          <span className="text-xs px-2 py-0.5 rounded shrink-0 bg-green-500/10 text-green-600">
            <Check className="h-3 w-3 inline mr-1" />Aplicada
          </span>
        )}
        <span className="flex-1" />
        {conversas > 0 && (
          <span className="text-xs text-muted-foreground shrink-0" title="Em quantas conversas isso apareceu">
            <MessageSquare className="h-3 w-3 inline mr-1" />{conversas}
          </span>
        )}
      </div>

      <div className="text-sm font-medium">{suggestion.title}</div>
      {suggestion.body && <p className="text-sm text-muted-foreground">{suggestion.body}</p>}

      {citacoes.length > 0 && (
        <ul className="space-y-1 pt-1">
          {citacoes.map((q, i) => (
            <li key={i} className="text-xs text-muted-foreground border-l-2 border-sidebar-border pl-2 italic">
              “{q}”
            </li>
          ))}
        </ul>
      )}

      {suggestion.appliable && suggestion.lesson_content && (
        <div className="text-xs rounded-md bg-sidebar border border-sidebar-border p-2">
          <span className="text-muted-foreground">Vira esta lição: </span>
          {suggestion.lesson_content}
        </div>
      )}

      {!descartada && (
        <div className="flex gap-2 pt-1">
          {/* Quem manda no botão é o servidor (`appliable`), não uma dedução da tela. */}
          {suggestion.appliable && !aplicada && (
            <Button size="sm" onClick={onApply} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lightbulb className="h-4 w-4 mr-1" /> Aplicar</>}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDismiss} disabled={busy}>
            <X className="h-4 w-4 mr-1" /> Descartar
          </Button>
        </div>
      )}
    </li>
  );
}

// ---------------- Relatórios (do CLIENTE, não da IA) ----------------

// ⚠️ Esta aba mora dentro da tela da IA, mas o relatório é do CLIENTE: ele não
// recebe `agent`, e a configuração é a mesma em qualquer IA que você abrir. Duas
// IAs no mesmo cliente fariam o gestor receber a semana duas vezes.
function ReportsTab() {
  const [payload, setPayload] = useState<{ config: WeeklyReportConfig; current: WeeklyReport | null; history: WeeklyReport[] } | null>(null);
  const [targets, setTargets] = useState<WeeklyReportTargets>({ groups: [], managers: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'preview' | 'send' | 'text' | null>(null);
  const [texto, setTexto] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dados, alvos] = await Promise.all([
        salesAgentsService.weeklyReport(),
        salesAgentsService.weeklyReportTargets().catch(() => ({ groups: [], managers: [] })),
      ]);
      setPayload(dados);
      setTargets(alvos);
      setTexto(dados.current?.text ?? '');
    } catch {
      // Leitura de fundo não grita.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const salvarConfig = async (patch: Partial<WeeklyReportConfig>) => {
    try {
      const config = await salesAgentsService.saveWeeklyReportConfig(patch);
      setPayload((prev) => (prev ? { ...prev, config } : prev));
      toast.success('Salvo');
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  const gerarPrevia = async () => {
    setBusy('preview');
    try {
      const report = await salesAgentsService.weeklyReportPreview();
      setPayload((prev) => (prev ? { ...prev, current: report } : prev));
      setTexto(report.text ?? '');
      toast.success('Prévia gerada');
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Não consegui montar a prévia.');
    } finally {
      setBusy(null);
    }
  };

  const salvarTexto = async () => {
    setBusy('text');
    try {
      const report = await salesAgentsService.weeklyReportSaveText(texto);
      setPayload((prev) => (prev ? { ...prev, current: report } : prev));
      toast.success('Texto salvo');
    } catch {
      toast.error('Erro ao salvar o texto');
    } finally {
      setBusy(null);
    }
  };

  const enviar = async () => {
    setBusy('send');
    try {
      const report = await salesAgentsService.weeklyReportSendNow();
      setPayload((prev) => (prev ? { ...prev, current: report } : prev));
      if (report.delivered_count > 0) toast.success(`Enviado para ${report.delivered_count} destino(s)`);
      else toast.error('Nenhum destino recebeu. Confira a lista abaixo.');
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Não consegui enviar agora.');
    } finally {
      setBusy(null);
    }
  };

  const config = payload?.config;
  const atual = payload?.current;
  const jaEnviado = atual?.status === 'sent';
  const destinos = (config?.group_jids.length ?? 0) + (config?.user_ids.length ?? 0);

  const alternar = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

  if (loading && !payload) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        O resumo da semana dos atendimentos — o que a IA entregou e o que o time fez — enviado no
        WhatsApp pelo número operacional da Leal Mídia. Monte a prévia, confira, edite o texto e mande.
      </p>

      {/* Prévia */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void gerarPrevia()} disabled={busy !== null}>
          {busy === 'preview' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Gerar prévia
        </Button>
        {atual && <span className="text-sm text-muted-foreground">Semana de {atual.period_label}</span>}
      </div>

      {atual && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatsBlock
              titulo="A IA"
              icone={<Bot className="h-4 w-4" />}
              linhas={[
                ['Leads atendidos', atual.stats?.ia?.attended ?? 0],
                ['Responderam', atual.stats?.ia?.answered ?? 0],
                ['Qualificados', atual.stats?.ia?.qualified ?? 0],
                ['Visitas marcadas', atual.stats?.ia?.visits ?? 0],
                ['Passados para corretor', atual.stats?.ia?.handoffs ?? 0],
              ]}
            />
            <StatsBlock
              titulo="O time"
              icone={<Users className="h-4 w-4" />}
              linhas={[
                ['Leads novos', Number((atual.stats?.equipe as Record<string, unknown>)?.new_leads ?? 0)],
                ['Reativados', Number((atual.stats?.equipe as Record<string, unknown>)?.reactivated ?? 0)],
                ['Follow-ups enviados', Number((atual.stats?.equipe as Record<string, unknown>)?.followups_sent ?? 0)],
                ['Mensagens enviadas', Number((atual.stats?.equipe as Record<string, unknown>)?.messages_sent ?? 0)],
                ['Mensagens recebidas', Number((atual.stats?.equipe as Record<string, unknown>)?.messages_received ?? 0)],
              ]}
            />
          </div>

          <div>
            <Label>O texto que vai no WhatsApp</Label>
            <Textarea
              rows={12}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={jaEnviado}
              className="font-mono text-xs"
            />
            {jaEnviado ? (
              <p className="text-xs text-muted-foreground mt-1">
                Este relatório já foi enviado — o que está aqui é o que chegou no WhatsApp.
              </p>
            ) : (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void salvarTexto()} disabled={busy !== null}>
                {busy === 'text' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Salvar texto
              </Button>
            )}
          </div>

          {atual.results.length > 0 && (
            <ul className="space-y-1">
              {atual.results.map((r, i) => (
                <li key={i} className="text-xs flex items-center gap-2">
                  <span className={r.ok ? 'text-green-600' : 'text-red-500'}>{r.ok ? '✓' : '✕'}</span>
                  <span>{r.label}</span>
                  {r.detail && <span className="text-muted-foreground">— {r.detail}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Destinos */}
      <div className="pt-2 border-t border-sidebar-border space-y-3">
        <Label>Para quem vai</Label>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Grupos de WhatsApp desta imobiliária</p>
          {targets.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum grupo desta imobiliária foi encontrado no número operacional. Você ainda pode
              mandar para os gestores abaixo.
            </p>
          ) : (
            targets.groups.map((g) => (
              <label key={g.jid} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={config?.group_jids.includes(g.jid) ?? false}
                  onChange={() => void salvarConfig({ group_jids: alternar(config?.group_jids ?? [], g.jid) })}
                />
                {g.name}
              </label>
            ))
          )}
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Gestores</p>
          {targets.managers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum gestor com WhatsApp cadastrado. O número sai do cadastro da pessoa, em
              Configurações → Equipe.
            </p>
          ) : (
            targets.managers.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={config?.user_ids.includes(String(m.id)) ?? false}
                  onChange={() => void salvarConfig({ user_ids: alternar(config?.user_ids ?? [], String(m.id)) })}
                />
                {m.name} <span className="text-xs text-muted-foreground">{m.phone_masked}</span>
              </label>
            ))
          )}
        </div>

        {/* A contagem fica embaixo do dedo: disparo em grupo de cliente é irreversível. */}
        <Button onClick={() => void enviar()} disabled={busy !== null || !atual || jaEnviado || destinos === 0}>
          {busy === 'send' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          Enviar agora {destinos > 0 && `(${destinos})`}
        </Button>
      </div>

      {/* Automático */}
      <div className="pt-2 border-t border-sidebar-border space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={config?.enabled ?? false}
            onChange={(e) => void salvarConfig({ enabled: e.target.checked })}
          />
          Enviar toda semana, sozinho
        </label>
        {config?.enabled && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <select
                value={config.weekday}
                onChange={(e) => void salvarConfig({ weekday: Number(e.target.value) })}
                className="rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm"
              >
                {WEEKDAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span className="text-sm text-muted-foreground">às</span>
              <select
                value={config.hour}
                onChange={(e) => void salvarConfig({ hour: Number(e.target.value) })}
                className="rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              O relatório sempre cobre a semana fechada anterior (segunda a domingo), para uma
              semana poder ser comparada com a outra. Sai uma vez só, mesmo que o horário passe batido.
            </p>
          </>
        )}
      </div>

      {/* Histórico */}
      {(payload?.history.length ?? 0) > 0 && (
        <div className="pt-2 border-t border-sidebar-border">
          <Label>Últimos envios</Label>
          <ul className="space-y-1 mt-2">
            {payload!.history.map((r) => (
              <li key={r.id} className="text-sm flex items-center gap-2">
                <span className="text-muted-foreground">{r.period_label}</span>
                {r.status === 'sent' ? (
                  <span className="text-xs text-green-600">
                    enviado para {r.delivered_count}{r.failed_count > 0 && `, ${r.failed_count} falhou`}
                  </span>
                ) : r.status === 'failed' ? (
                  <span className="text-xs text-red-500">falhou</span>
                ) : (
                  <span className="text-xs text-muted-foreground">rascunho</span>
                )}
                {r.automatic && <span className="text-xs text-muted-foreground">(automático)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatsBlock({ titulo, icone, linhas }: { titulo: string; icone: React.ReactNode; linhas: [string, number][] }) {
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar p-4">
      <div className="text-sm font-medium flex items-center gap-2 mb-2">{icone} {titulo}</div>
      <ul className="space-y-1">
        {linhas.map(([rotulo, valor]) => (
          <li key={rotulo} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{rotulo}</span>
            <span className="font-medium">{valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- Diagnóstico ----------------
//
// Responde as duas perguntas que antes só o log do Railway respondia: "essa IA
// está mesmo no ar?" e "por que ela não atendeu esse lead?". Cada item do
// checklist é uma falha real que já deixou agente mudo sem erro na tela — a
// campeã é o canal sem credencial da Evolution, em que a IA pensava a resposta,
// pagava o token e não enviava nada.

const HEALTH_STYLE: Record<string, { dot: string; text: string }> = {
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-600' },
  error: { dot: 'bg-red-500', text: 'text-red-600' },
};

const RUN_STATUS_LABEL: Record<string, string> = {
  replied: 'Respondeu',
  skipped: 'Não respondeu',
  failed: 'Falhou',
};

const RUN_KIND_LABEL: Record<string, string> = {
  live: 'Conversa',
  followup: 'Follow-up',
  engage: 'Acionada pelo corretor',
  test: 'Teste',
};

// Aba Resultados — o que ESTA IA produziu, pro próprio cliente ver.
//
// A tela tinha Configuração, Base, Aprendizado, Testar e Diagnóstico: cinco abas
// sobre como a IA está montada e nenhuma sobre o que ela entregou. Quem liga uma
// IA quer saber, na semana seguinte, se valeu — e essa resposta só existia no
// painel da Leal Mídia.
//
// Os números vêm da MESMA medição que a Leal Mídia usa (e o painel é o mesmo
// componente): dois números diferentes pro mesmo fato transformariam qualquer
// conversa numa discussão sobre qual tela mente. O custo em dólar não vem junto —
// é o que a Leal Mídia paga à Anthropic, não o que o cliente paga.
//
// Recortado por ESTA IA, não pela conta inteira: uma imobiliária com uma IA de
// venda e outra de locação leria o número errado se a aba somasse as duas.
const RESULT_PERIODS: [number, string][] = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']];

function ResultsTab({ agent }: { agent: SalesAgent }) {
  const [data, setData] = useState<AgentPerformance | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await salesAgentsService.performance(agent.id, days));
    } catch {
      toast.error('Não consegui carregar os resultados desta IA.');
    } finally {
      setLoading(false);
    }
  }, [agent.id, days]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1">
          {RESULT_PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                days === value
                  ? 'bg-primary/10 text-primary border-primary/40 font-medium'
                  : 'border-sidebar-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="ml-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {loading && !data ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-sidebar-border bg-sidebar p-4">
          Esta IA ainda não tem atendimento registrado no período. Os números aparecem sozinhos
          conforme ela responde os leads.
        </p>
      ) : (
        // Segura o desenho anterior mais apagado ao recarregar, em vez de piscar
        // um esqueleto e fazer a tela sumir e voltar ao trocar de período.
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <AiResultsPanel
            counts={data}
            series={data.series}
            caption={`O que a IA “${agent.name}” entregou neste período`}
            seriesTitle="Dia a dia"
          />
          <p className="text-xs text-muted-foreground mt-6">
            Período: últimos {data.days} dias. Uma visita conta como “da IA” quando foi a própria IA
            que a marcou dentro da conversa — visita que o corretor marcou à mão não entra aqui.
          </p>
        </div>
      )}
    </div>
  );
}

function DiagnosticsTab({ agent }: { agent: SalesAgent }) {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [runs, setRuns] = useState<SalesAgentRun[]>([]);
  const [totals, setTotals] = useState<SalesAgentRunTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState<PromptPreview | null>(null);
  const [checkingPrompt, setCheckingPrompt] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, r] = await Promise.all([
        salesAgentsService.diagnostics(agent.id),
        salesAgentsService.runs(agent.id, { days: 30, limit: 50 }),
      ]);
      setHealth(h);
      setRuns(r.runs);
      setTotals(r.totals);
    } catch {
      toast.error('Não consegui carregar o diagnóstico.');
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => { void load(); }, [load]);

  const checkPrompt = async () => {
    setCheckingPrompt(true);
    try {
      setPrompt(await salesAgentsService.testPrompt(agent.id));
    } catch {
      toast.error('Não consegui montar o prompt.');
    } finally {
      setCheckingPrompt(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Situação da IA</h3>
          <p className="text-xs text-muted-foreground">Os passos necessários para ela atender, verificados agora.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="space-y-2">
        {(health?.items ?? []).map((item) => {
          const style = HEALTH_STYLE[item.status] ?? HEALTH_STYLE.warning;
          return (
            <div key={item.key} className="flex items-start gap-3 rounded-md border border-sidebar-border p-3">
              <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${style.dot}`} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                <div className={`text-xs ${item.status === 'ok' ? 'text-muted-foreground' : style.text}`}>{item.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prova de que o cérebro geral chegou neste cliente. Não gasta crédito:
          monta o prompt e não chama o modelo. Existia na API desde sempre e não
          tinha botão em lugar nenhum. */}
      <div className="rounded-md border border-sidebar-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Conferir o que a IA está lendo</div>
            <div className="text-xs text-muted-foreground">Monta o cérebro dela sem gastar crédito nenhum.</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void checkPrompt()} disabled={checkingPrompt}>
            {checkingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Conferir'}
          </Button>
        </div>
        {prompt && (
          <div className="mt-3 space-y-1 text-xs">
            <PromptFlag ok={prompt.has_global_knowledge} label="Cérebro geral da agência" />
            <PromptFlag ok={prompt.has_client_knowledge} label="Base de conhecimento deste cliente" />
            <PromptFlag ok={prompt.has_lessons} label="Aprendizados ensinados" />
            <PromptFlag ok={!!prompt.has_sendable_files} label="Arquivos que ela pode enviar" />
            <p className="text-muted-foreground pt-1">Tamanho do cérebro: {prompt.length.toLocaleString('pt-BR')} caracteres.</p>
          </div>
        )}
      </div>

      {totals && (
        <div>
          <h3 className="text-sm font-medium mb-2">Últimos 30 dias</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Respondeu" value={String(totals.replied)} />
            <Stat label="Não respondeu" value={String(totals.skipped)} />
            <Stat label="Falhou" value={String(totals.failed)} />
            <Stat label="Custo" value={`US$ ${totals.cost_usd.toFixed(2)}`} />
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium mb-2">Últimos atendimentos</h3>
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum registro ainda. Cada mensagem que chegar vai aparecer aqui, inclusive as que a IA decidir não responder.
          </p>
        ) : (
          <div className="space-y-1">
            {runs.map((run) => (
              <div key={run.id} className="flex items-start gap-3 rounded-md border border-sidebar-border px-3 py-2 text-xs">
                <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                  run.status === 'replied' ? 'bg-emerald-500' : run.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="font-medium">{RUN_STATUS_LABEL[run.status] ?? run.status}</span>
                    <span className="text-muted-foreground">· {RUN_KIND_LABEL[run.kind] ?? run.kind}</span>
                    <span className="text-muted-foreground">· {new Date(run.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  {run.status !== 'replied' && run.reason_label && (
                    <div className="text-muted-foreground">{run.reason_label}</div>
                  )}
                  {/* Turno PULADO carrega o detalhe concreto do bloqueio (qual mensagem
                      barrou, de quando) — é informação, não falha, então vai em cinza.
                      Vermelho fica reservado pra erro de verdade. */}
                  {run.error_message && (
                    <div className={`break-words ${run.status === 'failed' ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {run.error_class === 'Detalhe' ? run.error_message : `${run.error_class}: ${run.error_message}`}
                    </div>
                  )}
                  {run.status === 'replied' && !run.delivered && (
                    <div className="text-amber-600">A resposta foi gerada mas o WhatsApp não aceitou o envio.</div>
                  )}
                </div>
                {run.cost_usd > 0 && (
                  <span className="text-muted-foreground whitespace-nowrap">US$ {run.cost_usd.toFixed(4)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PromptFlag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <span className="h-3.5 w-3.5 text-amber-600">—</span>}
      <span className={ok ? '' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-sidebar-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
