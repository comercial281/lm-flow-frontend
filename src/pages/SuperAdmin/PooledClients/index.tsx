import { useState, useEffect, useCallback } from 'react';
import { LogIn, Users, Loader2, RefreshCw, Building2, X, KeyRound, ExternalLink, Plus, Clock, Megaphone, SlidersHorizontal, Archive, ArchiveRestore, Snowflake, Play, Trash2, List, BarChart3, ScrollText, Gauge, UploadCloud, Eye, EyeOff } from 'lucide-react';
import api from '@/services/core/api';
import NewTenantWizard from './NewTenantWizard';
import ClientBroadcastModal from './ClientBroadcastModal';
import clientInstancesService, { DashboardData } from '@/services/clientInstances/clientInstancesService';
import DashboardView from '../ClientInstances/DashboardView';
import LogsView from '../ClientInstances/LogsView';
import UserMetricsView from '../ClientInstances/UserMetricsView';

type ViewTab = 'clients' | 'dashboard' | 'logs' | 'metrics';

interface PooledTenant {
  id: string; name: string; slug: string; status: string;
  members: number | null; login_url: string; admin_email?: string;
  settings?: Record<string, any>; archived?: boolean; created_at?: string;
  max_whatsapp_channels?: number; whatsapp_channels_used?: number | null;
}
interface Member { id: string; email: string; name?: string; plain_password?: string; }

const STATUS: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Ativo',         cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  trial:     { label: 'Provisionando', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  error:     { label: 'Erro',          cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  suspended: { label: 'Suspenso',      cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
};

