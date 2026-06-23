import { useState, useEffect } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { X, ChevronRight, ChevronLeft, Plus, Trash2, Loader2, Check } from 'lucide-react';
import api from '@/services/core/api';

interface WaGroup { jid: string; name: string; }
interface AutomationTemplate { id: string; slug: string; name: string; description: string; category: string; }
interface ExtraUser { email: string; name: string; }

interface ProvisionData {
  templates: AutomationTemplate[];
  whatsapp_groups: WaGroup[];
}

interface WizardState {
  name: string;
  admin_name: string;
  admin_email: string;
  phone: string;
  slug: string;
  extra_users: ExtraUser[];
  notify_email: boolean;
  notify_whatsapp: boolean;
  only_ad_leads: boolean;
  whatsapp_reminder_group_jid: string;
  whatsapp_logs_group_jid: string;
  template_ids: string[];
}

const STEPS = ['Dados', 'Acesso', 'Leads', 'Templates'];

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function NewTenantWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [provisionData, setProvisionData] = useState<ProvisionData>({ templates: [], whatsapp_groups: [] });
  const [loadingData, setLoadingData] = useState(true);

  const [state, setState] = useState<WizardState>({
    name: '', admin_name: '', admin_email: '', phone: '', slug: '',
    extra_users: [], notify_email: true, notify_whatsapp: false,
    only_ad_leads: false, whatsapp_reminder_group_jid: '', whatsapp_logs_group_jid: '',
    template_ids: [],
  });

  useEffect(() => {
    api.get('/super/pooled_tenants/provision_data')
      .then(r => setProvisionData(r.data?.data || { templates: [], whatsapp_groups: [] }))
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, []);

  const set = (k: keyof WizardState, v: any) => setState(s => ({ ...s, [k]: v }));

  const canNext = () => {
    if (step === 0) return !!(state.name.trim() && state.admin_email.trim());
    return true;
  };

  const submit = async () => {
    setSaving(true); setError('');
    try {
      await api.post('/super/pooled_tenants', {
        name:                        state.name,
        admin_name:                  state.admin_name,
        admin_email:                 state.admin_email,
        phone:                       state.phone,
        slug:                        state.slug || undefined,
        only_ad_leads:               state.only_ad_leads,
        whatsapp_reminder_group_jid: state.whatsapp_reminder_group_jid || undefined,
        whatsapp_logs_group_jid:     state.whatsapp_logs_group_jid || undefined,
        notify_email:                state.notify_email,
        notify_whatsapp:             state.notify_whatsapp,
        template_ids:                state.template_ids,
        extra_users:                 state.extra_users.filter(u => u.email),
      });
      onCreated();
      onClose();
    } catch (e: any) {
      const d = e?.response?.data;
      setError(d?.errors?.join(', ') ?? d?.error ?? 'Erro ao criar cliente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0f0520', border: '1px solid rgba(124,58,237,0.3)', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(124,58,237,0.2)' }}>
          <div>
            <h2 className="text-white font-bold text-base">Novo Cliente</h2>
            <div className="flex gap-2 mt-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < step ? 'bg-violet-600 text-white' : i === step ? 'bg-violet-500 text-white' : 'bg-white/10 text-white/40'}`}>
                    {i < step ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className={`text-xs ${i === step ? 'text-violet-300' : 'text-white/30'}`}>{s}</span>
                  {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-white/20" />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && <StepDados state={state} set={set} />}
          {step === 1 && <StepAcesso state={state} set={set} setState={setState} />}
          {step === 2 && <StepLeads state={state} set={set} groups={provisionData.whatsapp_groups} loading={loadingData} />}
          {step === 3 && <StepTemplates state={state} set={set} templates={provisionData.templates} loading={loadingData} />}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t" style={{ borderColor: 'rgba(124,58,237,0.2)' }}>
          <button onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20">
            <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancelar' : 'Voltar'}
          </button>

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
              className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}>
              Proximo <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={submit} disabled={saving || !canNext()}
              className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : <><Check className="w-4 h-4" /> Criar CRM</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-white/70">{label}</label>
      {children}
      {hint && <p className="text-xs text-white/30">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-white/25 outline-none focus:ring-1 focus:ring-violet-500"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }} />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-violet-600' : 'bg-white/10'}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-5' : 'left-1'}`} />
      </div>
      <span className="text-sm text-white/80">{label}</span>
    </label>
  );
}

function GroupSelect({ value, onChange, groups, placeholder, loading }: { value: string; onChange: (v: string) => void; groups: WaGroup[]; placeholder: string; loading?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-violet-500"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }}>
      <option value="" style={{ background: '#150a26' }}>{loading ? 'Carregando grupos...' : placeholder}</option>
      {groups.map(g => <option key={g.jid} value={g.jid} style={{ background: '#150a26' }}>{g.name}</option>)}
    </select>
  );
}

function StepDados({ state, set }: { state: WizardState; set: (k: keyof WizardState, v: any) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Nome da imobiliaria *">
        <TextInput value={state.name} onChange={v => { set('name', v); if (!state.slug) set('slug', slugify(v)); }} placeholder="Ex: Imobiliaria Casa Grande" />
      </Field>
      <Field label="Nome do responsavel">
        <TextInput value={state.admin_name} onChange={v => set('admin_name', v)} placeholder="Ex: Joao Silva" />
      </Field>
      <Field label="E-mail de acesso (admin) *">
        <TextInput type="email" value={state.admin_email} onChange={v => set('admin_email', v)} placeholder="joao@casagrande.com.br" />
      </Field>
      <Field label="Telefone" hint="Para notificacao de boas-vindas no WhatsApp">
        <TextInput value={state.phone} onChange={v => set('phone', v)} placeholder="(11) 99999-9999" />
      </Field>
      <Field label="Slug do CRM" hint={`URL: ${(state.slug || slugify(state.name || 'cliente'))}.lmflow.com.br`}>
        <TextInput value={state.slug || slugify(state.name)} onChange={v => set('slug', slugify(v))} placeholder="casa-grande" />
      </Field>
    </div>
  );
}

function StepAcesso({ state, set, setState }: { state: WizardState; set: (k: keyof WizardState, v: any) => void; setState: Dispatch<SetStateAction<WizardState>> }) {
  const addUser = () => setState(s => ({ ...s, extra_users: [...s.extra_users, { email: '', name: '' }] }));
  const removeUser = (i: number) => setState(s => ({ ...s, extra_users: s.extra_users.filter((_, j) => j !== i) }));
  const updateUser = (i: number, k: keyof ExtraUser, v: string) =>
    setState(s => ({ ...s, extra_users: s.extra_users.map((u, j) => j === i ? { ...u, [k]: v } : u) }));

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-white/70">Usuarios extras</label>
          <button onClick={addUser} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
        {state.extra_users.length === 0 && (
          <p className="text-xs text-white/25 py-2">Nenhum usuario extra. O admin ja e criado automaticamente.</p>
        )}
        {state.extra_users.map((u, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <TextInput value={u.email} onChange={v => updateUser(i, 'email', v)} placeholder="email@empresa.com" />
            <TextInput value={u.name} onChange={v => updateUser(i, 'name', v)} placeholder="Nome" />
            <button onClick={() => removeUser(i)} className="text-white/30 hover:text-red-400 flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <p className="text-xs font-medium text-white/70">Notificacoes de boas-vindas</p>
        <Toggle checked={state.notify_email} onChange={v => set('notify_email', v)} label="Enviar e-mail com credenciais" />
        <Toggle checked={state.notify_whatsapp} onChange={v => set('notify_whatsapp', v)} label="Avisar no WhatsApp com link de acesso" />
        {state.notify_whatsapp && !state.phone && (
          <p className="text-xs text-amber-400">Preencha o telefone no passo anterior para enviar WA.</p>
        )}
      </div>
    </div>
  );
}

function StepLeads({ state, set, groups, loading }: { state: WizardState; set: (k: keyof WizardState, v: any) => void; groups: WaGroup[]; loading: boolean }) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-xs font-medium text-white/70">Entrada no pipeline CRM</p>
        <Toggle checked={state.only_ad_leads} onChange={v => set('only_ad_leads', v)}
          label="So leads de anuncio (Meta Ads) entram no pipeline" />
        {!state.only_ad_leads && (
          <p className="text-xs text-white/30">Todos os leads (anuncio e organico) entrarao automaticamente no pipeline.</p>
        )}
      </div>

      <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <p className="text-xs font-medium text-white/70">Grupos WhatsApp</p>
        <Field label="Grupo para lembretes e notificacoes do cliente">
          <GroupSelect value={state.whatsapp_reminder_group_jid} onChange={v => set('whatsapp_reminder_group_jid', v)}
            groups={groups} placeholder="Selecionar grupo..." loading={loading} />
        </Field>
        <Field label="Grupo de logs internos (Leal Midia)">
          <GroupSelect value={state.whatsapp_logs_group_jid} onChange={v => set('whatsapp_logs_group_jid', v)}
            groups={groups} placeholder="Selecionar grupo..." loading={loading} />
        </Field>
      </div>
    </div>
  );
}

function StepTemplates({ state, set, templates, loading }: { state: WizardState; set: (k: keyof WizardState, v: any) => void; templates: AutomationTemplate[]; loading: boolean }) {
  const toggle = (id: string) => {
    const ids = state.template_ids.includes(id)
      ? state.template_ids.filter(x => x !== id)
      : [...state.template_ids, id];
    set('template_ids', ids);
  };

  const byCategory = templates.reduce<Record<string, AutomationTemplate[]>>((acc, t) => {
    const cat = t.category || 'outros';
    acc[cat] = [...(acc[cat] || []), t];
    return acc;
  }, {});

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>;

  if (templates.length === 0) return (
    <p className="text-sm text-white/40 text-center py-10">Nenhum template disponivel. Seed a biblioteca de automacoes primeiro.</p>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/50">Selecione as automacoes que serao aplicadas automaticamente ao criar o CRM.</p>
      {Object.entries(byCategory).map(([cat, tpls]) => (
        <div key={cat}>
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-2">{cat}</p>
          <div className="space-y-1.5">
            {tpls.map(t => {
              const checked = state.template_ids.includes(t.id);
              return (
                <label key={t.id} onClick={() => toggle(t.id)}
                  className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                  style={{ background: checked ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${checked ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
                  <div className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center ${checked ? 'bg-violet-600' : 'bg-white/10'}`}>
                    {checked && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{t.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">{t.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {state.template_ids.length > 0 && (
        <p className="text-xs text-violet-400">{state.template_ids.length} template(s) selecionado(s)</p>
      )}
    </div>
  );
}
