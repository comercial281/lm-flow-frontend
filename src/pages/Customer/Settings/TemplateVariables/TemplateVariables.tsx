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
  Textarea,
  Checkbox,
} from '@/components/ui/ds';
import { Code, Lock, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { tenantTemplateVariablesService } from '@/services/messageFunnels/messageFunnelsService';
import type { TemplateVariable, TenantTemplateVariable } from '@/types/messageFunnels';
import { BaseHeader, Pagina } from '@/components/base';
import { plural } from '@/lib/formato';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';

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
    description: 'Usa o e-mail do lead',
    template: 'contact.email',
    needsExtra: null,
  },
  {
    key: 'contact_phone',
    label: 'Telefone do contato',
    description: 'Usa o telefone do lead, com o código do país (ex.: +5511999999999)',
    template: 'contact.phone_number',
    needsExtra: null,
  },
  {
    key: 'contact_name',
    label: 'Nome completo do contato',
    description: 'Nome inteiro (pra só o primeiro nome, use a variável pronta {{nome}})',
    template: 'contact.name',
    needsExtra: null,
  },
  {
    key: 'contact_custom_attr',
    label: 'Campo personalizado do contato',
    description: 'Usa um campo personalizado do lead que você criou',
    template: 'contact.custom_attributes.',
    needsExtra: 'attr',
  },
  {
    key: 'literal',
    label: 'Valor fixo (texto)',
    description: 'Sempre o mesmo texto, para qualquer lead',
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
  // Falha na carga não pode virar "Nenhuma variável customizada" (erro nunca vira vazio).
  const [erro, setErro] = useState(false);
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
      setErro(false);
    } catch (e: unknown) {
      setErro(true);
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
    if (!form.token.trim()) return 'Nome da variável é obrigatório';
    if (!/^[a-z][a-z0-9_]{1,62}[a-z0-9]$/.test(form.token)) {
      return 'Nome da variável só pode usar a-z, 0-9 e _ (de 3 a 64 caracteres, começando com letra)';
    }
    const builtinHit = builtin.some(b => b.token === form.token);
    if (builtinHit) return `O nome "${form.token}" já é usado pelo sistema`;
    if (!form.label.trim()) return 'O nome na lista é obrigatório';
    const preset = SOURCE_PRESETS.find(p => p.key === form.presetKey);
    if (!preset) return 'Selecione uma fonte de valor';
    if (preset.needsExtra && !form.extraValue.trim()) {
      return preset.needsExtra === 'attr'
        ? 'Informe o nome do campo personalizado'
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
    <Pagina
      cabecalho={
        <BaseHeader
          title="Variáveis de mensagem"
          subtitle={`Variáveis que você insere nas mensagens dos funis e das automações (como {{nome}}) e que viram texto real no momento do envio, lido do lead da conversa. · ${plural(custom.length, 'criada por você', 'criadas por você')}`}
          primaryAction={{ label: 'Nova variável', icon: <Plus className="h-4 w-4" />, onClick: openCreate }}
        />
      }
    >
      {/* Built-in section */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sistema (pronta, não editável)
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
          <Code className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Customizadas ({custom.length}
            {autoCount > 0 && `, ${autoCount} automática${autoCount > 1 ? 's' : ''}`})
          </h2>
        </div>

        {loading ? (
          <Carregando variante="cartoes" linhas={3} />
        ) : erro && custom.length === 0 ? (
          <EmptyState tipo="erro" aoTentarDeNovo={() => void load()} />
        ) : custom.length === 0 ? (
          <EmptyState
            icon={Code}
            title="Nenhuma variável customizada"
            description={
              <>
                Crie variáveis específicas da sua conta pra usar nos funis (ex:
                {' '}<code className="text-xs">{'{{empreendimento_atual}}'}</code>).
                <span className="mt-2 block text-sm">
                  Você também não precisa criar na mão: ao conectar um formulário ao CRM, cada
                  campo respondido pelo lead vira uma variável aqui automaticamente.
                </span>
              </>
            }
            action={{ label: 'Criar primeira', onClick: openCreate, variant: 'outline' }}
          />
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
                      className="size-8"
                      onClick={() => openEdit(v)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => setToDelete(v)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar variável' : 'Nova variável'}</DialogTitle>
            <DialogDescription>
              A variável fica disponível para escolher no editor de funis e vira o valor real do lead na hora de enviar a mensagem.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <GrupoDaJanela titulo="Identificação">
              <GradeDaJanela>
                <CampoDaJanela
                  rotulo="Nome da variável"
                  htmlFor="var-token"
                  colunas={2}
                  obrigatorio
                  ajuda={form.token
                    ? <>Vai aparecer como <code className="text-primary">{`{{${form.token}}}`}</code> no editor</>
                    : 'Sem chaves, só o nome'}
                >
                  <Input
                    id="var-token"
                    value={form.token}
                    onChange={e => setForm(f => ({ ...f, token: e.target.value.toLowerCase() }))}
                    placeholder="Ex.: empreendimento_atual"
                    disabled={!!editing}
                    maxLength={64}
                  />
                </CampoDaJanela>

                <CampoDaJanela rotulo="Nome na lista" htmlFor="var-label" colunas={2} obrigatorio ajuda="Como a variável aparece para escolher">
                  <Input
                    id="var-label"
                    value={form.label}
                    onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="Ex.: Empreendimento atual"
                    maxLength={120}
                  />
                </CampoDaJanela>

                <CampoDaJanela rotulo="Descrição" htmlFor="var-desc" colunas={4}>
                  <Textarea
                    id="var-desc"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Quando esta variável é usada"
                    rows={2}
                  />
                </CampoDaJanela>
              </GradeDaJanela>
            </GrupoDaJanela>

            <GrupoDaJanela titulo="De onde vem o valor">
              <GradeDaJanela>
                <CampoDaJanela
                  rotulo="Origem do valor"
                  htmlFor="var-source"
                  colunas={4}
                  ajuda={SOURCE_PRESETS.find(p => p.key === form.presetKey)?.description}
                >
                  <Seletor
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
                  </Seletor>
                </CampoDaJanela>

                {SOURCE_PRESETS.find(p => p.key === form.presetKey)?.needsExtra === 'attr' && (
                  <CampoDaJanela
                    rotulo="Nome do campo personalizado"
                    htmlFor="var-attr"
                    colunas={4}
                    ajuda="Escreva o nome do campo igual ao que está no cadastro do lead"
                  >
                    <Input
                      id="var-attr"
                      value={form.extraValue}
                      onChange={e => setForm(f => ({ ...f, extraValue: e.target.value }))}
                      placeholder="Ex.: empreendimento_atual"
                    />
                  </CampoDaJanela>
                )}

                {SOURCE_PRESETS.find(p => p.key === form.presetKey)?.needsExtra === 'literal' && (
                  <CampoDaJanela rotulo="Texto fixo" htmlFor="var-literal" colunas={4}>
                    <Input
                      id="var-literal"
                      value={form.extraValue}
                      onChange={e => setForm(f => ({ ...f, extraValue: e.target.value }))}
                      placeholder="Ex.: Imobiliária X"
                    />
                  </CampoDaJanela>
                )}
              </GradeDaJanela>
            </GrupoDaJanela>

            <GrupoDaJanela titulo="Estado">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={v => setForm(f => ({ ...f, active: v === true }))}
                />
                Ativa (aparece para escolher no editor)
              </label>
            </GrupoDaJanela>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
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
              removida. Funis que usam ela vão deixar de interpolar (o texto enviado mostra a
              variável do jeito que foi escrita, sem virar o valor real).
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
    </Pagina>
  );
}