function MembersModal({ tenant, onClose }: { tenant: PooledTenant; onClose: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [visiblePwds, setVisiblePwds] = useState<Set<string>>(new Set());
  const togglePwd = (id: string) => setVisiblePwds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const loadMembers = () =>
    api.get(`/super/pooled_tenants/${tenant.id}/members`)
      .then(r => setMembers(r.data?.data || []))
      .finally(() => setLoading(false));

  useEffect(() => { loadMembers(); }, [tenant.id]);

  const addMember = async () => {
    if (!newEmail.trim() || newPwd.length < 8) { alert('Informe e-mail e senha de ao menos 8 caracteres.'); return; }
    setAdding(true);
    try {
      await api.post(`/super/pooled_tenants/${tenant.id}/add_member`, { email: newEmail.trim(), name: newName.trim(), password: newPwd });
      alert(`Acesso criado para ${newEmail.trim()} em ${tenant.slug}.lmflow.com.br`);
      setNewEmail(''); setNewName(''); setNewPwd('');
      setLoading(true); await loadMembers();
    } catch (e: any) { alert(e?.response?.data?.error || 'Falha ao criar acesso.'); }
    finally { setAdding(false); }
  };

  const removeMember = async (m: Member) => {
    if (!window.confirm(`Remover o acesso de ${m.email}? Ele não conseguirá mais logar neste CRM.`)) return;
    setSavingId(m.id);
    try {
      await api.post(`/super/pooled_tenants/${tenant.id}/remove_member`, { user_id: m.id });
      setMembers(prev => prev.filter(x => x.id !== m.id));
    } catch (e: any) { alert(e?.response?.data?.error || 'Falha ao remover.'); }
    finally { setSavingId(null); }
  };

  const setPassword = async (m: Member) => {
    const pwd = window.prompt(`Nova senha para ${m.email} (min. 8 caracteres):`);
    if (!pwd) return;
    if (pwd.length < 8) { alert('Senha precisa de ao menos 8 caracteres.'); return; }
    setSavingId(m.id);
    try {
      await api.post(`/super/pooled_tenants/${tenant.id}/set_password`, { user_id: m.id, password: pwd });
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, plain_password: pwd } : x));
    } catch { alert('Falha ao trocar a senha.'); }
    finally { setSavingId(null); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: '#150a26', border: '1px solid rgba(124,58,237,0.25)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(124,58,237,0.18)' }}>
          <div>
            <h3 className="text-white font-semibold text-sm">Membros - {tenant.name}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{tenant.slug}.lmflow.com.br</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>
          ) : members.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum membro.</p>
          ) : members.map(m => (
            <div key={m.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white/90 truncate">{m.name || m.email}</div>
                <div className="text-xs text-white/40 truncate">{m.email}</div>
              </div>
              {m.plain_password && (
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-md" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <span className="text-xs font-mono text-white/70" style={{ minWidth: 60 }}>
                    {visiblePwds.has(m.id) ? m.plain_password : '••••••••'}
                  </span>
                  <button onClick={() => togglePwd(m.id)} className="text-white/40 hover:text-white/80 ml-1">
                    {visiblePwds.has(m.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
              <button onClick={() => setPassword(m)} disabled={savingId === m.id}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-white/10 text-white/60 hover:text-white hover:border-violet-500/40 disabled:opacity-50">
                {savingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                Trocar senha
              </button>
              {!/@lealmidia\.com\.br$/i.test(m.email) && (
                <button onClick={() => removeMember(m)} disabled={savingId === m.id} title="Remover acesso"
                  className="flex items-center justify-center p-1.5 rounded-md border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: 'rgba(124,58,237,0.18)' }}>
          <p className="text-xs font-medium text-white/70">Adicionar acesso (e-mail real do cliente)</p>
          <div className="flex gap-2">
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@cliente.com"
              className="flex-1 px-2 py-1.5 rounded text-xs text-white placeholder-white/25 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }} />
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome"
              className="w-28 px-2 py-1.5 rounded text-xs text-white placeholder-white/25 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }} />
          </div>
          <div className="flex gap-2">
            <input value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="senha (min. 8)"
              className="flex-1 px-2 py-1.5 rounded text-xs text-white placeholder-white/25 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.2)' }} />
            <button onClick={addMember} disabled={adding}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}>
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Criar acesso
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FeatureItem { key: string; label?: string; name?: string; description?: string; category?: string; }

function FeaturesModal({ tenant, onClose }: { tenant: PooledTenant; onClose: () => void }) {
  const [catalog, setCatalog] = useState<FeatureItem[]>([]);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/super/pooled_tenants/${tenant.id}/features`)
      .then(r => { setCatalog(r.data?.data?.catalog || []); setFeatures(r.data?.data?.features || {}); })
      .finally(() => setLoading(false));
  }, [tenant.id]);

  const toggle = async (key: string) => {
    const next = !features[key];
    setSavingKey(key);
    setFeatures(f => ({ ...f, [key]: next }));
    try {
      const r = await api.patch(`/super/pooled_tenants/${tenant.id}/update_features`, { features: { [key]: next } });
      setFeatures(r.data?.data?.features || {});
    } catch {
      setFeatures(f => ({ ...f, [key]: !next })); // reverte
      alert('Falha ao salvar a função.');
    } finally { setSavingKey(null); }
  };

  // Regra de ENTRADA no pipe (tenant.settings.only_ad_leads): quando ligado, só
  // entra no funil lead que veio de anúncio de verdade (ad_referral presente) —
  // orgânico fica fora. Salva via update do pooled_tenants (preserva os group_jids).
  const [onlyAds, setOnlyAds] = useState<boolean>(!!tenant.settings?.only_ad_leads);
  const [savingAds, setSavingAds] = useState(false);
  const toggleOnlyAds = async () => {
    const next = !onlyAds;
    setSavingAds(true);
    setOnlyAds(next);
    try {
      const s = tenant.settings || {};
      await api.patch(`/super/pooled_tenants/${tenant.id}`, {
        name: tenant.name,
        only_ad_leads: next,
        whatsapp_reminder_group_jid: s.whatsapp_reminder_group_jid || '',
        whatsapp_logs_group_jid: s.whatsapp_logs_group_jid || '',
      });
    } catch {
      setOnlyAds(!next);
      alert('Falha ao salvar a regra do pipe.');
    } finally { setSavingAds(false); }
  };

  // Limite de canais de WhatsApp que o cliente pode criar (0 = ilimitado).
  const [maxWa, setMaxWa] = useState<number>(Number(tenant.max_whatsapp_channels ?? tenant.settings?.max_whatsapp_channels ?? 5) || 0);
  const [savingMax, setSavingMax] = useState(false);
  const usedWa = tenant.whatsapp_channels_used;
  const saveMaxWa = async () => {
    setSavingMax(true);
    try {
      const s = tenant.settings || {};
      await api.patch(`/super/pooled_tenants/${tenant.id}`, {
        name: tenant.name,
        only_ad_leads: !!s.only_ad_leads,
        whatsapp_reminder_group_jid: s.whatsapp_reminder_group_jid || '',
        whatsapp_logs_group_jid: s.whatsapp_logs_group_jid || '',
        max_whatsapp_channels: maxWa,
      });
    } catch {
      alert('Falha ao salvar o limite de canais.');
    } finally { setSavingMax(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: '#150a26', border: '1px solid rgba(124,58,237,0.25)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(124,58,237,0.18)' }}>
          <div>
            <h3 className="text-white font-semibold text-sm">Funções - {tenant.name}</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Liga/desliga o que o cliente vê em {tenant.slug}.lmflow.com.br</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
            style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/90">Pipe só com leads de anúncio (ADS)</div>
              <div className="text-xs text-white/40">Só entra no funil o lead que veio de campanha (ad_referral). Orgânico fica fora.</div>
            </div>
            <button onClick={toggleOnlyAds} disabled={savingAds}
              className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${onlyAds ? 'bg-violet-600' : 'bg-white/15'}`}>
              {savingAds
                ? <Loader2 className="w-3 h-3 animate-spin text-white absolute top-1.5 left-3.5" />
                : <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${onlyAds ? 'left-5' : 'left-1'}`} />}
            </button>
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
            style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/90">Máximo de canais de WhatsApp</div>
              <div className="text-xs text-white/40">
                Quantas instâncias este cliente pode conectar. 0 = ilimitado.
                {typeof usedWa === 'number' && <> Usando {usedWa} de {maxWa > 0 ? maxWa : '∞'}.</>}
              </div>
            </div>
            <input type="number" min={0} value={maxWa}
              onChange={e => setMaxWa(Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
              className="w-14 px-2 py-1 rounded bg-white/10 text-white text-sm text-center outline-none flex-shrink-0" />
            <button onClick={saveMaxWa} disabled={savingMax}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white flex-shrink-0 disabled:opacity-50">
              {savingMax ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>
          ) : catalog.map(f => {
            const on = features[f.key] !== false;
            return (
              <div key={f.key} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/90 truncate">{f.label || f.name || f.key}</div>
                  {f.description && <div className="text-xs text-white/40 truncate">{f.description}</div>}
                </div>
                <button onClick={() => toggle(f.key)} disabled={savingKey === f.key}
                  className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${on ? 'bg-violet-600' : 'bg-white/15'}`}>
                  {savingKey === f.key
                    ? <Loader2 className="w-3 h-3 animate-spin text-white absolute top-1.5 left-3.5" />
                    : <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-1'}`} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PooledClients() {
  const [tenants, setTenants] = useState<PooledTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);
  const [membersOf, setMembersOf] = useState<PooledTenant | null>(null);
  const [featuresOf, setFeaturesOf] = useState<PooledTenant | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PooledTenant | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [tab, setTab] = useState<ViewTab>('clients');
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/super/pooled_tenants${showArchived ? '?archived=true' : ''}`); setTenants(r.data?.data || []); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, [showArchived]);
  useEffect(() => { load(); }, [load]);

  // Aba Dashboard: métricas por cliente (snapshots pooled-aware do SyncClientMetricsJob).
  const loadDashboard = useCallback(async () => {
    setLoadingDash(true);
    try { const r = await clientInstancesService.dashboard(); setDashData(r.data.data); }
    catch { setDashData(null); }
    finally { setLoadingDash(false); }
  }, []);
  useEffect(() => { if (tab === 'dashboard') loadDashboard(); }, [tab, loadDashboard]);

  // Arquivar a partir do card de métrica (id do ClientInstance, não do Tenant pooled).
  const handleArchiveCI = async (id: number) => {
    if (!window.confirm('Arquivar este cliente das métricas?')) return;
    try { await clientInstancesService.archive(id); loadDashboard(); } catch { alert('Falha ao arquivar.'); }
  };

  const handleSyncAll = async () => {
    if (!window.confirm('Vai fazer redeploy Vercel de TODOS os tenants ativos. Continuar?')) return;
    setSyncingAll(true);
    try {
      const res = await clientInstancesService.syncAllFrontends();
      const results = res.data.data;
      const ok = results.filter(r => r.success).map(r => r.name).join(', ');
      const fail = results.filter(r => !r.success).map(r => `${r.name}: ${r.error}`).join('\n');
      let msg = res.data.message;
      if (ok) msg += `\nOK: ${ok}`;
      if (fail) msg += `\nFalhou:\n${fail}`;
      alert(msg);
    } catch (e: any) { alert(e?.response?.data?.error ?? 'Erro ao sincronizar todos'); }
    finally { setSyncingAll(false); }
  };

  const doAction = async (t: PooledTenant, action: 'suspend' | 'unsuspend' | 'archive' | 'unarchive') => {
    setBusyId(t.id);
    try { await api.post(`/super/pooled_tenants/${t.id}/${action}`); await load(); }
    catch (e: any) { alert(e?.response?.data?.error || 'Falha na ação.'); }
    finally { setBusyId(null); }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await api.delete(`/super/pooled_tenants/${confirmDelete.id}`, { data: { confirm_slug: deleteText.trim() } });
      setConfirmDelete(null); setDeleteText(''); await load();
    } catch (e: any) { alert(e?.response?.data?.error || 'Falha ao excluir.'); }
    finally { setBusyId(null); }
  };

  // Poll só enquanto algum tenant estiver REALMENTE provisionando (trial recém-criado),
  // não pra trial legado já provisionado (senão pollava pra sempre).
  useEffect(() => {
    const stillProvisioning = tenants.some(t =>
      t.status === 'trial' && t.created_at && (Date.now() - Date.parse(t.created_at)) < 15 * 60 * 1000,
    );
    if (!stillProvisioning) return;
    const timer = setTimeout(load, 4000);
    return () => clearTimeout(timer);
  }, [tenants, load]);

  const enter = async (t: PooledTenant) => {
    setEntering(t.id);
    try {
      const r = await api.post(`/super/pooled_tenants/${t.id}/sso`);
      const url = r.data?.data?.url;
      if (url) window.open(url, '_blank');
      else alert('Falha ao gerar acesso.');
    } catch { alert('Falha ao entrar no CRM do cliente.'); }
    finally { setEntering(null); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-violet-500" /> Clientes (SaaS)
            </h1>
            <p className="text-sm text-muted-foreground">Entre, gerencie membros, métricas e logs de cada CRM.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => (tab === 'dashboard' ? loadDashboard() : load())}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground">
              <RefreshCw className={`w-4 h-4 ${loading || loadingDash ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            <button onClick={handleSyncAll} disabled={syncingAll}
              title="Redeploy Vercel de todos os tenants (atualiza todos com o código da raiz)"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50">
              {syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {syncingAll ? 'Sincronizando...' : 'Sync Todos'}
            </button>
            {tab === 'clients' && (
              <>
                <button onClick={() => setShowArchived(v => !v)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border ${showArchived ? 'border-violet-500/50 text-violet-300 bg-violet-500/10' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  <Archive className="w-4 h-4" /> {showArchived ? 'Ativos' : 'Arquivados'}
                </button>
                <button onClick={() => setShowBroadcast(true)} disabled={tenants.length === 0}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-md border border-violet-500/40 text-violet-300 hover:bg-violet-500/10 disabled:opacity-40">
                  <Megaphone className="w-4 h-4" /> Comunicado
                </button>
                <button onClick={() => setShowWizard(true)}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-md font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)' }}>
                  <Plus className="w-4 h-4" /> Novo Cliente
                </button>
              </>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1 border-b">
          {([
            { id: 'clients', label: 'Clientes', Icon: List },
            { id: 'dashboard', label: 'Dashboard', Icon: BarChart3 },
            { id: 'logs', label: 'Logs', Icon: ScrollText },
            { id: 'metrics', label: 'Métricas de Uso', Icon: Gauge },
          ] as { id: ViewTab; label: string; Icon: typeof List }[]).map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === id ? 'border-violet-500 text-violet-400' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
      {tab === 'dashboard' ? (
        <DashboardView data={dashData} loading={loadingDash} onArchive={handleArchiveCI} />
      ) : tab === 'logs' ? (
        <div className="h-full"><LogsView /></div>
      ) : tab === 'metrics' ? (
        <div className="h-full"><UserMetricsView /></div>
      ) : loading && tenants.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 max-w-5xl mx-auto">
          {tenants.map(t => {
            // "Provisionando" = status trial SÓ durante a janela real (criado há
            // pouco). Tenant trial antigo já está provisionado (o job vira pra
            // active no fim; legados ficam trial) — não pode travar o "Entrar".
            const createdMs = t.created_at ? Date.parse(t.created_at) : 0;
            const isProvisioning = t.status === 'trial' && createdMs > 0 && (Date.now() - createdMs) < 15 * 60 * 1000;
            const st = isProvisioning
              ? STATUS.trial
              : (STATUS[t.status === 'trial' ? 'active' : t.status] || { label: t.status, cls: 'bg-white/10 text-white/60 border-white/20' });
            return (
              <div key={t.id} className="rounded-xl p-4 border" style={{ background: 'rgba(124,58,237,0.04)', borderColor: 'rgba(124,58,237,0.15)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate flex items-center gap-2">
                      {t.name}
                      {isProvisioning && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 flex-shrink-0" />}
                    </div>
                    <a href={`https://${t.slug}.lmflow.com.br`} target="_blank" rel="noreferrer"
                      className="text-xs text-violet-400 hover:underline flex items-center gap-1 truncate">
                      {t.slug}.lmflow.com.br <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border flex-shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
                {isProvisioning ? (
                  <p className="text-xs text-blue-300/70 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Criando schema e configurando... aguarde.
                  </p>
                ) : (
                  <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {t.members ?? '?'} membro(s)
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => enter(t)} disabled={entering === t.id || isProvisioning}
                    className="lmf-btn-shimmer flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-40">
                    {entering === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    {isProvisioning ? 'Aguardando...' : 'Entrar'}
                  </button>
                  <button onClick={() => setMembersOf(t)} disabled={isProvisioning}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm border border-border text-muted-foreground hover:text-foreground disabled:opacity-40">
                    <Users className="w-4 h-4" /> Membros
                  </button>
                  <button onClick={() => setFeaturesOf(t)} disabled={isProvisioning}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm border border-border text-muted-foreground hover:text-foreground disabled:opacity-40">
                    <SlidersHorizontal className="w-4 h-4" /> Funções
                  </button>
                </div>
                <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
                  {t.status === 'suspended' && !t.archived ? (
                    <button onClick={() => doAction(t, 'unsuspend')} disabled={busyId === t.id}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">
                      <Play className="w-3.5 h-3.5" /> Descongelar
                    </button>
                  ) : !t.archived ? (
                    <button onClick={() => doAction(t, 'suspend')} disabled={busyId === t.id || isProvisioning}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50">
                      <Snowflake className="w-3.5 h-3.5" /> Congelar
                    </button>
                  ) : null}
                  {t.archived ? (
                    <button onClick={() => doAction(t, 'unarchive')} disabled={busyId === t.id}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-violet-500/30 text-violet-300 hover:bg-violet-500/10 disabled:opacity-50">
                      <ArchiveRestore className="w-3.5 h-3.5" /> Desarquivar
                    </button>
                  ) : (
                    <button onClick={() => doAction(t, 'archive')} disabled={busyId === t.id || isProvisioning}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50">
                      <Archive className="w-3.5 h-3.5" /> Arquivar
                    </button>
                  )}
                  <button onClick={() => { setConfirmDelete(t); setDeleteText(''); }} disabled={busyId === t.id}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 ml-auto">
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              </div>
            );
          })}
          {tenants.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum cliente ainda.</p>
          )}
        </div>
      )}
      </div>
      {membersOf && <MembersModal tenant={membersOf} onClose={() => setMembersOf(null)} />}
      {featuresOf && <FeaturesModal tenant={featuresOf} onClose={() => setFeaturesOf(null)} />}
      {showWizard && <NewTenantWizard onClose={() => setShowWizard(false)} onCreated={load} />}
      {showBroadcast && <ClientBroadcastModal tenants={tenants} onClose={() => setShowBroadcast(false)} />}
      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ background: '#150a26', border: '1px solid rgba(239,68,68,0.4)' }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(239,68,68,0.25)' }}>
              <h3 className="text-red-400 font-bold text-sm flex items-center gap-2"><Trash2 className="w-4 h-4" /> Excluir cliente — irreversível</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-white/80">
                Isso <strong>apaga permanentemente</strong> o CRM de <strong>{confirmDelete.name}</strong> e <strong>todos os dados</strong> (conversas, leads, pipeline). Não tem volta.
              </p>
              <p className="text-xs text-white/50">Pra confirmar, digite o slug exato: <code className="text-red-300">{confirmDelete.slug}</code></p>
              <input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder={confirmDelete.slug} autoFocus
                className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-white/25 outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(239,68,68,0.3)' }} />
            </div>
            <div className="flex justify-between px-5 py-4 border-t" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
              <button onClick={() => setConfirmDelete(null)} className="text-sm px-4 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white">Cancelar</button>
              <button onClick={doDelete} disabled={busyId === confirmDelete.id || deleteText.trim() !== confirmDelete.slug}
                className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg font-semibold text-white disabled:opacity-40" style={{ background: '#dc2626' }}>
                {busyId === confirmDelete.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
