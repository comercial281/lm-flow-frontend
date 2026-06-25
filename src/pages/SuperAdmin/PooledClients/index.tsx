import { useState, useEffect, useCallback } from 'react';
import { LogIn, Users, Loader2, RefreshCw, Building2, X, KeyRound, ExternalLink, Plus, Clock, Megaphone, SlidersHorizontal, Archive, ArchiveRestore, Snowflake, Play, Trash2 } from 'lucide-react';
import api from '@/services/core/api';
import NewTenantWizard from './NewTenantWizard';
import ClientBroadcastModal from './ClientBroadcastModal';

interface PooledTenant {
  id: string; name: string; slug: string; status: string;
  members: number | null; login_url: string; admin_email?: string;
  settings?: Record<string, any>; archived?: boolean;
}
interface Member { id: string; email: string; name?: string; }

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

  const setPassword = async (m: Member) => {
    const pwd = window.prompt(`Nova senha para ${m.email} (min. 8 caracteres):`);
    if (!pwd) return;
    if (pwd.length < 8) { alert('Senha precisa de ao menos 8 caracteres.'); return; }
    setSavingId(m.id);
    try {
      await api.post(`/super/pooled_tenants/${tenant.id}/set_password`, { user_id: m.id, password: pwd });
      alert(`Senha de ${m.email} trocada.`);
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
              <button onClick={() => setPassword(m)} disabled={savingId === m.id}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-white/10 text-white/60 hover:text-white hover:border-violet-500/40 disabled:opacity-50">
                {savingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                Trocar senha
              </button>
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

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/super/pooled_tenants${showArchived ? '?archived=true' : ''}`); setTenants(r.data?.data || []); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, [showArchived]);
  useEffect(() => { load(); }, [load]);

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

  // Poll enquanto algum tenant estiver provisionando (status 'trial')
  useEffect(() => {
    if (!tenants.some(t => t.status === 'trial')) return;
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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-violet-500" /> Clientes (SaaS)
          </h1>
          <p className="text-sm text-muted-foreground">Entre, gerencie membros e senhas de cada CRM.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowArchived(v => !v)}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border ${showArchived ? 'border-violet-500/50 text-violet-300 bg-violet-500/10' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            <Archive className="w-4 h-4" /> {showArchived ? 'Ativos' : 'Arquivados'}
          </button>
          <button onClick={load} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
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
        </div>
      </div>
      {loading && tenants.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tenants.map(t => {
            const st = STATUS[t.status] || { label: t.status, cls: 'bg-white/10 text-white/60 border-white/20' };
            const isProvisioning = t.status === 'trial';
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
