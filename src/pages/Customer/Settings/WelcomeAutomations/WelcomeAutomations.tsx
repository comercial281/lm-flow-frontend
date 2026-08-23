import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
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
import { Zap, Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import {
  welcomeAutomationsService,
  WelcomeAutomation,
  WelcomeAutomationFormData,
} from '@/services/welcomeAutomations/welcomeAutomationsService';

const TRIGGERS = [
  { value: 'new_conversation', label: 'Nova conversa (qualquer)' },
  { value: 'first_inbound_message', label: 'Primeira mensagem recebida' },
];

const VARIABLE_CHIPS = [
  { label: '{{lead_name}}', value: '{{lead_name}}' },
  { label: '{{lead_phone}}', value: '{{lead_phone}}' },
  { label: '{{conversation_id}}', value: '{{conversation_id}}' },
];

const EMPTY_FORM: WelcomeAutomationFormData = {
  name: '',
  template_body: '',
  trigger: 'new_conversation',
  is_active: true,
  delay_seconds: 0,
  inbox_id: null,
};

export default function WelcomeAutomations() {
  const [automations, setAutomations] = useState<WelcomeAutomation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WelcomeAutomation | null>(null);
  const [formData, setFormData] = useState<WelcomeAutomationFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<WelcomeAutomation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await welcomeAutomationsService.getAll();
      setAutomations(data);
    } catch {
      toast.error('Erro ao carregar automações de boas-vindas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (a: WelcomeAutomation) => {
    setEditing(a);
    setFormData({
      name: a.name,
      template_body: a.template_body,
      trigger: a.trigger,
      is_active: a.is_active,
      delay_seconds: a.delay_seconds,
      inbox_id: a.inbox_id,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Nome é obrigatório';
    if (!formData.template_body.trim()) errors.template_body = 'Mensagem é obrigatória';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await welcomeAutomationsService.update(editing.id, formData);
        setAutomations(prev => prev.map(a => a.id === updated.id ? updated : a));
        toast.success('Automação atualizada');
      } else {
        const created = await welcomeAutomationsService.create(formData);
        setAutomations(prev => [...prev, created]);
        toast.success('Automação criada');
      }
      setModalOpen(false);
    } catch {
      toast.error(editing ? 'Erro ao atualizar automação' : 'Erro ao criar automação');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (a: WelcomeAutomation) => {
    try {
      const updated = await welcomeAutomationsService.update(a.id, { is_active: !a.is_active });
      setAutomations(prev => prev.map(x => x.id === updated.id ? updated : x));
      toast.success(updated.is_active ? 'Automação ativada' : 'Automação desativada');
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = (a: WelcomeAutomation) => {
    setToDelete(a);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await welcomeAutomationsService.delete(toDelete.id);
      setAutomations(prev => prev.filter(a => a.id !== toDelete.id));
      toast.success('Automação excluída');
      setDeleteDialogOpen(false);
      setToDelete(null);
    } catch {
      toast.error('Erro ao excluir automação');
    } finally {
      setDeleting(false);
    }
  };

  const insertVariable = (v: string) => {
    setFormData(prev => ({ ...prev, template_body: prev.template_body + v }));
  };

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Automações de Boas-Vindas</h1>
          <span className="text-sm text-muted-foreground">({automations.length})</span>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nova Automação
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : automations.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="Nenhuma automação de boas-vindas"
            description="Crie mensagens automáticas enviadas quando um novo lead inicia contato"
            action={{ label: 'Nova Automação', onClick: openNew }}
            className="h-full"
          />
        ) : (
          <div className="space-y-3">
            {automations.map(a => (
              <div key={a.id} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{a.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${a.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                      {a.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {TRIGGERS.find(t => t.value === a.trigger)?.label}
                    </span>
                    {a.delay_seconds > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Delay: {a.delay_seconds}s
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{a.template_body}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(a)}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title={a.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {a.is_active
                      ? <ToggleRight className="h-5 w-5 text-primary" />
                      : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal create/edit */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!open) { setModalOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Automação' : 'Nova Automação de Boas-Vindas'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <UILabel htmlFor="wa-name">Nome</UILabel>
              <Input
                id="wa-name"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Boas-vindas WhatsApp"
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <UILabel htmlFor="wa-trigger">Gatilho</UILabel>
              <select
                id="wa-trigger"
                value={formData.trigger}
                onChange={e => setFormData(p => ({ ...p, trigger: e.target.value as WelcomeAutomationFormData['trigger'] }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {TRIGGERS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <UILabel htmlFor="wa-delay">Delay (segundos)</UILabel>
              <Input
                id="wa-delay"
                type="number"
                min={0}
                max={3600}
                value={formData.delay_seconds}
                onChange={e => setFormData(p => ({ ...p, delay_seconds: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">0 = enviada imediatamente após a criação da conversa</p>
            </div>

            <div className="space-y-1.5">
              <UILabel htmlFor="wa-body">Mensagem</UILabel>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {VARIABLE_CHIPS.map(chip => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => insertVariable(chip.value)}
                    className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-mono"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <Textarea
                id="wa-body"
                value={formData.template_body}
                onChange={e => setFormData(p => ({ ...p, template_body: e.target.value }))}
                placeholder="Olá {{lead_name}}! Obrigado por entrar em contato..."
                rows={5}
              />
              {formErrors.template_body && <p className="text-xs text-destructive">{formErrors.template_body}</p>}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="wa-active"
                checked={formData.is_active}
                onChange={e => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              <UILabel htmlFor="wa-active" className="cursor-pointer font-normal">Ativada</UILabel>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir automação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{toDelete?.name}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
