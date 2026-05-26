import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label as UILabel,
  Textarea,
  Badge,
} from '@evoapi/design-system';
import { Plus, Edit, Trash2, Zap, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import {
  leadAutomationService,
  LeadAutomationRule,
  LeadAutomationRuleFormData,
  TRIGGER_LABELS,
  ACTION_TYPE_LABELS,
} from '@/services/leadAutomation/leadAutomationService';

const TRIGGERS = Object.entries(TRIGGER_LABELS).map(([value, label]) => ({ value, label }));
const ACTION_TYPES = Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const EMPTY_FORM: LeadAutomationRuleFormData = {
  name: '',
  description: '',
  trigger: 'lead.created',
  conditions: [],
  actions: [{ type: 'add_label', params: {} }],
  is_active: true,
  priority: 0,
  pipeline_id: null,
};

export default function LeadAutomations() {
  const [rules, setRules] = useState<LeadAutomationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeadAutomationRule | null>(null);
  const [form, setForm] = useState<LeadAutomationRuleFormData>(EMPTY_FORM);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<LeadAutomationRule | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await leadAutomationService.getAll());
    } catch {
      toast.error('Erro ao carregar automações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (rule: LeadAutomationRule) => {
    setEditing(rule);
    setForm({
      name:        rule.name,
      description: rule.description ?? '',
      trigger:     rule.trigger,
      conditions:  rule.conditions,
      actions:     rule.actions,
      is_active:   rule.is_active,
      priority:    rule.priority,
      pipeline_id: rule.pipeline_id,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (form.actions.length === 0) { toast.error('Adicione pelo menos uma ação'); return; }

    setSaving(true);
    try {
      if (editing) {
        const updated = await leadAutomationService.update(editing.id, form);
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
        toast.success('Automação atualizada');
      } else {
        const created = await leadAutomationService.create(form);
        setRules(prev => [...prev, created]);
        toast.success('Automação criada');
      }
      setModalOpen(false);
    } catch {
      toast.error('Erro ao salvar automação');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: LeadAutomationRule) => {
    try {
      const updated = await leadAutomationService.toggle(rule.id);
      setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast.success(updated.is_active ? 'Automação ativada' : 'Automação desativada');
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await leadAutomationService.delete(toDelete.id);
      setRules(prev => prev.filter(r => r.id !== toDelete.id));
      toast.success('Automação removida');
      setDeleteDialogOpen(false);
    } catch {
      toast.error('Erro ao remover automação');
    } finally {
      setDeleting(false);
    }
  };

  const addAction = () =>
    setForm(f => ({ ...f, actions: [...f.actions, { type: 'add_label', params: {} }] }));

  const removeAction = (i: number) =>
    setForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));

  const updateAction = (i: number, type: string) =>
    setForm(f => ({
      ...f,
      actions: f.actions.map((a, idx) => idx === i ? { type, params: {} } : a),
    }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Automações de Lead
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Regras automáticas disparadas por eventos imobiliários
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova regra
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Carregando...</div>
      ) : rules.length === 0 ? (
        <EmptyState
          title="Nenhuma automação criada"
          description="Crie regras para automatizar ações quando leads interagem com o sistema"
          action={{ label: 'Criar automação', onClick: openCreate }}
        />
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className="border border-border rounded-xl bg-card overflow-hidden"
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <button
                  onClick={() => handleToggle(rule)}
                  className="flex-shrink-0"
                  title={rule.is_active ? 'Desativar' : 'Ativar'}
                >
                  {rule.is_active
                    ? <ToggleRight className="h-6 w-6 text-primary" />
                    : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{rule.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {TRIGGER_LABELS[rule.trigger] ?? rule.trigger}
                    </Badge>
                    {!rule.is_active && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Inativa
                      </Badge>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{rule.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {rule.actions.length} {rule.actions.length === 1 ? 'ação' : 'ações'}
                    {rule.conditions.length > 0 && ` · ${rule.conditions.length} ${rule.conditions.length === 1 ? 'condição' : 'condições'}`}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                  >
                    {expandedId === rule.id
                      ? <ChevronUp className="h-4 w-4" />
                      : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => { setToDelete(rule); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {expandedId === rule.id && (
                <div className="px-5 pb-4 border-t border-border bg-muted/20 pt-3 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Ações</div>
                  {rule.actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Zap className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>{ACTION_TYPE_LABELS[a.type] ?? a.type}</span>
                    </div>
                  ))}
                  {rule.conditions.length > 0 && (
                    <>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-3 mb-2">Condições</div>
                      {rule.conditions.map((c, i) => (
                        <div key={i} className="text-sm text-muted-foreground">
                          {c.field} {c.operator} {JSON.stringify(c.value)}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar automação' : 'Nova automação de lead'}</DialogTitle>
            <DialogDescription>
              Configure o gatilho e as ações que serão executadas automaticamente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <UILabel>Nome *</UILabel>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Boas-vindas para lead de venda"
                  className="mt-1"
                />
              </div>

              <div className="col-span-2">
                <UILabel>Descrição</UILabel>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="O que essa automação faz?"
                  rows={2}
                  className="mt-1 resize-none"
                />
              </div>

              <div>
                <UILabel>Gatilho *</UILabel>
                <select
                  value={form.trigger}
                  onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TRIGGERS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <UILabel>Prioridade</UILabel>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                  min={0}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <UILabel>Ações *</UILabel>
                <Button variant="outline" size="sm" onClick={addAction}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar ação
                </Button>
              </div>
              <div className="space-y-2">
                {form.actions.map((action, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/20">
                    <select
                      value={action.type}
                      onChange={e => updateAction(i, e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {ACTION_TYPES.map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => removeAction(i)}
                      disabled={form.actions.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-input"
              />
              <UILabel htmlFor="is_active" className="cursor-pointer">Ativa</UILabel>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover automação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover <strong>{toDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
