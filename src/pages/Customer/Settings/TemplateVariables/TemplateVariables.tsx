import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label as UILabel,
  Textarea,
} from '@/components/ui/ds';
import { Code, Lock, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { tenantTemplateVariablesService } from '@/services/messageFunnels/messageFunnelsService';
import type { TemplateVariable, TenantTemplateVariable } from '@/types/messageFunnels';

// ── Presets de value_source pro UI guiado ────────────────────────────────────

interface SourcePreset {
  key: string;
  label: string;
  description: string;
  template: string;           // base de value_source ("contact.email", "literal:")
  needsExtra: 'attr' | 'literal' | null;  // input adicional do usuário
}

const SOURCE_PRESETS: SourcePreset[] = [
  {
    key: 'contact_email',
    label: 'E-mail do contato',
    description: 'Lê do campo email do lead',
    template: 'contact.email',
    needsExtra: null,
  },
  {
    key: 'contact_phone',
    label: 'Telefone do contato',
    description: 'Lê do campo phone_number do lead (formato E.164)',
    template: 'contact.phone_number',
    needsExtra: null,
  },
  {
    key: 'contact_name',
    label: 'Nome completo do contato',
    description: 'Nome inteiro (use o built-in {{nome}} pra primeiro nome)',
    template: 'contact.name',
    needsExtra: null,
  },
  {
    key: 'contact_custom_attr',
    label: 'Atributo customizado do contato',
    description: 'Lê de contact.custom_attributes.<chave> que você definiu',
    template: 'contact.custom_attributes.',
    needsExtra: 'attr',
  },
  {
    key: 'literal',
    label: 'Valor fixo (texto)',
    description: 'Sempre devolve o mesmo texto, independente do lead',
    template: 'literal:',
    needsExtra: 'literal',
  },
];

// ── State ────────────────────────────────────────────────────────────────────

interface FormState {
  token: string;
  label: string;
  description: string;
  presetKey: string;
  extraValue: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  token: '',
  label: '',
  description: '',
  presetKey: SOURCE_PRESETS[0].key,
  extraValue: '',
  active: true,
};

function buildValueSource(presetKey: string, extra: string): string {
  const preset = SOURCE_PRESETS.find(p => p.key === presetKey) ?? SOURCE_PRESETS[0];
  if (!preset.needsExtra) return preset.template;
  return preset.template + (extra ?? '').trim();
}

function parseValueSource(value: string): { presetKey: string; extra: string } {
  if (value.startsWith('literal:')) {
    return { presetKey: 'literal', extra: value.slice('literal:'.length) };
  }
  if (value.startsWith('contact.custom_attributes.')) {
    return { presetKey: 'contact_custom_attr', extra: value.slice('contact.custom_attributes.'.length) };
  }
  const direct = SOURCE_PRESETS.find(p => p.template === value);
  return { presetKey: direct?.key ?? SOURCE_PRESETS[0].key, extra: '' };
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function TemplateVariables() {
  const [builtin, setBuiltin] = useState<TemplateVariable[]>([]);
  const [custom, setCustom] = useState<TenantTemplateVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TenantTemplateVariable | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<TenantTemplateVariable | null>(null);

  // Quantas nasceram sozinhas de um campo de formulário conectado ao CRM.
  const autoCount = custom.filter(v => v.auto_created).length;

  async function load() {
    setLoading(true);
    try {
      const res = await tenantTemplateVariablesService.list();
      setBuiltin(res.builtin ?? []);
      setCustom(res.custom ?? []);
    } catch (e: unknown) {
      toast.error('Falha ao carregar variáveis');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(v: TenantTemplateVariable) {
    const { presetKey, extra } = parseValueSource(v.value_source);
    setEditing(v);
    setForm({
      token: v.token,
      label: v.label,
      description: v.description ?? '',
      presetKey,
      extraValue: extra,
      active: v.active,
    });
    setModalOpen(true);
  }

  function validateForm(): string | null {
    if (!form.token.trim()) return 'Token é obrigatório';
    if (!/^[a-z][a-z0-9_]{1,62}[a-z0-9]$/.test(form.token)) {
      return 'Token só pode usar a-z, 0-9 e _ (3-64 chars, começa com letra)';
    }
    const builtinHit = builtin.some(b => b.token === form.token);
    if (builtinHit) return `Token "${form.token}" é reservado pelo sistema`;
    if (!form.label.trim()) return 'Label é obrigatório';
    const preset = SOURCE_PRESETS.find(p => p.key === form.presetKey);
    if (!preset) return 'Selecione uma fonte de valor';
    if (preset.needsExtra && !form.extraValue.trim()) {
      return preset.needsExtra === 'attr'
        ? 'Informe a chave do atributo customizado'
        : 'Informe o valor fixo';
    }
    return null;
  }

  async function handleSave() {
    const err = validateForm();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        token: form.token.trim(),
        label: form.label.trim(),
        description: form.description.trim() || undefined,
        value_source: buildValueSource(form.presetKey, form.extraValue),
        active: form.active,
      };
      if (editing) {
        await tenantTemplateVariablesService.update(editing.id, payload);
        toast.success('Variável atualizada');
      } else {
        await tenantTemplateVariablesService.create(payload);
        toast.success('Variável criada');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error?.details?.[0] ??
        e?.response?.data?.error?.message ??
        e?.message ??
        'Falha ao salvar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try {
      await tenantTemplateVariablesService.destroy(toDelete.id);
      toast.success('Variável removida');
      setToDelete(null);
      load();
    } catch {
      toast.error('Falha ao remover');
    }
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Code size={20} className="text-primary" />
            <h1 className="text-2xl font-bold">
              Variáveis de Funis{' '}
              <span className="text-base font-normal text-muted-foreground">
                ({custom.length} customizadas)
              </span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Placeholders que você insere nos funis ({'{{token}}'}) e que viram texto real no
            momento do envio, lido do lead da conversa.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-2" />
          Nova Variável
        </Button>
      </div>

      {/* Built-in section */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Lock size={14} className="text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sistema (built-in, não editável)
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {builtin.map(v => (
            <div
              key={v.token}
              className="border border-border rounded-lg p-3 bg-muted/20"
              title={v.description}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm">{v.label}</span>
                <code className="text-xs text-primary font-mono">{v.placeholder}</code>
              </div>
              {v.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{v.description}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Custom section */}
      <section className="flex-1 min-h-0 overflow-auto">
        <div className="flex items-center gap-2 mb-2">
          <Code size={14} className="text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Customizadas ({custom.length}
            {autoCount > 0 && `, ${autoCount} automática${autoCount > 1 ? 's' : ''}`})
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
            <RefreshCw size={14} className="animate-spin" />
            Carregando...
          </div>
        ) : custom.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Code size={32} className="mx-auto mb-2 text-muted-foreground" />
            <p className="font-semibold mb-1">Nenhuma variável customizada</p>
            <p className="text-sm text-muted-foreground mb-4">
              Crie variáveis específicas do seu tenant pra usar nos funis (ex:
              {' '}<code className="text-xs">{'{{empreendimento_atual}}'}</code>).
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Você também não precisa criar na mão: ao conectar um formulário ao CRM, cada
              campo respondido pelo lead vira uma variável aqui automaticamente.
            </p>
            <Button variant="outline" onClick={openCreate}>
              <Plus size={14} className="mr-2" />
              Criar primeira
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {custom.map(v => (
              <div key={v.id} className="border border-border rounded-lg p-3 hover:bg-muted/20">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{v.label}</span>
                      {v.auto_created && (
                        <span
                          className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded"
                          title="Criada sozinha a partir de um campo de formulário conectado ao CRM"
                        >
                          Automática
                        </span>
                      )}
                      {!v.active && (
                        <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                          Inativa
                        </span>
                      )}
                    </div>
                    <code className="text-xs text-primary font-mono">{v.placeholder}</code>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(v)}
                      aria-label="Editar"
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setToDelete(v)}
                      aria-label="Excluir"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
                {v.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{v.description}</p>
                )}
                <code className="block text-xs font-mono bg-muted/30 px-1.5 py-0.5 rounded text-muted-foreground truncate">
                  {v.value_source}
                </code>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create/edit modal */}
      <Dialog open={modalOpen} onOpenChange={v => !v && setModalOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar variável' : 'Nova variável'}</DialogTitle>
            <DialogDescription>
              Variáveis customizadas viram chips disponíveis no editor de funis e são
              interpoladas no momento do envio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <UILabel htmlFor="var-token">
                Token <span className="text-muted-foreground text-xs">(sem chaves duplas)</span>
              </UILabel>
              <Input
                id="var-token"
                value={form.token}
                onChange={e => setForm(f => ({ ...f, token: e.target.value.toLowerCase() }))}
                placeholder="ex: empreendimento_atual"
                disabled={!!editing}
                maxLength={64}
              />
              {form.token && (
                <p className="text-xs text-muted-foreground">
                  Vai aparecer como <code className="text-primary">{`{{${form.token}}}`}</code> no editor
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <UILabel htmlFor="var-label">Label (mostra no chip)</UILabel>
              <Input
                id="var-label"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="ex: Empreendimento Atual"
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <UILabel htmlFor="var-desc">Descrição (opcional)</UILabel>
              <Textarea
                id="var-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Quando esta variável é usada"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <UILabel htmlFor="var-source">De onde vem o valor</UILabel>
              <select
                id="var-source"
                value={form.presetKey}
                onChange={e => setForm(f => ({ ...f, presetKey: e.target.value }))}
                className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm"
              >
                {SOURCE_PRESETS.map(p => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {SOURCE_PRESETS.find(p => p.key === form.presetKey)?.description}
              </p>
            </div>

            {SOURCE_PRESETS.find(p => p.key === form.presetKey)?.needsExtra === 'attr' && (
              <div className="space-y-1.5">
                <UILabel htmlFor="var-attr">Chave do atributo customizado</UILabel>
                <Input
                  id="var-attr"
                  value={form.extraValue}
                  onChange={e => setForm(f => ({ ...f, extraValue: e.target.value }))}
                  placeholder="ex: empreendimento_atual"
                />
                <p className="text-xs text-muted-foreground">
                  Resultado: <code>contact.custom_attributes.{form.extraValue || '<chave>'}</code>
                </p>
              </div>
            )}

            {SOURCE_PRESETS.find(p => p.key === form.presetKey)?.needsExtra === 'literal' && (
              <div className="space-y-1.5">
                <UILabel htmlFor="var-literal">Texto fixo</UILabel>
                <Input
                  id="var-literal"
                  value={form.extraValue}
                  onChange={e => setForm(f => ({ ...f, extraValue: e.target.value }))}
                  placeholder="ex: Imobiliária X"
                />
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm">Ativa (chip aparece no editor)</span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <RefreshCw size={14} className="animate-spin mr-2" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!toDelete} onOpenChange={v => !v && setToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remover variável?</DialogTitle>
            <DialogDescription>
              A variável <code className="text-primary">{toDelete?.placeholder}</code> será
              removida. Funis que usam ela vão deixar de interpolar (ficam com o placeholder
              literal no texto enviado).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
