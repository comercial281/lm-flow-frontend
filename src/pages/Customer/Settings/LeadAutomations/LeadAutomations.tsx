import { useState, useEffect, useCallback } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/ds';
import {
  Plus, Edit, Trash2, Zap, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Archive, ArchiveRestore, BookOpen, Lock, Copy, Star, ArrowUp, ArrowDown,
} from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import {
  leadAutomationService,
  LeadAutomationRule,
  LeadAutomationRuleFormData,
  LeadAutomationAction,
  LeadAutomationCondition,
  TRIGGER_LABELS,
  ACTION_TYPE_LABELS,
} from '@/services/leadAutomation/leadAutomationService';
import {
  useAutomationResources,
  triggerNeedsCondition,
  ConditionEditor,
  ActionEditor,
  validateRule,
  formatConditionSummary,
  formatActionSummary,
} from './LeadAutomationsEditors';
import AutomationLibraryModal from './AutomationLibraryModal';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import NotificationCenter from './NotificationCenter';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';

const TRIGGERS = Object.entries(TRIGGER_LABELS).map(([value, label]) => ({ value, label }));
const ACTION_TYPES = Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

// Explica quando cada gatilho dispara — tira a confusão entre "todo lead" e "lead de anúncio".
const TRIGGER_HINTS: Record<string, string> = {
  'lead.created': 'Dispara pra TODO lead novo. Use o filtro de Origem abaixo pra valer só pra anúncio (formulário ou WhatsApp).',
  'lead.campaign_received': 'Dispara SÓ quando o lead clica num anúncio e cai direto no WhatsApp (Click-to-WhatsApp).',
  'lead.tag_added': 'Dispara quando uma etiqueta é adicionada. Escolha qual etiqueta abaixo.',
  'lead.message_received': 'Dispara quando o lead manda uma mensagem. Filtre por palavra-chave abaixo (opcional).',
  'lead.stage_changed': 'Dispara quando o lead muda de etapa no funil.',
  'lead.no_reply_after': 'Dispara quando o lead não responde após X minutos da última mensagem enviada. Define o tempo na condição abaixo.',
};

const EMPTY_FORM: LeadAutomationRuleFormData = {
  name: '',
  description: '',
  trigger: 'lead.created',
  conditions: [],
  actions: [{ type: 'start_followup_sequence', params: {} }],
  is_active: true,
  priority: 0,
  pipeline_id: null,
};

type Tab = 'active' | 'archived';

