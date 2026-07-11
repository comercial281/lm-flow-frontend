import { useEffect, useState, useCallback } from 'react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Bot, Plus, Trash2, Send, FileText, Upload, RefreshCw, Loader2, Link2, Copy, Check, SlidersHorizontal } from 'lucide-react';
import {
  salesAgentsService,
  type SalesAgent,
  type SalesAgentDocument,
  type SalesAgentMode,
  type ActiveHours,
  type ActiveHoursMode,
  type SalesAgentTestResult,
  type SalesAgentPropertyLink,
  type TestHistoryItem,
} from '@/services/salesAgents/salesAgentsService';
import inboxesService from '@/services/channels/inboxesService';

type Tab = 'config' | 'knowledge' | 'test';

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
        model: patch.model ?? selected.model,
        temperature: patch.temperature ?? selected.temperature,
        max_context_tokens: patch.max_context_tokens ?? selected.max_context_tokens,
        active_hours: patch.active_hours ?? selected.active_hours,
        followup_enabled: patch.followup_enabled ?? selected.followup_enabled,
        followup_only: patch.followup_only ?? selected.followup_only,
        followup_min_days: patch.followup_min_days ?? selected.followup_min_days,
        followup_max_days: patch.followup_max_days ?? selected.followup_max_days,
        followup_max_attempts: patch.followup_max_attempts ?? selected.followup_max_attempts,
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
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" /> IA Vendedora
          </h2>
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
              {([['config', 'Configuração'], ['knowledge', 'Base de Conhecimento'], ['test', 'Testar']] as [Tab, string][]).map(
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
            {tab === 'test' && <TestTab agent={selected} />}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------- Config ----------------

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

  return (
    <div className="space-y-5">
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
        <Label htmlFor="inbox">WhatsApp que ela atende</Label>
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
        <p className="text-xs text-muted-foreground mt-1">A IA só responde os leads que chegam por esse canal.</p>
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

      <ScheduleSection agent={agent} onSave={onSave} />
      <FollowupSection agent={agent} onChange={onChange} onSave={onSave} />
      <AdvancedSection agent={agent} onChange={onChange} onSave={onSave} />

      {saving && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</p>}
    </div>
  );
}

// ---------------- Horário de atuação ----------------

const SCHEDULE_OPTIONS: [ActiveHoursMode, string, string][] = [
  ['always', 'Sempre (24 horas)', 'A IA responde a qualquer hora.'],
  ['outside_business', 'Fora do horário comercial (18h às 07h)', 'Só responde à noite/madrugada — quando não tem ninguém no time.'],
  ['custom', 'Horário personalizado', 'Você escolhe a janela em que ela responde.'],
];

function ScheduleSection({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const hours: ActiveHours = agent.active_hours ?? {};
  const mode: ActiveHoursMode = hours.mode ?? 'always';
  const win = hours.windows?.[0] ?? { start: '08:00', end: '18:00' };

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
      <Label>Horário de atuação</Label>
      <div className="grid grid-cols-1 gap-2 mt-1">
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
      {mode === 'custom' && (
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
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" className="mt-1" checked={on} onChange={(e) => onSave({ followup_enabled: e.target.checked })} />
        <div>
          <div className="text-sm font-medium">Follow-up automático</div>
          <div className="text-xs text-muted-foreground">
            Se o lead sumir, a IA volta sozinha com uma mensagem personalizada (baseada em toda a conversa e no imóvel), na cadência que você definir. Infinito por padrão.
          </div>
        </div>
      </label>

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

// ---------------- Knowledge ----------------

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
