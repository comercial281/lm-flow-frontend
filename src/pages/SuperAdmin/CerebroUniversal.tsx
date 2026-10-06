import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Plus, Trash2, Upload } from 'lucide-react';
import Chave from '@/components/base/Chave';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import {
  globalBrainService,
  KIND_LABELS,
  type GlobalKnowledgeDoc,
  type GlobalLesson,
} from '@/services/superAdmin/globalBrainService';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { CORPO_SECAO, ESQUELETO, SECAO, SELO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';

type Estado = 'carregando' | 'pronto' | 'erro';

/**
 * Cérebro Universal SDR (Épico A) — Área do Admin → IA Vendedora → Conhecimento.
 *
 * A base de conhecimento e as lições aqui são GLOBAIS: injetadas no prompt de TODO
 * agente de IA de pré-atendimento de todos os clientes. É o que faz um cliente novo
 * nascer educado, sem aprender do zero. Cada agente ainda complementa com a própria
 * base/lições individuais (que prevalecem no conflito).
 *
 * Eram duas sub-abas feitas à mão; desde 06/10/2026 são duas seções da página
 * Conhecimento (Base de conhecimento · Escola de vendas).
 */

const COR_DO_TIPO: Record<GlobalLesson['kind'], string> = {
  rule: 'border-primary/30 bg-primary/10 text-primary',
  good_example: 'bg-muted text-foreground',
  bad_example: 'border-destructive/40 text-destructive',
};

// ─────────────────────────── Base de conhecimento ───────────────────────────

export function BaseDeConhecimento() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [docs, setDocs] = useState<GlobalKnowledgeDoc[]>([]);
  const [estado, setEstado] = useState<Estado>('carregando');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const confirmarParaTodos = (titulo: string, descricao: ReactNode, rotuloDaAcao: string) =>
    confirmar({ titulo, descricao: <>{descricao} Vale para as IAs de todos os clientes.</>, rotuloDaAcao });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setEstado('carregando');
    try {
      setDocs(await globalBrainService.listDocs());
      setEstado('pronto');
    } catch {
      setEstado('erro');
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
    if (!(await confirmarParaTodos('Adicionar à base de conhecimento?', 'Este texto entra no conhecimento das IAs de todos os clientes.', 'Adicionar para todos'))) return;
    setSaving(true);
    try {
      await globalBrainService.createTextDoc({ title: title.trim(), content_text: content.trim(), category: category.trim() || undefined });
      setTitle('');
      setContent('');
      setCategory('');
      toast.success('Adicionado à base de conhecimento.');
      await load();
    } catch {
      toast.error('Não consegui salvar.');
    } finally {
      setSaving(false);
    }
  };

  const addFile = async (file: File) => {
    if (!(await confirmarParaTodos('Subir para a base de conhecimento?', 'Este arquivo entra no conhecimento das IAs de todos os clientes.', 'Subir para todos'))) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
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

  // Chave: vira na hora, volta sozinha se o servidor recusar e avisa.
  // Desligar tira o documento das IAs de todos os clientes: confirma. Ligar não.
  const alternar = async (doc: GlobalKnowledgeDoc, ligar: boolean) => {
    if (!ligar && !(await confirmarParaTodos('Desligar este documento?', <>O documento <strong>{doc.title}</strong> deixa de valer para as IAs de todos os clientes.</>, 'Desligar'))) return false;
    await globalBrainService.updateDoc(doc.id, { enabled: ligar });
    setDocs(prev => prev.map(d => (d.id === doc.id ? { ...d, enabled: ligar } : d)));
  };

  const remove = async (doc: GlobalKnowledgeDoc) => {
    if (
      !(await confirmar({
        titulo: 'Remover da base de conhecimento?',
        descricao: <>O documento <strong>{doc.title}</strong> sai do conhecimento das IAs de todos os clientes.</>,
        rotuloDaAcao: 'Remover',
        destrutivo: true,
      }))
    )
      return;
    try {
      await globalBrainService.deleteDoc(doc.id);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      toast.success('Removido.');
    } catch {
      toast.error('Não consegui remover.');
    }
  };

  return (
    <section aria-labelledby="base-de-conhecimento" className={SECAO}>
      <h2 id="base-de-conhecimento" className={TITULO_SECAO}>Base de conhecimento</h2>
      <p className={SUBTITULO_SECAO}>
        Documentos que toda IA de todos os clientes herda. Cada IA ainda complementa com a base dela, que prevalece no conflito.
      </p>
      <div className={`${CORPO_SECAO} grid gap-6 md:grid-cols-[1fr_1.1fr]`}>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-foreground">Adicionar conhecimento</h3>
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
            <Textarea id="k-content" value={content} onChange={e => setContent(e.target.value)} rows={6} placeholder="Diretrizes de vendas, como operar, objetivo da IA..." />
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
              aria-label="Arquivo para a base de conhecimento"
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

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">Na base {estado === 'pronto' ? `(${docs.length})` : ''}</h3>
          {estado === 'carregando' && <div aria-busy="true" className={`h-24 ${ESQUELETO}`} />}
          {estado === 'erro' && (
            <EmptyState tipo="erro" title="Não deu pra carregar a base de conhecimento" aoTentarDeNovo={() => void load()} />
          )}
          {estado === 'pronto' && docs.length === 0 && (
            <EmptyState title="Nada na base ainda" description="Adicione as diretrizes que toda IA deve seguir." />
          )}
          {estado === 'pronto' && docs.length > 0 && (
            <ul className="flex flex-col gap-2">
              {docs.map(doc => (
                <li key={doc.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{doc.title}</span>
                        {doc.category && <span className={`${SELO} text-muted-foreground`}>{doc.category}</span>}
                        {doc.status === 'failed' && <span className={`${SELO} border-destructive/40 text-destructive`}>falhou</span>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {doc.content_text || doc.error_message || (doc.has_file ? doc.filename : '')}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{doc.char_count.toLocaleString('pt-BR')} caracteres</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <Chave
                        rotulo={`Usar ${doc.title} nas IAs`}
                        semRotuloVisivel
                        ligada={doc.enabled}
                        aoMudar={v => alternar(doc, v)}
                      />
                      <button
                        type="button"
                        onClick={() => void remove(doc)}
                        aria-label={`Remover ${doc.title}`}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {dialogoDeConfirmacao}
    </section>
  );
}

// ─────────────────────────── Escola de vendas ───────────────────────────

export function EscolaDeVendas() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [lessons, setLessons] = useState<GlobalLesson[]>([]);
  const [estado, setEstado] = useState<Estado>('carregando');
  const [kind, setKind] = useState<GlobalLesson['kind']>('rule');
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setEstado('carregando');
    try {
      setLessons(await globalBrainService.listLessons());
      setEstado('pronto');
    } catch {
      setEstado('erro');
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
    if (!(await confirmar({ titulo: 'Ensinar para todas as IAs?', descricao: 'Esta lição passa a valer para todas as IAs de todos os clientes.', rotuloDaAcao: 'Ensinar para todos' }))) return;
    setSaving(true);
    try {
      await globalBrainService.createLesson({ kind, content: content.trim(), context: context.trim() || undefined });
      setContent('');
      setContext('');
      toast.success('Lição adicionada à escola de vendas.');
      await load();
    } catch {
      toast.error('Não consegui salvar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (l: GlobalLesson) => {
    if (
      !(await confirmar({
        titulo: 'Remover esta lição?',
        descricao: 'Ela sai da escola de vendas das IAs de todos os clientes.',
        rotuloDaAcao: 'Remover',
        destrutivo: true,
      }))
    )
      return;
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
    <section aria-labelledby="escola-de-vendas" className={SECAO}>
      <h2 id="escola-de-vendas" className={TITULO_SECAO}>Escola de vendas</h2>
      <p className={SUBTITULO_SECAO}>Regras e exemplos que toda IA de todos os clientes segue.</p>
      <div className={`${CORPO_SECAO} grid gap-6 md:grid-cols-[1fr_1.1fr]`}>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-foreground">Ensinar a IA</h3>
          <div>
            <Label htmlFor="l-kind">Tipo</Label>
            <Seletor id="l-kind" aria-label="Tipo da lição" value={kind} onChange={e => setKind(e.target.value as GlobalLesson['kind'])} className="mt-1 w-full">
              {(['rule', 'good_example', 'bad_example'] as const).map(k => (
                <option key={k} value={k}>{KIND_LABELS[k]}</option>
              ))}
            </Seletor>
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
          <Button onClick={add} disabled={saving} className="w-fit">
            <Plus className="mr-1 h-4 w-4" /> Ensinar
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">Lições {estado === 'pronto' ? `(${lessons.length})` : ''}</h3>
          {estado === 'carregando' && <div aria-busy="true" className={`h-24 ${ESQUELETO}`} />}
          {estado === 'erro' && <EmptyState tipo="erro" title="Não deu pra carregar as lições" aoTentarDeNovo={() => void load()} />}
          {estado === 'pronto' && lessons.length === 0 && (
            <EmptyState title="Nenhuma lição universal ainda" description="Ensine uma regra ou um exemplo e todas as IAs passam a seguir." />
          )}
          {estado === 'pronto' && lessons.length > 0 && (
            <ul className="flex flex-col gap-2">
              {lessons.map(l => (
                <li key={l.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className={`${SELO} ${COR_DO_TIPO[l.kind]}`}>{KIND_LABELS[l.kind]}</span>
                      {l.context && <p className="mt-1 text-xs text-muted-foreground">Lead: {l.context}</p>}
                      <p className="mt-1 text-sm text-foreground">{l.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(l)}
                      aria-label="Remover lição"
                      className="flex-shrink-0 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {dialogoDeConfirmacao}
    </section>
  );
}
