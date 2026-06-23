import { useState, useEffect, useCallback } from 'react';
import { LogIn, Users, Loader2, RefreshCw, Building2, X, KeyRound, ExternalLink, Plus, Clock } from 'lucide-react';
import api from '@/services/core/api';
import NewTenantWizard from './NewTenantWizard';

interface PooledTenant {
  id: string; name: string; slug: string; status: string;
  members: number | null; login_url: string; admin_email?: string;
  settings?: Record<string, any>;
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

  useEffect(() => {
    api.get(`/super/pooled_tenants/${tenant.id}/members`)
      .then(r => setMembers(r.data?.data || []))
      .finally(() => setLoading(false));
  }, [tenant.id]);

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
      </div>
    </div>
  );
}

export default function PooledClients() {
  const [tenants, setTenants] = useState<PooledTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);
  const [membersOf, setMembersOf] = useState<PooledTenant | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/super/pooled_tenants'); setTenants(r.data?.data || []); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

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
          <button onClick={load} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
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
      {showWizard && <NewTenantWizard onClose={() => setShowWizard(false)} onCreated={load} />}
    </div>
  );
}
