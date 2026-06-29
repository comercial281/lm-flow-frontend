import { useState, useEffect, useCallback } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label as UILabel,
  Textarea,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import {
  Plus, Edit, Trash2, FileText, GripVertical,
  ToggleLeft, ToggleRight, X, ClipboardList,
} from 'lucide-react';
import {
  dynamicFormsService,
  DynamicForm,
  FormField,
  DynamicFormFormData,
  FormFieldFormData,
  FIELD_TYPE_LABELS,
  ROLE_TYPE_LABELS,
} from '@/services/dynamicForms/dynamicFormsService';

const FIELD_TYPES = Object.entries(FIELD_TYPE_LABELS);
const ROLE_TYPES = Object.entries(ROLE_TYPE_LABELS);

const BLANK_FORM: DynamicFormFormData = {
  name: '',
  description: '',
  role_type: '',
  active: true,
};

const BLANK_FIELD: FormFieldFormData = {
  name: '',
  label: '',
  field_type: 'text',
  required: false,
  help_text: '',
  placeholder: '',
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export default function DynamicForms() {
  const [forms, setForms] = useState<DynamicForm[]>([]);
  const [loading, setLoading] = useState(true);

  // Form CRUD modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<DynamicForm | null>(null);
  const [formData, setFormData] = useState<DynamicFormFormData>(BLANK_FORM);
  const [formSaving, setFormSaving] = useState(false);

  // Fields modal
  const [fieldsModalOpen, setFieldsModalOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<DynamicForm | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldData, setFieldData] = useState<FormFieldFormData>(BLANK_FIELD);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [addingField, setAddingField] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<DynamicForm | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dynamicFormsService.list();
      setForms(res.data);
    } catch {
      toast.error('Erro ao carregar formulários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const openCreate = () => {
    setEditingForm(null);
    setFormData(BLANK_FORM);
    setFormModalOpen(true);
  };

  const openEdit = (form: DynamicForm) => {
    setEditingForm(form);
    setFormData({
      name: form.name,
      description: form.description ?? '',
      role_type: form.role_type ?? '',
      active: form.active,
    });
    setFormModalOpen(true);
  };

  const handleSaveForm = async () => {
    if (!formData.name.trim()) return toast.error('Nome obrigatório');
    setFormSaving(true);
    try {
      if (editingForm) {
        const updated = await dynamicFormsService.update(editingForm.id, formData);
        setForms(prev => prev.map(f => f.id === updated.id ? { ...f, ...updated } : f));
        toast.success('Formulário atualizado');
      } else {
        const created = await dynamicFormsService.create(formData);
        setForms(prev => [created, ...prev]);
        toast.success('Formulário criado');
      }
      setFormModalOpen(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar formulário'));
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteForm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await dynamicFormsService.delete(deleteTarget.id);
      setForms(prev => prev.filter(f => f.id !== deleteTarget.id));
      toast.success('Formulário removido');
      setDeleteTarget(null);
    } catch {
      toast.error('Erro ao remover formulário');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openFields = async (form: DynamicForm) => {
    setActiveForm(form);
    setFieldsModalOpen(true);
    setAddingField(false);
    setFieldData(BLANK_FIELD);
    setFieldsLoading(true);
    try {
      const full = await dynamicFormsService.get(form.id);
      setFields(full.fields ?? []);
      setActiveForm(full);
    } catch {
      toast.error('Erro ao carregar campos');
    } finally {
      setFieldsLoading(false);
    }
  };

  const handleAddField = async () => {
    if (!activeForm) return;
    if (!fieldData.name.trim()) return toast.error('Nome (identificador) obrigatório');
    if (!fieldData.label.trim()) return toast.error('Rótulo obrigatório');
    setFieldSaving(true);
    try {
      const created = await dynamicFormsService.addField(activeForm.id, fieldData);
      setFields(prev => [...prev, created]);
      setFieldData(BLANK_FIELD);
      setAddingField(false);
      setForms(prev => prev.map(f => f.id === activeForm.id ? { ...f, field_count: f.field_count + 1 } : f));
      toast.success('Campo adicionado');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao adicionar campo'));
    } finally {
      setFieldSaving(false);
    }
  };

  const handleRemoveField = async (fieldId: string) => {
    if (!activeForm) return;
    try {
      await dynamicFormsService.removeField(activeForm.id, fieldId);
      setFields(prev => prev.filter(f => f.id !== fieldId));
      setForms(prev => prev.map(f => f.id === activeForm.id ? { ...f, field_count: Math.max(0, f.field_count - 1) } : f));
      toast.success('Campo removido');
    } catch {
      toast.error('Erro ao remover campo');
    }
  };

  const patchFormData = (patch: Partial<DynamicFormFormData>) =>
    setFormData(prev => ({ ...prev, ...patch }));

  const patchFieldData = (patch: Partial<FormFieldFormData>) =>
    setFieldData(prev => ({ ...prev, ...patch }));

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Formulários Dinâmicos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fichas personalizadas por papel do contato</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo formulário
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum formulário criado</p>
          <Button size="sm" variant="outline" onClick={openCreate}>Criar primeiro formulário</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {forms.map(form => (
            <div
              key={form.id}
              className="flex items-start justify-between rounded-lg border border-border bg-card p-4 gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{form.name}</span>
                  {form.is_system && (
                    <Badge variant="secondary" className="text-xs">Sistema</Badge>
                  )}
                  {!form.active && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                  )}
                  {form.role_type && (
                    <Badge variant="outline" className="text-xs">
                      {ROLE_TYPE_LABELS[form.role_type] ?? form.role_type}
                    </Badge>
                  )}
                </div>
                {form.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{form.description}</p>
                )}
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{form.field_count} campo{form.field_count !== 1 ? 's' : ''}</span>
                  <span>{form.submissions_count} envio{form.submissions_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openFields(form)} title="Gerenciar campos">
                  <ClipboardList className="h-4 w-4" />
                </Button>
                {!form.is_system && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(form)} title="Editar">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(form)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Form Modal */}
      <Dialog open={formModalOpen} onOpenChange={setFormModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingForm ? 'Editar formulário' : 'Novo formulário'}</DialogTitle>
            <DialogDescription>Preencha os dados do formulário dinâmico</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <UILabel>Nome *</UILabel>
              <Input
                value={formData.name}
                onChange={e => {
                  patchFormData({
                    name: e.target.value,
                    slug: slugify(e.target.value),
                  });
                }}
                placeholder="Ex: Ficha do Comprador"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <UILabel>Descrição</UILabel>
              <Textarea
                value={formData.description ?? ''}
                onChange={e => patchFormData({ description: e.target.value })}
                placeholder="Descreva o propósito deste formulário"
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <UILabel>Papel do contato</UILabel>
              <Select
                value={formData.role_type ?? ''}
                onValueChange={v => patchFormData({ role_type: v || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {ROLE_TYPES.map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => patchFormData({ active: !formData.active })}
                className="flex items-center gap-2 text-sm"
              >
                {formData.active
                  ? <ToggleRight className="h-5 w-5 text-green-500" />
                  : <ToggleLeft className="h-5 w-5 text-red-500" />}
                <span className={formData.active ? 'text-foreground' : 'text-muted-foreground'}>
                  {formData.active ? 'Ativo' : 'Inativo'}
                </span>
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveForm} disabled={formSaving}>
              {formSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fields Modal */}
      <Dialog open={fieldsModalOpen} onOpenChange={setFieldsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Campos — {activeForm?.name}</DialogTitle>
            <DialogDescription>Gerencie os campos deste formulário</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {fieldsLoading ? (
              <div className="text-sm text-muted-foreground">Carregando campos...</div>
            ) : fields.length === 0 && !addingField ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                Nenhum campo. Adicione o primeiro campo abaixo.
              </div>
            ) : (
              fields.map(field => (
                <div
                  key={field.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{field.label}</span>
                      <span className="text-xs text-muted-foreground font-mono">{field.name}</span>
                      <Badge variant="outline" className="text-xs">{FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}</Badge>
                      {field.required && <Badge variant="secondary" className="text-xs">Obrigatório</Badge>}
                    </div>
                    {field.help_text && (
                      <p className="text-xs text-muted-foreground mt-0.5">{field.help_text}</p>
                    )}
                  </div>
                  {!activeForm?.is_system && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleRemoveField(field.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}

            {/* Add field form */}
            {addingField && (
              <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium">Novo campo</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <UILabel className="text-xs">Rótulo *</UILabel>
                    <Input
                      value={fieldData.label}
                      onChange={e => {
                        patchFieldData({
                          label: e.target.value,
                          name: slugify(e.target.value),
                        });
                      }}
                      placeholder="Ex: Nome completo"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <UILabel className="text-xs">Identificador *</UILabel>
                    <Input
                      value={fieldData.name}
                      onChange={e => patchFieldData({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                      placeholder="nome_completo"
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <UILabel className="text-xs">Tipo *</UILabel>
                    <Select value={fieldData.field_type} onValueChange={v => patchFieldData({ field_type: v })}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map(([key, label]) => (
                          <SelectItem key={key} value={key} className="text-sm">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <UILabel className="text-xs">Texto de ajuda</UILabel>
                    <Input
                      value={fieldData.help_text ?? ''}
                      onChange={e => patchFieldData({ help_text: e.target.value })}
                      placeholder="Instrução para o usuário"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => patchFieldData({ required: !fieldData.required })}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    {fieldData.required
                      ? <ToggleRight className="h-4 w-4 text-green-500" />
                      : <ToggleLeft className="h-4 w-4 text-red-500" />}
                    <span className={fieldData.required ? 'text-foreground' : 'text-muted-foreground text-xs'}>
                      Obrigatório
                    </span>
                  </button>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAddingField(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleAddField} disabled={fieldSaving}>
                    {fieldSaving ? 'Adicionando...' : 'Adicionar campo'}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row justify-between">
            {!activeForm?.is_system && !addingField && (
              <Button size="sm" variant="outline" onClick={() => { setAddingField(true); setFieldData(BLANK_FIELD); }}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar campo
              </Button>
            )}
            <Button variant="outline" onClick={() => setFieldsModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir formulário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteForm} disabled={deleteLoading}>
              {deleteLoading ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
