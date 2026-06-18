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
  Label as UILabel,
  Badge,
} from '@evoapi/design-system';
import {
  FileInput, RefreshCw, Edit, ToggleLeft, ToggleRight, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import EmptyState from '@/components/base/EmptyState';
import {
  leadAdsFormsService,
  LeadAdsFormConfig,
  LeadAdsFormConfigFormData,
  MetaForm,
} from '@/services/leadAds/leadAdsFormsService';
import { useAutomationResources } from '../LeadAutomations/LeadAutomationsEditors';

const baseSelectClass =
  'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

interface FormState {
  form_id: string;
  form_name: string;
  pipeline_id: string;
  pipeline_stage_id: string;
  label_ids: string[];
  is_active: boolean;
}

const emptyFormState = (form_id = '', form_name = ''): FormState => ({
  form_id,
  form_name,
  pipeline_id: '',
  pipeline_stage_id: '',
  label_ids: [],
  is_active: true,
});

export default function LeadAdsForms() {
  const resources = useAutomationResources(true);

  const [configs, setConfigs] = useState<LeadAdsFormConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [metaForms, setMetaForms] = useState<MetaForm[]>([]);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncedOnce, setSyncedOnce] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeadAdsFormConfig | null>(null);
  const [form, setForm] = useState<FormState>(emptyFormState());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConfigs(await leadAdsFormsService.getAll());
    } catch {
      toast.error('Erro ao carregar formulários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await leadAdsFormsService.syncMetaForms();
      setMetaForms(result.data);
      setMetaError(result.error ?? null);
      setSyncedOnce(true);
      if (result.error) {
        toast.error('Não foi possível buscar os formulários da Meta');
      } else {
        toast.success(`${result.data.length} formulário(s) encontrado(s)`);
      }
    } catch {
      toast.error('Erro ao sincronizar formulários');
    } finally {
      setSyncing(false);
    }
  };

  const configByFormId = (formId: string) => configs.find(c => c.form_id === formId);

  const openCreate = (mf: MetaForm) => {
    setEditing(null);
    setForm(emptyFormState(mf.id, mf.name));
    setModalOpen(true);
  };

  const openEdit = (cfg: LeadAdsFormConfig) => {
    setEditing(cfg);
    setForm({
      form_id:           cfg.form_id,
      form_name:         cfg.form_name,
      pipeline_id:       cfg.pipeline_id ?? '',
      pipeline_stage_id: cfg.pipeline_stage_id ?? '',
      label_ids:         cfg.label_ids ?? [],
      is_active:         cfg.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.pipeline_id) { toast.error('Selecione um pipeline'); return; }
    if (!form.pipeline_stage_id) { toast.error('Selecione uma etapa'); return; }

    const payload: LeadAdsFormConfigFormData = {
      form_id:           form.form_id,
      form_name:         form.form_name,
      pipeline_id:       form.pipeline_id,
      pipeline_stage_id: form.pipeline_stage_id,
      is_active:         form.is_active,
      label_ids:         form.label_ids,
    };

    setSaving(true);
    try {
      if (editing) {
        const updated = await leadAdsFormsService.update(editing.id, payload);
        setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
        toast.success('Configuração atualizada');
      } else {
        const created = await leadAdsFormsService.create(payload);
        setConfigs(prev => [...prev, created]);
        toast.success('Configuração salva');
      }
      setModalOpen(false);
    } catch {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (cfg: LeadAdsFormConfig) => {
    try {
      const updated = await leadAdsFormsService.update(cfg.id, {
        form_id:           cfg.form_id,
        form_name:         cfg.form_name,
        pipeline_id:       cfg.pipeline_id,
        pipeline_stage_id: cfg.pipeline_stage_id,
        is_active:         !cfg.is_active,
        label_ids:         cfg.label_ids ?? [],
      });
      setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
      toast.success(updated.is_active ? 'Ativado' : 'Desativado');
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const toggleLabel = (labelId: string) =>
    setForm(f => ({
      ...f,
      label_ids: f.label_ids.includes(labelId)
        ? f.label_ids.filter(id => id !== labelId)
        : [...f.label_ids, labelId],
    }));

  // Resumo do destino (pipeline -> etapa) de uma config salva.
  const destinationSummary = (cfg: LeadAdsFormConfig): string => {
    const pipeline = resources.pipelines.find(p => p.id === cfg.pipeline_id);
    const stage = cfg.pipeline_id
      ? (resources.stagesByPipeline[cfg.pipeline_id] ?? []).find(s => s.id === cfg.pipeline_stage_id)
      : undefined;
    if (!pipeline) return 'Destino não definido';
    return `${pipeline.name} → ${stage?.name ?? '(etapa)'}`;
  };

  // Forms do Meta que ainda não têm config salva.
  const unconfiguredForms = metaForms.filter(mf => !configByFormId(mf.id));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileInput className="h-6 w-6 text-primary" />
            Formulários (Meta)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina pra onde cada formulário de Lead Ads envia os leads no CRM
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar formulários'}
        </Button>
      </div>

      {/* Aviso Meta não conectada */}
      {metaError && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Meta Ads não conectada</p>
            <p className="text-muted-foreground mt-0.5">
              Não foi possível buscar os formulários do Facebook. Conecte a página em{' '}
              <Link to="/settings/integrations/meta-ads" className="text-primary underline">
                Integrações → Meta Ads
              </Link>{' '}
              e tente sincronizar de novo.
            </p>
          </div>
        </div>
      )}

      {/* Configurações salvas */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Formulários configurados
        </h2>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
        ) : configs.length === 0 ? (
          <EmptyState
            title="Nenhum formulário configurado"
            description="Sincronize os formulários da Meta e defina pra onde cada lead vai"
          />
        ) : (
          <div className="space-y-3">
            {configs.map(cfg => (
              <div key={cfg.id} className="border border-border rounded-xl bg-card overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4">
                  <button
                    onClick={() => handleToggle(cfg)}
                    className="flex-shrink-0"
                    title={cfg.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {cfg.is_active
                      ? <ToggleRight className="h-6 w-6 text-primary" />
                      : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{cfg.form_name}</span>
                      {!cfg.is_active && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      {destinationSummary(cfg)}
                    </p>
                    {cfg.label_ids?.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1.5">
                        {cfg.label_ids.map(id => {
                          const label = resources.labels.find(l => l.id === id);
                          return (
                            <Badge key={id} variant="secondary" className="text-xs">
                              {label?.title ?? id}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <Button variant="ghost" size="icon" onClick={() => openEdit(cfg)} title="Editar">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Forms do Meta ainda sem config */}
      {syncedOnce && !metaError && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Disponíveis no Facebook
          </h2>
          {unconfiguredForms.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Todos os formulários encontrados já estão configurados.
            </div>
          ) : (
            <div className="space-y-3">
              {unconfiguredForms.map(mf => (
                <div
                  key={mf.id}
                  className="border border-dashed border-border rounded-xl bg-muted/20 flex items-center gap-4 px-5 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{mf.name}</span>
                      <Badge variant="outline" className="text-xs">{mf.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {mf.leads_count} {mf.leads_count === 1 ? 'lead' : 'leads'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openCreate(mf)}>
                    Configurar destino
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar destino do formulário' : 'Configurar destino'}</DialogTitle>
            <DialogDescription>
              Leads do formulário <strong>{form.form_name}</strong> serão enviados para o destino abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <UILabel>Pipeline *</UILabel>
              <select
                value={form.pipeline_id}
                onChange={e =>
                  setForm(f => ({ ...f, pipeline_id: e.target.value, pipeline_stage_id: '' }))
                }
                className={baseSelectClass}
              >
                <option value="">Selecione um pipeline</option>
                {resources.pipelines.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {form.pipeline_id && (
              <div>
                <UILabel>Etapa *</UILabel>
                <select
                  value={form.pipeline_stage_id}
                  onChange={e => setForm(f => ({ ...f, pipeline_stage_id: e.target.value }))}
                  className={baseSelectClass}
                >
                  <option value="">Selecione uma etapa</option>
                  {(resources.stagesByPipeline[form.pipeline_id] ?? []).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <UILabel>Etiquetas</UILabel>
              {resources.labels.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhuma etiqueta cadastrada. Crie em Configurações &rarr; Etiquetas.
                </p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-2">
                  {resources.labels.map(l => {
                    const selected = form.label_ids.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => toggleLabel(l.id)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                          selected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-input hover:text-foreground'
                        }`}
                      >
                        {l.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-input"
              />
              <UILabel htmlFor="is_active" className="cursor-pointer">Ativo</UILabel>
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
    </div>
  );
}
