import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, RefreshCw, Search, Radio, Building2, Server, ChevronDown,
  AlertTriangle, XCircle, CheckCircle2, Info, Filter, Plug,
  Users, Circle, EyeOff, Eye, BarChart3,
} from 'lucide-react';
import superLogsService, {
  ActivityEvent, LogClient, ActivityParams, UserMetricsResponse,
} from '@/services/superLogs/superLogsService';

function fmtDur(seconds: number): string {
  if (!seconds || seconds < 60) return `${Math.max(0, seconds | 0)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Faixa de presença: quem está online / usando, no cliente selecionado.
function PresenceStrip({ client, includeInternal }: { client: string; includeInternal: boolean }) {
  const [data, setData] = useState<UserMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    superLogsService.userMetrics(client, includeInternal)
      .then(r => { if (alive) setData(r.data.data); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [client, includeInternal]);

  const online = (data?.users || []).filter(u => u.online);
  const ov = data?.overview;

  return (
    <div className="rounded-lg border bg-card p-3 mb-3">
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Circle className={`h-2.5 w-2.5 ${online.length ? 'fill-emerald-500 text-emerald-500' : 'fill-muted text-muted'}`} />
          {loading ? '...' : `${online.length} online agora`}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {ov?.total_users ?? 0} usuários
        </span>
        <span className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
          {ov?.total_accesses ?? 0} acessos · {fmtDur(ov?.total_seconds ?? 0)} de uso
        </span>
        <button
          onClick={() => navigate(`/admin/uso?client=${encodeURIComponent(client)}`)}
          className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <BarChart3 className="h-3.5 w-3.5" /> Uso detalhado
        </button>
      </div>
      {online.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {online.slice(0, 8).map(u => (
            <span key={u.user_id} className="flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 text-xs">
              <Circle className="h-1.5 w-1.5 fill-emerald-500 text-emerald-500" />
              {u.name || u.email || 'Usuário'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const LEVEL_STYLE: Record<string, { color: string; Icon: typeof Info }> = {
  error:   { color: 'text-red-600',     Icon: XCircle },
  warning: { color: 'text-amber-600',   Icon: AlertTriangle },
  success: { color: 'text-emerald-600', Icon: CheckCircle2 },
  info:    { color: 'text-blue-600',    Icon: Info },
};

const CATEGORY_LABEL: Record<string, string> = {
  lead: 'Lead', conversation: 'Conversa', message: 'Mensagem', automation: 'Automação',
  channel: 'Instância', auth: 'Acesso', contact: 'Contato', pipeline: 'Funil',
  request: 'Sistema', system: 'Sistema',
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return iso; }
}

function EventRow({ ev }: { ev: ActivityEvent }) {
  const [open, setOpen] = useState(false);
  const style = LEVEL_STYLE[ev.level] || LEVEL_STYLE.info;
  const { Icon } = style;
  const hasMeta = ev.metadata && Object.keys(ev.metadata).length > 0;

  return (
    <div className="border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors">
      <button
        onClick={() => hasMeta && setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-3 py-2 text-left"
      >
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${style.color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">{ev.title}</span>
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {CATEGORY_LABEL[ev.category] || ev.category}
            </span>
            {ev.http?.status && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${ev.http.status >= 400 ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                {ev.http.method} {ev.http.status}
              </span>
            )}
          </div>
          {ev.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{ev.description}</p>}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <span>{fmtTime(ev.occurred_at)}</span>
            {ev.actor?.name && <span>• {ev.actor.name}</span>}
            {ev.ip_address && <span>• {ev.ip_address}</span>}
          </div>
          {open && hasMeta && (
            <pre className="mt-2 text-[11px] bg-muted/60 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap break-all">
              {JSON.stringify(ev.metadata, null, 2)}
            </pre>
          )}
        </div>
        {hasMeta && <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
    </div>
  );
}

export default function LogsView() {
  const [clients, setClients] = useState<LogClient[]>([]);
  const [client, setClient] = useState<string>('master');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [live, setLive] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [includeRaw, setIncludeRaw] = useState(false);
  const [includeInternal, setIncludeInternal] = useState(false);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const newestRef = useRef<string | null>(null);
  const liveTimer = useRef<number | undefined>(undefined);

  const baseParams = useCallback((): ActivityParams => ({
    client,
    q: q || undefined,
    category: category || undefined,
    level: level || undefined,
    include_raw: includeRaw || undefined,
    include_internal: includeInternal || undefined,
  }), [client, q, category, level, includeRaw, includeInternal]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superLogsService.activity({ ...baseParams(), limit: 80 });
      const data = res.data.data;
      setEvents(data.events);
      setCategories(data.categories || {});
      newestRef.current = data.events[0]?.occurred_at || data.server_time;
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Falha ao carregar logs');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [baseParams]);

  // Tail ao vivo: busca só o que é mais novo que o último evento.
  const poll = useCallback(async () => {
    if (!newestRef.current) return;
    try {
      const res = await superLogsService.activity({ ...baseParams(), since: newestRef.current, limit: 100 });
      const fresh = res.data.data.events;
      if (fresh.length) {
        newestRef.current = fresh[fresh.length - 1].occurred_at;
        setEvents(prev => [...fresh.slice().reverse(), ...prev].slice(0, 500));
      }
    } catch { /* silencioso */ }
  }, [baseParams]);

  const loadMore = useCallback(async () => {
    const oldest = events[events.length - 1]?.occurred_at;
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const res = await superLogsService.activity({ ...baseParams(), before: oldest, limit: 80 });
      setEvents(prev => [...prev, ...res.data.data.events]);
    } catch { /* noop */ } finally {
      setLoadingMore(false);
    }
  }, [events, baseParams]);

  useEffect(() => {
    superLogsService.logClients().then(r => setClients(r.data.data.clients)).catch(() => setClients([
      { id: 'master', name: 'Principal', master: true },
    ]));
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  useEffect(() => {
    if (liveTimer.current) window.clearInterval(liveTimer.current);
    if (live) liveTimer.current = window.setInterval(poll, 5000);
    return () => { if (liveTimer.current) window.clearInterval(liveTimer.current); };
  }, [live, poll]);

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Menu de clientes */}
      <div className="w-56 shrink-0 border-r pr-3 overflow-auto">
        <p className="text-xs font-semibold text-muted-foreground px-1 mb-2 uppercase tracking-wide">Clientes</p>
        <div className="space-y-1">
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => setClient(c.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                client === c.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {c.master ? <Server className="h-3.5 w-3.5 shrink-0" /> : <Building2 className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{c.name}</span>
              {!c.master && c.has_backend === false && <Plug className="h-3 w-3 text-amber-500 ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Presença: quem está online / usando agora */}
        <PresenceStrip client={client} includeInternal={includeInternal} />

        {/* Controles */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadInitial()}
              placeholder="Buscar no log..."
              className="w-full pl-7 pr-2 py-1.5 text-sm rounded border bg-background"
            />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} className="text-sm rounded border bg-background px-2 py-1.5">
            <option value="">Todas categorias</option>
            {Object.keys(CATEGORY_LABEL).filter((v, i, a) => a.indexOf(v) === i).map(c => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}{categories[c] ? ` (${categories[c]})` : ''}</option>
            ))}
          </select>
          <select value={level} onChange={e => setLevel(e.target.value)} className="text-sm rounded border bg-background px-2 py-1.5">
            <option value="">Todos níveis</option>
            <option value="error">Erro</option>
            <option value="warning">Alerta</option>
            <option value="success">Sucesso</option>
            <option value="info">Info</option>
          </select>
          <button
            onClick={() => setIncludeRaw(v => !v)}
            title="Mostrar requisições cruas de API (mais ruído)"
            className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded border transition-colors ${includeRaw ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'}`}
          >
            <Filter className="h-3.5 w-3.5" /> Cruas
          </button>
          <button
            onClick={() => setIncludeInternal(v => !v)}
            title="Mostrar acessos e ações da Leal Mídia (você e a equipe). Por padrão, a tela mostra só os clientes."
            className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded border transition-colors ${includeInternal ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'}`}
          >
            {includeInternal ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} Leal Mídia
          </button>
          <button
            onClick={() => setLive(v => !v)}
            className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded border transition-colors ${live ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'text-muted-foreground'}`}
          >
            <Radio className={`h-3.5 w-3.5 ${live ? 'animate-pulse' : ''}`} /> {live ? 'Ao vivo' : 'Pausado'}
          </button>
          <button onClick={loadInitial} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded border text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 min-h-0 overflow-auto border rounded-lg bg-card">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <AlertTriangle className="h-8 w-8 text-amber-500" /> {error}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <Info className="h-8 w-8 opacity-30" /> Nenhum evento ainda
            </div>
          ) : (
            <>
              {events.map(ev => <EventRow key={ev.id} ev={ev} />)}
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : 'Carregar mais antigos'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
