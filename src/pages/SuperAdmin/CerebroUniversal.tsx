import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { BookOpen, GraduationCap, Trash2, Upload, Plus, Power } from 'lucide-react';
import {
  globalBrainService,
  KIND_LABELS,
  type GlobalKnowledgeDoc,
  type GlobalLesson,
} from '@/services/superAdmin/globalBrainService';

type Tab = 'conhecimento' | 'escola';

/**
 * Cérebro Universal SDR (Épico A) — Área do Admin.
 *
 * A base de conhecimento e as lições aqui são GLOBAIS: injetadas no prompt de TODO
 * agente de IA de pré-atendimento de todos os clientes. É o que faz um cliente novo
 * nascer educado, sem aprender do zero. Cada agente ainda complementa com a própria
 * base/lições individuais (que prevalecem no conflito).
 */
export default function CerebroUniversal() {
  const [tab, setTab] = useState<Tab>('conhecimento');

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Cérebro Universal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conhecimento e lições que todo agente de IA herda. Vale pra todos os clientes; cada agente refina com o que é dele.
        </p>
      </header>

      <div className="mb-5 flex gap-1 border-b border-border">
        <TabButton active={tab === 'conhecimento'} onClick={() => setTab('conhecimento')} icon={BookOpen}>
          Base de Conhecimento
        </TabButton>
        <TabButton active={tab === 'escola'} onClick={() => setTab('escola')} icon={GraduationCap}>
          Escola de Vendas
        </TabButton>
      </div>

      {tab === 'conhecimento' ? <KnowledgeTab /> : <LessonsTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BookOpen;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${
        active
          ? 'border-primary text-primary font-medium'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

// ─────────────────────────── Base de Conhecimento ───────────────────────────

function KnowledgeTab() {
  const [docs, setDocs] = useState<GlobalKnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await globalBrainService.listDocs());
    } catch {
      toast.error('Não consegui carregar a base de conhecimento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addText = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Preencha título e conteúdo.');
      return;
    }
    setSaving(true);
    try {
      await globalBrainService.createTextDoc({ title: title.trim(), content_text: content.trim(), category: category.trim() || undefined });
      setTitle('');
      setContent('');
      setCategory('');
      toast.success('Adicionado ao cérebro universal.');
      await load();
    } catch {
      toast.error('Não consegui salvar.');
    } finally {
      setSaving(false);
    }
  };

  const addFile = async (file: File) => {
    setSaving(true);
    try {
      await globalBrainService.createFileDoc({ title: title.trim() || file.name, category: category.trim() || undefined, file });
      setTitle('');
      setCategory('');
      toast.success('Arquivo enviado. Texto extraído.');
      await load();
    } catch {
      toast.error('Não consegui subir o arquivo. Aceita TXT, CSV, MD, DOCX ou XLSX.');
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggle = async (doc: GlobalKnowledgeDoc) => {
    try {
      await globalBrainService.updateDoc(doc.id, { enabled: !doc.enabled });
      setDocs(prev => prev.map(d => (d.id === doc.id ? { ...d, enabled: !d.enabled } : d)));
    } catch {
      toast.error('Não consegui atualizar.');
    }
  };

  const remove = async (doc: GlobalKnowledgeDoc) => {
    if (!confirm(`Remover "${doc.title}" do cérebro universal?`)) return;
    try {
      await globalBrainService.deleteDoc(doc.id);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      toast.success('Removido.');
    } catch {
      toast.error('Não consegui remover.');
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
      {/* Formulário */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Adicionar conhecimento</h2>
        <div className="space-y-3">
          <div>
            <Label htmlFor="k-title">Título</Label>
            <Input id="k-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Argumentário de valorização" />
          </div>
          <div>
            <Label htmlFor="k-cat">Categoria (opcional)</Label>
            <Input id="k-cat" value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: objeções, processo, vendas" />
          </div>
          <div>
            <Label htmlFor="k-content">Conteúdo (cole o texto)</Label>
            <Textarea id="k-content" value={content} onChange={e => setContent(e.target.value)} rows={6} placeholder="Diretrizes de vendas, como operar, objetivo do agente..." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={addText} disabled={saving}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar texto
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.csv,.docx,.xlsx"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) void addFile(f);
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={saving}>
              <Upload className="mr-1 h-4 w-4" /> Subir arquivo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Arquivo: TXT, CSV, MD, DOCX ou XLSX. Para PDF, cole o texto.</p>
        </div>
      </div>

      {/* Lista */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Na base ({docs.length})</h2>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : docs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nada ainda. Adicione as diretrizes que todo agente deve seguir.
          </p>
        ) : (
          <ul className="space-y-2">
            {docs.map(doc => (
              <li key={doc.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{doc.title}</span>
                      {doc.category && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{doc.category}</span>
                      )}
                      {!doc.enabled && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">desativado</span>}
                      {doc.status === 'failed' && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-700 dark:bg-red-900/30 dark:text-red-400">falhou</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {doc.content_text || doc.error_message || (doc.has_file ? doc.filename : '')}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{doc.char_count.toLocaleString('pt-BR')} caracteres</p>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <button onClick={() => toggle(doc)} title={doc.enabled ? 'Desativar' : 'Ativar'} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <Power className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(doc)} title="Remover" className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Escola de Vendas ───────────────────────────

function LessonsTab() {
  const [lessons, setLessons] = useState<GlobalLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<GlobalLesson['kind']>('rule');
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLessons(await globalBrainService.listLessons());
    } catch {
      toast.error('Não consegui carregar as lições.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!content.trim()) {
      toast.error('Escreva a lição.');
      return;
    }
    setSaving(true);
    try {
      await globalBrainService.createLesson({ kind, content: content.trim(), context: context.trim() || undefined });
      setContent('');
      setContext('');
      toast.success('Lição adicionada ao cérebro universal.');
      await load();
    } catch {
      toast.error('Não consegui salvar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (l: GlobalLesson) => {
    if (!confirm('Remover esta lição do cérebro universal?')) return;
    try {
      await globalBrainService.deleteLesson(l.id);
      setLessons(prev => prev.filter(x => x.id !== l.id));
      toast.success('Removida.');
    } catch {
      toast.error('Não consegui remover.');
    }
  };

  const needsContext = kind !== 'rule';

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Ensinar a IA</h2>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <div className="mt-1 flex gap-1">
              {(['rule', 'good_example', 'bad_example'] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    kind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          {needsContext && (
            <div>
              <Label htmlFor="l-ctx">O que o lead disse (opcional)</Label>
              <Input id="l-ctx" value={context} onChange={e => setContext(e.target.value)} placeholder="Ex: tá caro" />
            </div>
          )}
          <div>
            <Label htmlFor="l-content">
              {kind === 'rule' ? 'A regra que ela deve seguir' : kind === 'good_example' ? 'A resposta boa (ela imita)' : 'A resposta ruim (ela evita)'}
            </Label>
            <Textarea id="l-content" value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder={kind === 'rule' ? 'Ex: Sempre proponha a visita como próximo passo sem compromisso.' : 'Escreva a resposta...'} />
          </div>
          <Button onClick={add} disabled={saving}>
            <Plus className="mr-1 h-4 w-4" /> Ensinar
          </Button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">Lições ({lessons.length})</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : lessons.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma lição universal ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {lessons.map(l => (
              <li key={l.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${
                      l.kind === 'rule' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : l.kind === 'good_example' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {KIND_LABELS[l.kind]}
                    </span>
                    {l.context && <p className="mt-1 text-xs text-muted-foreground">Lead: {l.context}</p>}
                    <p className="mt-1 text-sm text-foreground">{l.content}</p>
                  </div>
                  <button onClick={() => remove(l)} title="Remover" className="flex-shrink-0 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
