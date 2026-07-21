import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Label } from '@/components/ui/ds';
import { toast } from 'sonner';
import { FileText, Plus, Trash2, Copy, Link2, Files, Archive, Eye, X, ArrowUp, ArrowDown, Pencil, Download } from 'lucide-react';
import {
  onboardingFormsService,
  FIELD_TYPES,
  type OnboardingForm,
  type OnboardingField,
  type OnboardingSubmission,
} from '@/services/superAdmin/onboardingFormsService';

/**
 * Épico E — Formulários (onboarding universal) na Área do Admin.
 *
 * O Giovani monta um formulário, gera um LINK PÚBLICO e envia ao cliente. O cliente
 * responde sem login e a resposta cai aqui. Estende o dynamic_forms; os forms de
 * onboarding vivem no schema public (super-admin).
 */
export default function OnboardingForms() {
  const [forms, setForms] = useState<OnboardingForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setForms(await onboardingFormsService.list());
    } catch {
      toast.error('Não consegui carregar os formulários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!creating.trim()) return;
    try {
      const f = await onboardingFormsService.create({ name: creating.trim() });
      setCreating('');
      await load();
      setSelectedId(f.id);
      toast.success('Formulário criado.');
    } catch {
      toast.error('Não consegui criar.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Formulários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monte um formulário, gere o link público e envie ao cliente. As respostas caem aqui.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        {/* Lista + criar */}
        <div>
          <div className="mb-3 flex gap-2">
            <Input value={creating} onChange={e => setCreating(e.target.value)} placeholder="Nome do formulário" onKeyDown={e => e.key === 'Enter' && create()} />
            <Button onClick={create}><Plus className="h-4 w-4" /></Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : forms.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nenhum formulário ainda.</p>
          ) : (
            <ul className="space-y-1">
              {forms.map(f => (
                <li key={f.id}>
                  <button
                    onClick={() => setSelectedId(f.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === f.id ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-[11px] text-muted-foreground">{f.submissions_count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor */}
        <div>
          {selectedId ? (
            <FormEditor key={selectedId} formId={selectedId} onChanged={load} onDeleted={() => { setSelectedId(null); void load(); }} />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Selecione um formulário ou crie um novo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FormEditor({ formId, onChanged, onDeleted }: { formId: string; onChanged: () => void; onDeleted: () => void }) {
  const [form, setForm] = useState<OnboardingForm | null>(null);
  const [tab, setTab] = useState<'campos' | 'respostas'>('campos');
  const [subs, setSubs] = useState<OnboardingSubmission[]>([]);

  // novo campo / edição de campo
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fLabel, setFLabel] = useState('');
  const [fType, setFType] = useState('text');
  const [fRequired, setFRequired] = useState(false);
  const [fOptions, setFOptions] = useState('');
  // condicional: mostrar só se
  const [cField, setCField] = useState('');
  const [cOp, setCOp] = useState<'eq' | 'neq' | 'filled'>('eq');
  const [cValue, setCValue] = useState('');

  const resetFieldForm = () => {
    setEditingId(null); setFLabel(''); setFType('text'); setFRequired(false); setFOptions('');
    setCField(''); setCOp('eq'); setCValue('');
  };

  const editField = (field: OnboardingField) => {
    setEditingId(field.id);
    setFLabel(field.label);
    setFType(field.field_type);
    setFRequired(field.required);
    setFOptions((field.options ?? []).join(', '));
    const c = (field.conditional ?? {}) as { field?: string; op?: string; value?: string };
    setCField(c.field ?? '');
    setCOp((c.op as 'eq' | 'neq' | 'filled') ?? 'eq');
    setCValue(c.value ?? '');
  };

  const reload = useCallback(async () => {
    setForm(await onboardingFormsService.get(formId));
  }, [formId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadSubs = async () => {
    try {
      setSubs(await onboardingFormsService.submissions(formId));
    } catch {
      toast.error('Não consegui carregar as respostas.');
    }
  };

  const slugify = (s: string) =>
    s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || `campo_${Date.now()}`;

  const conditionalPayload = () =>
    cField ? { field: cField, op: cOp, ...(cOp !== 'filled' ? { value: cValue } : {}) } : {};

  const saveField = async () => {
    if (!fLabel.trim()) {
      toast.error('Dê um rótulo ao campo.');
      return;
    }
    const needsOptions = fType === 'select' || fType === 'multiselect' || fType === 'checkbox';
    const payload = {
      label: fLabel.trim(), field_type: fType, required: fRequired,
      options: needsOptions ? fOptions.split(',').map(o => o.trim()).filter(Boolean) : [],
      conditional: conditionalPayload(),
    };
    try {
      if (editingId) {
        await onboardingFormsService.updateField(formId, editingId, payload);
      } else {
        await onboardingFormsService.addField(formId, { ...payload, name: slugify(fLabel) });
      }
      resetFieldForm();
      await reload();
      onChanged();
    } catch {
      toast.error('Não consegui salvar o campo (rótulo duplicado?).');
    }
  };

  const duplicateField = async (field: OnboardingField) => {
    try {
      await onboardingFormsService.addField(formId, {
        name: slugify(`${field.label} copia ${Date.now()}`),
        label: `${field.label} (cópia)`, field_type: field.field_type,
        required: field.required, options: field.options ?? [],
        conditional: field.conditional ?? {},
      });
      await reload();
      onChanged();
    } catch {
      toast.error('Não consegui duplicar o campo.');
    }
  };

  const moveField = async (field: OnboardingField, dir: -1 | 1) => {
    const list = [...(form?.fields ?? [])].sort((a, b) => a.position - b.position);
    const idx = list.findIndex(f => f.id === field.id);
    const swapWith = list[idx + dir];
    if (!swapWith) return;
    try {
      await Promise.all([
        onboardingFormsService.updateField(formId, field.id, { position: swapWith.position }),
        onboardingFormsService.updateField(formId, swapWith.id, { position: field.position }),
      ]);
      await reload();
    } catch {
      toast.error('Não consegui mover.');
    }
  };

  const removeField = async (field: OnboardingField) => {
    try {
      await onboardingFormsService.removeField(formId, field.id);
      if (editingId === field.id) resetFieldForm();
      await reload();
      onChanged();
    } catch {
      toast.error('Não consegui remover.');
    }
  };

  const copyLink = async () => {
    try {
      const { public_url } = await onboardingFormsService.generateLink(formId);
      await navigator.clipboard.writeText(public_url);
      toast.success('Link público copiado.');
      await reload();
    } catch {
      toast.error('Não consegui gerar o link.');
    }
  };

  const duplicate = async () => {
    try {
      await onboardingFormsService.duplicate(formId);
      toast.success('Formulário duplicado.');
      onChanged();
    } catch {
      toast.error('Não consegui duplicar.');
    }
  };

  const archive = async () => {
    if (!confirm('Arquivar este formulário?')) return;
    try {
      await onboardingFormsService.archive(formId);
      toast.success('Arquivado.');
      onDeleted();
    } catch {
      toast.error('Não consegui arquivar.');
    }
  };

  const remove = async () => {
    if (!confirm('Excluir de vez este formulário e todas as respostas?')) return;
    try {
      await onboardingFormsService.remove(formId);
      toast.success('Excluído.');
      onDeleted();
    } catch {
      toast.error('Não consegui excluir.');
    }
  };

  const downloadJson = () => {
    if (!form) return;
    const blob = new Blob([JSON.stringify(form, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.slug || 'formulario'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!form) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const needsOptions = fType === 'select' || fType === 'multiselect' || fType === 'checkbox';

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">{form.name}</h2>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" onClick={copyLink}><Link2 className="mr-1 h-3.5 w-3.5" /> Link público</Button>
          <Button variant="outline" size="sm" onClick={duplicate}><Files className="mr-1 h-3.5 w-3.5" /> Duplicar</Button>
          <Button variant="outline" size="sm" onClick={downloadJson}><Copy className="mr-1 h-3.5 w-3.5" /> JSON</Button>
          <Button variant="outline" size="sm" onClick={archive}><Archive className="mr-1 h-3.5 w-3.5" /> Arquivar</Button>
          <Button variant="outline" size="sm" onClick={remove}><Trash2 className="mr-1 h-3.5 w-3.5 text-red-600" /></Button>
        </div>
      </div>

      {form.public_url && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          <span className="truncate">{form.public_url}</span>
        </div>
      )}

      <div className="flex gap-1 border-b border-border px-4">
        <TabBtn active={tab === 'campos'} onClick={() => setTab('campos')}>Campos ({form.field_count})</TabBtn>
        <TabBtn active={tab === 'respostas'} onClick={() => { setTab('respostas'); void loadSubs(); }}>
          <Eye className="mr-1 inline h-3.5 w-3.5" />Respostas ({form.submissions_count})
        </TabBtn>
      </div>

      {tab === 'campos' ? (
        <div className="p-4">
          <ul className="mb-4 space-y-2">
            {(form.fields ?? []).map((field, i, arr) => {
              const cond = (field.conditional ?? {}) as { field?: string };
              return (
                <li key={field.id} className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 ${editingId === field.id ? 'border-primary' : 'border-border'}`}>
                  <div className="min-w-0">
                    <span className="text-sm text-foreground">{field.label}</span>
                    {field.required && <span className="ml-1 text-red-500">*</span>}
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {FIELD_TYPES.find(t => t.value === field.field_type)?.label ?? field.field_type}
                    </span>
                    {field.options && field.options.length > 0 && (
                      <span className="ml-2 text-[11px] text-muted-foreground">{field.options.join(', ')}</span>
                    )}
                    {cond.field && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">condicional</span>}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-0.5">
                    <button onClick={() => moveField(field, -1)} disabled={i === 0} title="Subir" className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button onClick={() => moveField(field, 1)} disabled={i === arr.length - 1} title="Descer" className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button onClick={() => editField(field)} title="Editar" className="rounded p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => duplicateField(field)} title="Duplicar" className="rounded p-1 text-muted-foreground hover:text-foreground"><Files className="h-4 w-4" /></button>
                    <button onClick={() => removeField(field)} title="Remover" className="rounded p-1 text-muted-foreground hover:text-red-600"><X className="h-4 w-4" /></button>
                  </div>
                </li>
              );
            })}
            {(form.fields ?? []).length === 0 && <li className="text-sm text-muted-foreground">Nenhum campo ainda.</li>}
          </ul>

          <div className="space-y-3 rounded-md border border-dashed border-border p-3">
            <h3 className="text-xs font-medium text-foreground">{editingId ? 'Editar campo' : 'Novo campo'}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="f-label">Rótulo (o que o cliente vê)</Label>
                <Input id="f-label" value={fLabel} onChange={e => setFLabel(e.target.value)} placeholder="Ex: Nome da imobiliária" />
              </div>
              <div>
                <Label htmlFor="f-type">Tipo</Label>
                <select id="f-type" value={fType} onChange={e => setFType(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            {needsOptions && (
              <div>
                <Label htmlFor="f-opts">Opções (separadas por vírgula)</Label>
                <Input id="f-opts" value={fOptions} onChange={e => setFOptions(e.target.value)} placeholder="Lançamento, Usado, Locação" />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={fRequired} onChange={e => setFRequired(e.target.checked)} /> Obrigatório
            </label>

            {/* Lógica condicional */}
            <div className="rounded-md bg-muted/40 p-2">
              <Label className="text-xs">Mostrar só se (opcional)</Label>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <select value={cField} onChange={e => setCField(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                  <option value="">sempre mostrar</option>
                  {(form.fields ?? []).filter(f => f.id !== editingId).map(f => <option key={f.id} value={f.name}>{f.label}</option>)}
                </select>
                {cField && (
                  <>
                    <select value={cOp} onChange={e => setCOp(e.target.value as 'eq' | 'neq' | 'filled')} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                      <option value="eq">for igual a</option>
                      <option value="neq">for diferente de</option>
                      <option value="filled">estiver preenchido</option>
                    </select>
                    {cOp !== 'filled' && <Input value={cValue} onChange={e => setCValue(e.target.value)} placeholder="valor" className="h-8 w-32 text-xs" />}
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={saveField}><Plus className="mr-1 h-4 w-4" /> {editingId ? 'Salvar campo' : 'Adicionar campo'}</Button>
              {editingId && <Button size="sm" variant="outline" onClick={resetFieldForm}>Cancelar</Button>}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma resposta ainda.</p>
          ) : (
            <ul className="space-y-2">
              {subs.map(s => (
                <li key={s.id} className="rounded-md border border-border p-3">
                  <p className="mb-1 text-[11px] text-muted-foreground">{new Date(s.created_at).toLocaleString('pt-BR')}</p>
                  <dl className="grid gap-1 text-sm">
                    {Object.entries(s.data).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="text-muted-foreground">{k}:</dt>
                        <dd className="text-foreground">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                  {s.attachments && s.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.attachments.map((a, idx) => (
                        a.url ? (
                          <a key={idx} href={`${import.meta.env.VITE_API_URL}${a.url}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs text-primary hover:underline">
                            <Download className="h-3 w-3" /> {a.filename}
                          </a>
                        ) : <span key={idx} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{a.filename}</span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`border-b-2 px-3 py-2.5 text-sm transition-colors ${active ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
      {children}
    </button>
  );
}
