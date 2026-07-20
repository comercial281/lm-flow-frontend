import { useEffect, useState, useCallback } from 'react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Bot, Plus, Trash2, Send, FileText, Upload, RefreshCw, Loader2, Link2, Copy, Check, SlidersHorizontal } from 'lucide-react';
import {
  salesAgentsService,
  type SalesAgent,
  type SalesAgentDocument,
  type SalesAgentMode,
  type SalesMethod,
  type GeneratedAgentConfig,
  type ActiveHours,
  type ActiveHoursMode,
  type SalesAgentTrigger,
  type SalesAgentTriggerType,
  type SalesAgentOpening,
  type SalesAgentLesson,
  type SalesAgentLessonKind,
  type SalesAgentTestResult,
  type SalesAgentPropertyLink,
  type TestHistoryItem,
} from '@/services/salesAgents/salesAgentsService';
import inboxesService from '@/services/channels/inboxesService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';

type Tab = 'config' | 'knowledge' | 'learning' | 'test';

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
  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [selected, setSelected] = useState<SalesAgent | null>(null);
  const [inboxes, setInboxes] = useState<InboxOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('config');

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
        model: patch.model ?? selected.model,
        temperature: patch.temperature ?? selected.temperature,
        max_context_tokens: patch.max_context_tokens ?? selected.max_context_tokens,
        active_hours: patch.active_hours ?? selected.active_hours,
        followup_enabled: patch.followup_enabled ?? selected.followup_enabled,
        followup_only: patch.followup_only ?? selected.followup_only,
        followup_min_days: patch.followup_min_days ?? selected.followup_min_days,
        followup_max_days: patch.followup_max_days ?? selected.followup_max_days,
        followup_max_attempts: patch.followup_max_attempts ?? selected.followup_max_attempts,
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
    if (!window.confirm(`Excluir a IA "${agent.name}"?`)) return;
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
              {([['config', 'Configuração'], ['knowledge', 'Base de Conhecimento'], ['learning', 'Aprendizado'], ['test', 'Testar']] as [Tab, string][]).map(
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
            {tab === 'knowledge' && <KnowledgeTab agent={selected} onCountChange={loadAgents} />}
            {tab === 'learning' && <LearningTab agent={selected} />}
            {tab === 'test' && <TestTab agent={selected} />}
          </div>
        )}
      </main>
    </div>
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

      <RecepcaoSection agent={agent} onChange={onChange} onSave={onSave} />
      <VisitSection agent={agent} onChange={onChange} onSave={onSave} />
      <IntelligenceSection agent={agent} onChange={onChange} onSave={onSave} />
      <ScheduleSection agent={agent} onSave={onSave} />
      <AudioSection agent={agent} onChange={onChange} onSave={onSave} />
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

