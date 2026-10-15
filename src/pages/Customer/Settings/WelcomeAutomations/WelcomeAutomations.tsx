import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Card,
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
  Checkbox,
} from '@/components/ui/ds';
import { Zap, Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import {
  welcomeAutomationsService,
  WelcomeAutomation,
  WelcomeAutomationFormData,
} from '@/services/welcomeAutomations/welcomeAutomationsService';
import { Seletor } from '@/components/base/Seletor';
import { CampoDaJanela, GradeDaJanela, GrupoDaJanela } from '@/components/base/janela';

const TRIGGERS = [
  { value: 'new_conversation', label: 'Qualquer conversa nova' },
  { value: 'first_inbound_message', label: 'Primeira mensagem recebida' },
];

// O botão mostra o nome humano; o que entra no texto (e é gravado) continua a variável.
const VARIABLE_CHIPS = [
  { label: 'Nome do lead', value: '{{lead_name}}' },
  { label: 'Telefone do lead', value: '{{lead_phone}}' },
  { label: 'Número da conversa', value: '{{conversation_id}}' },
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
              <Card key={a.id} className="flex-row items-start gap-4 p-4">
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
                    aria-label="Editar automação"
                    title="Editar automação"
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    aria-label="Excluir automação"
                    title="Excluir automação"
                    className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal create/edit */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!open) { setModalOpen(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar automação' : 'Nova automação de boas-vindas'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <GrupoDaJanela titulo="Automação">
              <GradeDaJanela>
                <CampoDaJanela rotulo="Nome" htmlFor="wa-name" obrigatorio colunas={4} erro={formErrors.name}>
                  <Input
                    id="wa-name"
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex.: Boas-vindas WhatsApp"
                  />
                </CampoDaJanela>

                <CampoDaJanela rotulo="Gatilho" htmlFor="wa-trigger" colunas={2}>
                  <Seletor
                    id="wa-trigger"
                    value={formData.trigger}
                    onChange={e => setFormData(p => ({ ...p, trigger: e.target.value as WelcomeAutomationFormData['trigger'] }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {TRIGGERS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Seletor>
                </CampoDaJanela>

                <CampoDaJanela
                  rotulo="Esperar quantos segundos"
                  htmlFor="wa-delay"
                  colunas={2}
                  ajuda="Com 0, a mensagem sai logo depois que a conversa começa"
                >
                  <Input
                    id="wa-delay"
                    type="number"
                    min={0}
                    max={3600}
                    value={formData.delay_seconds}
                    onChange={e => setFormData(p => ({ ...p, delay_seconds: parseInt(e.target.value) || 0 }))}
                  />
                </CampoDaJanela>
              </GradeDaJanela>
            </GrupoDaJanela>

            <GrupoDaJanela titulo="Mensagem">
              <CampoDaJanela
                rotulo="Texto da mensagem"
                htmlFor="wa-body"
                obrigatorio
                erro={formErrors.template_body}
                ajuda="Use os botões acima do texto para colocar o nome ou o telefone do lead na mensagem"
              >
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLE_CHIPS.map(chip => (
                    <Button
                      key={chip.value}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => insertVariable(chip.value)}
                    >
                      {chip.label}
                    </Button>
                  ))}
                </div>
                <Textarea
                  id="wa-body"
                  value={formData.template_body}
                  onChange={e => setFormData(p => ({ ...p, template_body: e.target.value }))}
                  placeholder="Olá! Obrigado por entrar em contato..."
                  rows={5}
                />
              </CampoDaJanela>
            </GrupoDaJanela>

            <GrupoDaJanela titulo="Estado">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="wa-active"
                  checked={formData.is_active}
                  onCheckedChange={v => setFormData(p => ({ ...p, is_active: v === true }))}
                />
                <UILabel htmlFor="wa-active" className="cursor-pointer font-normal">Ativada</UILabel>
              </div>
            </GrupoDaJanela>
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
        <DialogContent compacta>
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
