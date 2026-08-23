import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Loader2, RefreshCw, LogIn, Bot, Zap, MessageSquare,
  Copy, Check, X, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useClientModeStore } from '@/store/clientModeStore';
import {
  listPooledTenants, mintClientToken, tenantToClientMode,
  listTenantSequences, createTenantSequence,
  type PooledTenant, type RemoteSequence,
} from '@/services/clientMode/clientModeService';

const STATUS: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Ativo',     cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  trial:     { label: 'Trial',     cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  suspended: { label: 'Suspenso',  cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
};

// Atalhos que abrem já no contexto do cliente (após entrar).
const QUICK_LINKS = [
  { label: 'Follow-ups',   path: '/automations/follow-ups',  icon: MessageSquare },
  { label: 'Agente de IA', path: '/agents/list',             icon: Bot },
  { label: 'Automações',   path: '/automations',             icon: Zap },
];

export default function ClientMode() {
  const navigate = useNavigate();
  const { enter } = useClientModeStore();
  const [tenants, setTenants] = useState<PooledTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTenants(await listPooledTenants());
    } catch {
      toast.error('Falha ao listar clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Entra no cliente e (opcional) navega pra uma tela de config.
  const enterClient = async (t: PooledTenant, gotoPath?: string) => {
    setBusyId(t.id);
    try {
      const token = await mintClientToken(t.id);
      enter(tenantToClientMode(t), token);
      toast.success(`Modo cliente: ${t.name}`);
      navigate(gotoPath || '/');
      // reload garante que todas as instâncias axios já saiam com o token novo
      setTimeout(() => window.location.reload(), 50);
    } catch {
      toast.error('Não consegui entrar nesse cliente.');
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto text-foreground">
      <div className="flex items-center gap-3 mb-1">
        <div className="rounded-lg bg-violet-600/20 p-2">
          <Building2 className="h-5 w-5 text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold">Modo Cliente</h1>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Entre em qualquer cliente e edite follow-ups, agente de IA, textos e automações
        direto daqui — sem sair do painel. O que você editar é do cliente.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando clientes...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
            {tenants.map(t => {
              const st = STATUS[t.status] || { label: t.status, cls: 'bg-muted text-muted-foreground border-border' };
              const busy = busyId === t.id;
              return (
                <div key={t.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.slug}.lmflow.com.br</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${st.cls}`}>{st.label}</span>
                  </div>

                  {typeof t.members === 'number' && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {t.members} membros
                    </div>
                  )}

                  <button
                    onClick={() => enterClient(t)}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                    Entrar e editar
                  </button>

                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_LINKS.map(q => (
                      <button
                        key={q.path}
                        onClick={() => enterClient(t, q.path)}
                        disabled={busy}
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60 transition-colors"
                      >
                        <q.icon className="h-3 w-3" /> {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <BulkFollowup tenants={tenants} />
        </>
      )}
    </div>
  );
}

// ─── Fase 3: aplicar uma sequência de follow-up de um cliente para vários ─────

interface RowResult { slug: string; name: string; status: 'ok' | 'erro'; msg?: string; }

function BulkFollowup({ tenants }: { tenants: PooledTenant[] }) {
  const [sourceId, setSourceId] = useState('');
  const [sequences, setSequences] = useState<RemoteSequence[]>([]);
  const [seqSlug, setSeqSlug] = useState('');
  const [loadingSeq, setLoadingSeq] = useState(false);
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);

  const loadSequences = async (id: string) => {
    setSourceId(id);
    setSequences([]);
    setSeqSlug('');
    setResults([]);
    if (!id) return;
    setLoadingSeq(true);
    try {
      const t = tenants.find(x => x.id === id)!;
      const token = await mintClientToken(id);
      const seqs = await listTenantSequences(token, t.slug);
      setSequences(seqs);
      if (seqs.length === 0) toast.message('Esse cliente não tem sequências de follow-up.');
    } catch {
      toast.error('Falha ao carregar as sequências do cliente de origem.');
    } finally {
      setLoadingSeq(false);
    }
  };

  const toggleTarget = (id: string) =>
    setTargets(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const apply = async () => {
    const seq = sequences.find(s => s.slug === seqSlug);
    if (!seq) { toast.error('Escolha a sequência.'); return; }
    const targetList = tenants.filter(t => targets.has(t.id) && t.id !== sourceId);
    if (targetList.length === 0) { toast.error('Escolha pelo menos um cliente de destino.'); return; }

    setRunning(true);
    setResults([]);
    const out: RowResult[] = [];
    for (const t of targetList) {
      try {
        const token = await mintClientToken(t.id);
        await createTenantSequence(token, t.slug, seq);
        out.push({ slug: t.slug, name: t.name, status: 'ok' });
      } catch (e) {
        const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
        out.push({ slug: t.slug, name: t.name, status: 'erro', msg: msg || 'falhou' });
      }
      setResults([...out]);
    }
    setRunning(false);
    const ok = out.filter(r => r.status === 'ok').length;
    toast.success(`Aplicado em ${ok}/${targetList.length} clientes.`);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Copy className="h-4 w-4 text-violet-400" />
        <h2 className="font-semibold">Aplicar follow-up a vários clientes</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Copie uma sequência de follow-up de um cliente e replique nos que você escolher.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">1. Cliente de origem</label>
          <select
            value={sourceId}
            onChange={e => loadSequences(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">2. Sequência</label>
          <select
            value={seqSlug}
            onChange={e => setSeqSlug(e.target.value)}
            disabled={loadingSeq || sequences.length === 0}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="">{loadingSeq ? 'Carregando...' : 'Selecione...'}</option>
            {sequences.map(s => (
              <option key={s.slug} value={s.slug}>{s.name} ({s.steps?.length || 0} passos)</option>
            ))}
          </select>
        </div>
      </div>

      {seqSlug && (
        <div className="mt-4">
          <label className="text-xs font-medium text-muted-foreground">3. Aplicar nestes clientes</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {tenants.filter(t => t.id !== sourceId).map(t => {
              const on = targets.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTarget(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    on
                      ? 'border-violet-500 bg-violet-600/20 text-violet-200'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {on ? <Check className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5" />}
                  {t.name}
                </button>
              );
            })}
          </div>

          <button
            onClick={apply}
            disabled={running || targets.size === 0}
            className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Aplicar a {targets.size} cliente{targets.size === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {results.map(r => (
            <li key={r.slug} className="flex items-center gap-2">
              {r.status === 'ok'
                ? <Check className="h-4 w-4 text-emerald-400" />
                : <X className="h-4 w-4 text-red-400" />}
              <span className="font-medium">{r.name}</span>
              {r.status === 'erro' && <span className="text-red-400/80 text-xs">— {r.msg}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
