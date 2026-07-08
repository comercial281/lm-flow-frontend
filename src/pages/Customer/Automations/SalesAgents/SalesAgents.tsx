import { useEffect, useState, useCallback } from 'react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Bot, Plus, Trash2, Send, FileText, Upload, RefreshCw, Loader2 } from 'lucide-react';
import {
  salesAgentsService,
  type SalesAgent,
  type SalesAgentDocument,
  type SalesAgentMode,
  type SalesAgentTestResult,
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
        temperature: patch.temperature ?? selected.temperature,
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

      {saving && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</p>}
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

// ---------------- Test ----------------

function TestTab({ agent }: { agent: SalesAgent }) {
  const [history, setHistory] = useState<TestHistoryItem[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SalesAgentTestResult | null>(null);

  const send = async () => {
    if (!message.trim()) return;
    const userMsg = message.trim();
    setMessage('');
    setBusy(true);
    const newHistory: TestHistoryItem[] = [...history, { role: 'user', content: userMsg }];
    setHistory(newHistory);
    try {
      const result = await salesAgentsService.testRun(agent.id, userMsg, history, 'Lead Teste');
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