// Favoritos no topo, depois priority, depois criação. O backend NÃO ordena por
// favorite (coluna pode faltar em schema de tenant pooled), então a ordem final é
// aplicada aqui no cliente — no load e em toda mudança.
function sortRules(list: LeadAutomationRule[]): LeadAutomationRule[] {
  return [...list].sort((a, b) => {
    if (!!b.favorite !== !!a.favorite) return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
    if ((a.priority ?? 0) !== (b.priority ?? 0)) return (a.priority ?? 0) - (b.priority ?? 0);
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export default function LeadAutomations() {
  const isSuperAdmin = useIsSuperAdmin();
  const { features } = useTenantFeatures();
  // Super-admin (Leal Mídia) sempre tem acesso; cliente só com o toggle ligado.
  const canAccess = isSuperAdmin || features?.['client_manage_automations'] === true;

  const [tab, setTab] = useState<Tab>('active');
  const [rules, setRules] = useState<LeadAutomationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editing, setEditing] = useState<LeadAutomationRule | null>(null);
  const [form, setForm] = useState<LeadAutomationRuleFormData>(EMPTY_FORM);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<LeadAutomationRule | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const resources = useAutomationResources(canAccess);

  const load = useCallback(async (which: Tab) => {
    setLoading(true);
    try {
      setRules(sortRules(await leadAutomationService.getAll(which === 'archived')));
    } catch {
      toast.error('Erro ao carregar automações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (canAccess) load(tab); }, [load, tab, canAccess]);

  if (!canAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground">
          <Lock className="h-10 w-10 mb-3 opacity-40" />
          <h2 className="text-lg font-semibold text-foreground">Automações gerenciadas pela Leal Mídia</h2>
          <p className="text-sm mt-1 max-w-md">
            As automações deste CRM são configuradas pela sua agência. Fale com a Leal Mídia para liberar a gestão por aqui.
          </p>
        </div>
      </div>
    );
  }

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

    const validation = validateRule(form.trigger, form.conditions, form.actions);
    if (!validation.ok) {
      toast.error(validation.error ?? 'Configuração inválida');
      return;
    }

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
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar automação'));
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (rule: LeadAutomationRule) => {
    try {
      // Cópia nasce DESLIGADA pra não disparar sem querer; usuário liga quando quiser.
      const created = await leadAutomationService.create({
        name:        `${rule.name} (cópia)`,
        description: rule.description ?? '',
        trigger:     rule.trigger,
        conditions:  rule.conditions,
        actions:     rule.actions,
        is_active:   false,
        priority:    rule.priority,
        pipeline_id: rule.pipeline_id,
      });
      setRules(prev => [...prev, created]);
      toast.success('Automação duplicada (desligada)');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao duplicar automação'));
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

  const handleFavorite = async (rule: LeadAutomationRule) => {
    const fav = !rule.favorite;
    setRules(prev => sortRules(prev.map(r => r.id === rule.id ? { ...r, favorite: fav } : r)));
    try {
      await leadAutomationService.update(rule.id, { favorite: fav });
    } catch {
      toast.error('Erro ao favoritar');
      setRules(prev => sortRules(prev.map(r => r.id === rule.id ? { ...r, favorite: !fav } : r)));
    }
  };

  const startRename = (rule: LeadAutomationRule) => {
    setEditingNameId(rule.id);
    setEditingName(rule.name);
  };

  const saveRename = async (rule: LeadAutomationRule) => {
    const name = editingName.trim();
    setEditingNameId(null);
    if (!name || name === rule.name) return;
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, name } : r));
    try {
      await leadAutomationService.update(rule.id, { name });
      toast.success('Nome atualizado');
    } catch {
      toast.error('Erro ao renomear');
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, name: rule.name } : r));
    }
  };

  // Reordena movendo o card 1 posição; persiste priority = índice (só das regras que mudaram).
  const handleMove = (rule: LeadAutomationRule, dir: 'up' | 'down') => {
    const idx = rules.findIndex(r => r.id === rule.id);
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || target < 0 || target >= rules.length) return;
    const swapped = [...rules];
    [swapped[idx], swapped[target]] = [swapped[target], swapped[idx]];
    const renumbered = swapped.map((r, i) => ({ ...r, priority: i }));
    setRules(renumbered);
    const changed = renumbered.filter(r => rules.find(o => o.id === r.id)?.priority !== r.priority);
    Promise.all(changed.map(r => leadAutomationService.update(r.id, { priority: r.priority })))
      .catch(() => { toast.error('Erro ao reordenar'); void load(tab); });
  };

  const handleArchive = async (rule: LeadAutomationRule) => {
    try {
      await leadAutomationService.archive(rule.id);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      toast.success('Automação arquivada');
    } catch {
      toast.error('Erro ao arquivar');
    }
  };

  const handleUnarchive = async (rule: LeadAutomationRule) => {
    try {
      await leadAutomationService.unarchive(rule.id);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      toast.success('Automação restaurada');
    } catch {
      toast.error('Erro ao restaurar');
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

  const setTrigger = (trigger: string) =>
    setForm(f => ({
      ...f,
      trigger,
      conditions: triggerNeedsCondition(trigger) ? f.conditions : [],
    }));

  const setCondition = (next: LeadAutomationCondition | null) =>
    setForm(f => ({ ...f, conditions: next ? [next] : [] }));

  const addAction = () =>
    setForm(f => ({
      ...f,
      actions: [...f.actions, { type: 'start_followup_sequence', params: {} }],
    }));

  const removeAction = (i: number) =>
    setForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));

  const updateActionType = (i: number, type: string) =>
    setForm(f => ({
      ...f,
      actions: f.actions.map((a, idx) => idx === i ? { type, params: {} } : a),
    }));

  const updateActionFull = (i: number, next: LeadAutomationAction) =>
    setForm(f => ({
      ...f,
      actions: f.actions.map((a, idx) => idx === i ? next : a),
    }));

  const archivedTab = tab === 'archived';

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Criar
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Criar nova regra
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLibraryOpen(true)}>
              <BookOpen className="h-4 w-4 mr-2" />
              Adicionar da biblioteca
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Central de Notificações — presets de push em toggle */}
      <NotificationCenter />

      {/* Tabs Ativas / Arquivadas */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {([['active', 'Ativas'], ['archived', 'Arquivadas']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setExpandedId(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Carregando...</div>
      ) : rules.length === 0 ? (
        archivedTab ? (
          <div className="text-center py-16 text-sm text-muted-foreground">Nenhuma automação arquivada.</div>
        ) : (
          <EmptyState
            title="Nenhuma automação criada"
            description="Crie do zero ou adicione um modelo pronto da biblioteca"
            action={{ label: 'Criar automação', onClick: openCreate }}
          />
        )
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className="border border-border rounded-xl bg-card overflow-hidden"
            >
              <div className="flex items-center gap-4 px-5 py-4">
                {!archivedTab && (
                  <button
                    onClick={() => handleFavorite(rule)}
                    className="flex-shrink-0"
                    title={rule.favorite ? 'Desafixar do topo' : 'Favoritar (fixa no topo)'}
                  >
                    <Star className={`h-5 w-5 ${rule.favorite ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                  </button>
                )}

                {!archivedTab && (
                  <button
                    onClick={() => handleToggle(rule)}
                    className="flex-shrink-0"
                    title={rule.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {rule.is_active
                      ? <ToggleRight className="h-6 w-6 text-green-500" />
                      : <ToggleLeft className="h-6 w-6 text-red-500" />}
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {editingNameId === rule.id ? (
                      <Input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => saveRename(rule)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); saveRename(rule); }
                          if (e.key === 'Escape') setEditingNameId(null);
                        }}
                        className="h-7 w-56 text-sm font-medium"
                      />
                    ) : (
                      <span
                        className="font-medium truncate cursor-text"
                        title="Duplo-clique para renomear"
                        onDoubleClick={() => startRename(rule)}
                      >
                        {rule.name}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {TRIGGER_LABELS[rule.trigger] ?? rule.trigger}
                    </Badge>
                    {!archivedTab && !rule.is_active && (
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
                  {!archivedTab && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Mover pra cima"
                        disabled={rules.findIndex(r => r.id === rule.id) === 0}
                        onClick={() => handleMove(rule, 'up')}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Mover pra baixo"
                        disabled={rules.findIndex(r => r.id === rule.id) === rules.length - 1}
                        onClick={() => handleMove(rule, 'down')}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                  >
                    {expandedId === rule.id
                      ? <ChevronUp className="h-4 w-4" />
                      : <ChevronDown className="h-4 w-4" />}
                  </Button>

                  {archivedTab ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Restaurar"
                      onClick={() => handleUnarchive(rule)}
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(rule)} title="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Arquivar"
                        onClick={() => handleArchive(rule)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    title="Duplicar"
                    onClick={() => handleDuplicate(rule)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    title="Remover"
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
                      <span className="font-medium">{ACTION_TYPE_LABELS[a.type] ?? a.type}</span>
                      <span className="text-muted-foreground">{formatActionSummary(a, resources)}</span>
                    </div>
                  ))}
                  {rule.conditions.length > 0 && (
                    <>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-3 mb-2">Condições</div>
                      {rule.conditions.map((c, i) => (
                        <div key={i} className="text-sm text-muted-foreground">
                          {formatConditionSummary(rule.trigger, c, resources)}
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

      {/* Biblioteca */}
      <AutomationLibraryModal
        open={libraryOpen}
        onClose={() => { setLibraryOpen(false); if (tab === 'active') load('active'); }}
        onApplied={() => { if (tab === 'active') load('active'); }}
      />

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
                  onChange={e => setTrigger(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TRIGGERS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {TRIGGER_HINTS[form.trigger] && (
                  <p className="text-xs text-muted-foreground mt-1">{TRIGGER_HINTS[form.trigger]}</p>
                )}
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

            {/* Condição do gatilho (dinâmica) */}
            {triggerNeedsCondition(form.trigger) && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <ConditionEditor
                  trigger={form.trigger}
                  condition={form.conditions[0] ?? null}
                  onChange={setCondition}
                  resources={resources}
                />
              </div>
            )}

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
                  <div key={i} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={action.type}
                        onChange={e => updateActionType(i, e.target.value)}
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
                    <ActionEditor
                      action={action}
                      onChange={next => updateActionFull(i, next)}
                      resources={resources}
                    />
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