function ScheduleSection({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const hours: ActiveHours = agent.active_hours ?? {};
  const mode: ActiveHoursMode = hours.mode ?? 'always';
  const enabled = mode !== 'always';
  const win = hours.windows?.[0] ?? { start: '08:00', end: '18:00' };

  const toggleEnabled = (on: boolean) => {
    onSave({ active_hours: { ...hours, mode: on ? 'outside_business' : 'always', tz: hours.tz ?? 'America/Sao_Paulo' } });
  };
  const setMode = (m: ActiveHoursMode) => {
    const next: ActiveHours = { ...hours, mode: m, tz: hours.tz ?? 'America/Sao_Paulo' };
    if (m === 'custom' && !next.windows?.length) next.windows = [{ start: '08:00', end: '18:00' }];
    onSave({ active_hours: next });
  };
  const setWindow = (start: string, end: string) => {
    onSave({ active_hours: { ...hours, mode: 'custom', tz: hours.tz ?? 'America/Sao_Paulo', windows: [{ start, end }] } });
  };

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
      {enabled && mode === 'custom' && (
        <div className="flex items-end gap-3 mt-2">
          <div>
            <Label htmlFor="win_start" className="text-xs">Das</Label>
            <Input id="win_start" type="time" value={win.start} className="mt-1 w-32"
              onChange={(e) => setWindow(e.target.value, win.end)} />
          </div>
          <div>
            <Label htmlFor="win_end" className="text-xs">Até</Label>
            <Input id="win_end" type="time" value={win.end} className="mt-1 w-32"
              onChange={(e) => setWindow(win.start, e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground pb-2">Se o fim for menor que o início, vira a madrugada (ex: 20h às 06h).</p>
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

const WEEKDAYS: [number, string][] = [
  [1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom'],
];

function VisitWindows({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const c = agent.visit_config ?? {};
  const days = c.days ?? [1, 2, 3, 4, 5];
  const patch = (p: Partial<NonNullable<SalesAgent['visit_config']>>) => onSave({ visit_config: { ...c, ...p } });
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    patch({ days: next });
  };

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

      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label htmlFor="opening_image">Print de abertura (URL da imagem, opcional)</Label>
          <Input
            id="opening_image"
            placeholder="https://...jpg"
            value={agent.opening_image_url ?? ''}
            onChange={(e) => onChange({ ...agent, opening_image_url: e.target.value })}
            onBlur={() => onSave({ opening_image_url: (agent.opening_image_url ?? '').trim() || null })}
          />
        </div>
        <div>
          <Label htmlFor="opening_audio">Áudio de abertura (URL do áudio, opcional)</Label>
          <Input
            id="opening_audio"
            placeholder="https://...ogg"
            value={agent.opening_audio_url ?? ''}
            onChange={(e) => onChange({ ...agent, opening_audio_url: e.target.value })}
            onBlur={() => onSave({ opening_audio_url: (agent.opening_audio_url ?? '').trim() || null })}
          />
        </div>
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
                <div>
                  <Label className="text-xs">Print (URL)</Label>
                  <Input placeholder="https://...jpg"
                    value={o.image_url ?? ''}
                    onChange={(e) => patchOpening(i, { image_url: e.target.value })}
                    onBlur={() => commitOpenings(openings)} />
                </div>
                <div>
                  <Label className="text-xs">Áudio (URL)</Label>
                  <Input placeholder="https://...ogg"
                    value={o.audio_url ?? ''}
                    onChange={(e) => patchOpening(i, { audio_url: e.target.value })}
                    onBlur={() => commitOpenings(openings)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
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

      {/* Escalação: passar pro humano */}
      <div>
        <div className="text-sm font-medium mb-1">Passar pro humano na hora quando…</div>
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

      {/* Extras */}
      <div>
        <div className="text-sm font-medium mb-1">Extras</div>
        <CheckRow checked={agent.cross_sell_enabled !== false} onChange={(v) => onSave({ cross_sell_enabled: v })}
          title="Oferecer outras opções" desc="Quando não tem o imóvel exato, sugere alternativas reais e não perde o lead." />
        <CheckRow checked={agent.rich_media_enabled !== false} onChange={(v) => onSave({ rich_media_enabled: v })}
          title="Mandar foto e link do imóvel" desc="Envia mídia do imóvel de interesse no WhatsApp." />
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
            Se o lead sumir, a IA volta sozinha com uma mensagem personalizada (baseada em toda a conversa e no imóvel), na cadência que você definir. Infinito por padrão. Desligado = não dispara nada.
          </div>
        </div>
        <Toggle on={!!on} onChange={(v) => onSave({ followup_enabled: v })} />
      </div>

      {on && (
        <div className="mt-3 space-y-3 pl-7">
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
            <p className="text-xs text-muted-foreground pb-2">A IA espera um tempo aleatório nessa faixa entre cada follow-up.</p>
          </div>

          <div>
            <Label htmlFor="fu_max_att" className="text-xs">Máximo de follow-ups (0 = infinito, para sempre)</Label>
            <Input id="fu_max_att" type="number" min={0} value={agent.followup_max_attempts ?? 0} className="mt-1 w-40"
              onChange={(e) => onChange({ ...agent, followup_max_attempts: Number(e.target.value) })}
              onBlur={() => onSave({ followup_max_attempts: Math.max(0, Number(agent.followup_max_attempts) || 0) })} />
          </div>

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
  { value: 'keyword', label: 'Contém palavra' },
  { value: 'origin', label: 'Origem do lead' },
  { value: 'property', label: 'Imóvel (código / form)' },
  { value: 'pipeline_stage', label: 'Coluna de pipeline' },
];

interface PipelineOpt { id: string; name: string }
interface StageOpt { id: string; name: string }

function newTrigger(type: SalesAgentTriggerType): SalesAgentTrigger {
  switch (type) {
    case 'keyword': return { type, value: '' };
    case 'origin': return { type, mode: 'ads' };
    case 'property': return { type, mode: 'any' };
    case 'pipeline_stage': return { type, pipeline_id: '', stage_id: '' };
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

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <Label>Gatilhos de ativação (avançado)</Label>
      </div>
      <p className="text-xs text-muted-foreground mt-1 mb-2">
        A IA ativa quando QUALQUER gatilho bater (além da palavra-chave acima). Sem nenhum gatilho = atende todo lead do canal.
      </p>

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
              <Input className="flex-1 min-w-40" placeholder="palavra (ex: fluxoimob)" value={t.value ?? ''}
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

function KnowledgeTab({ agent, onCountChange }: { agent: SalesAgent; onCountChange: () => void }) {
  const [docs, setDocs] = useState<SalesAgentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      await salesAgentsService.uploadFileDocument(agent.id, file);
      toast.success('Arquivo enviado. Extraindo texto...');
      await load(); onCountChange();
    } catch {
      toast.error('Erro no upload');
    } finally {
      setBusy(false);
    }
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
      <p className="text-sm text-muted-foreground">
        Suba a tabela de imóveis, condições, FAQ e argumentário. A IA responde <strong>só</strong> com base nisto — não inventa preço nem imóvel.
      </p>

      <div className="border border-sidebar-border rounded-md p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" /> Colar texto</div>
        <Input placeholder="Título (ex: Tabela de imóveis)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={4} placeholder="Cole aqui o texto do conhecimento..." value={text} onChange={(e) => setText(e.target.value)} />
        <Button size="sm" onClick={addText} disabled={busy || !text.trim()}>Adicionar</Button>
      </div>

      <div className="border border-sidebar-border rounded-md p-4">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <Upload className="h-4 w-4" /> Enviar arquivo (TXT, CSV, DOCX, XLSX)
          <input
            type="file"
            className="hidden"
            accept=".txt,.md,.csv,.docx,.xlsx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
          />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento ainda.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between border border-sidebar-border rounded-md px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{d.title}</div>
                <div className="text-xs text-muted-foreground">
                  {d.status === 'ready' && `${d.char_count} caracteres`}
                  {d.status === 'pending' && 'Processando...'}
                  {d.status === 'failed' && <span className="text-red-500">Falhou: {d.error_message}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {d.status === 'failed' && (
                  <Button variant="ghost" size="sm" onClick={() => salesAgentsService.reprocessDocument(agent.id, d.id).then(load)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => remove(d)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
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

// ---------------- Test ----------------

function TestTab({ agent }: { agent: SalesAgent }) {
  const [history, setHistory] = useState<TestHistoryItem[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SalesAgentTestResult | null>(null);
  const [propertyCode, setPropertyCode] = useState('');

  const send = async () => {
    if (!message.trim()) return;
    const userMsg = message.trim();
    setMessage('');
    setBusy(true);
    const newHistory: TestHistoryItem[] = [...history, { role: 'user', content: userMsg }];
    setHistory(newHistory);
    try {
      const result = await salesAgentsService.testRun(agent.id, userMsg, history, 'Lead Teste', propertyCode.trim() || undefined);
      setHistory([...newHistory, { role: 'assistant', content: result.reply }]);
      setLast(result);
    } catch {
      toast.error('Erro no teste (verifique se a chave da IA está configurada)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Converse como se fosse o lead. Não envia nada no WhatsApp — é só teste.</p>

      <PropertyLinkBox agent={agent} propertyCode={propertyCode} onCodeChange={setPropertyCode} />

      <div className="border border-sidebar-border rounded-md p-3 h-72 overflow-auto space-y-2 bg-muted/20">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Mande uma mensagem pra ver a IA responder.</p>
        ) : (
          history.map((h, i) => (
            <div key={i} className={`flex ${h.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${h.role === 'user' ? 'bg-background border' : 'bg-primary/10 text-foreground'}`}>
                {h.content}
              </div>
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
    </div>
  );
}
