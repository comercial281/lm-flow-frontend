import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Building2, Server, Users, Clock, MousePointerClick, Monitor,
  Circle, ArrowLeft, RefreshCw,
} from 'lucide-react';
import superLogsService, {
  LogClient, UserMetricsResponse, UserMetricDetail,
} from '@/services/superLogs/superLogsService';

function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 1) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function Bar({ value, max, label, right }: { value: number; max: number; label: string; right: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="truncate text-foreground">{label}</span>
        <span className="text-muted-foreground shrink-0 ml-2">{right}</span>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DetailPanel({ client, userId, onBack }: { client: string; userId: string; onBack: () => void }) {
  const [data, setData] = useState<UserMetricDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    superLogsService.userMetricDetail(client, userId)
      .then(r => setData(r.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [client, userId]);

  if (loading) return <div className="flex items-center justify-center h-60 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...</div>;
  if (!data) return <div className="flex items-center justify-center h-60 text-muted-foreground">Sem dados</div>;

  const maxScreen = Math.max(1, ...data.time_per_screen.map(s => s.seconds));
  const maxHour = Math.max(1, ...data.hourly.map(h => h.accesses));
  const maxEl = Math.max(1, ...data.top_elements.map(e => e.clicks));

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div>
        <h3 className="text-lg font-bold">{data.user.name || data.user.email || 'Usuário'}</h3>
        <p className="text-sm text-muted-foreground">{data.user.email}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Acessos</p>
          <p className="text-xl font-bold">{data.totals.accesses}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Tempo total</p>
          <p className="text-xl font-bold">{fmtDuration(data.totals.total_seconds)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Cliques</p>
          <p className="text-xl font-bold">{data.totals.total_clicks}</p>
        </div>
      </div>

      {/* Tempo por tela */}
      <div>
        <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Monitor className="h-4 w-4 text-primary" /> Tempo por tela</p>
        {data.time_per_screen.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados ainda</p> :
          data.time_per_screen.map(s => (
            <Bar key={s.screen} value={s.seconds} max={maxScreen} label={s.screen} right={`${fmtDuration(s.seconds)} • ${s.visits}x`} />
          ))}
      </div>

      {/* Histograma por hora */}
      <div>
        <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> Acessos por hora do dia</p>
        <div className="flex items-end gap-0.5 h-24">
          {data.hourly.map(h => (
            <div key={h.hour} className="flex-1 flex flex-col items-center justify-end" title={`${h.hour}h: ${h.accesses} acessos`}>
              <div className="w-full bg-primary/70 rounded-t" style={{ height: `${Math.round((h.accesses / maxHour) * 100)}%` }} />
              {h.hour % 6 === 0 && <span className="text-[9px] text-muted-foreground mt-0.5">{h.hour}h</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Elementos mais clicados */}
      <div>
        <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><MousePointerClick className="h-4 w-4 text-primary" /> Mais clicados</p>
        {data.top_elements.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados ainda</p> :
          data.top_elements.slice(0, 12).map(e => (
            <Bar key={e.label} value={e.clicks} max={maxEl} label={e.label} right={`${e.clicks}`} />
          ))}
      </div>

      {/* Sessões */}
      <div>
        <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" /> Sessões recentes</p>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="text-left px-2 py-1.5">Início</th>
                <th className="text-left px-2 py-1.5">Duração</th>
                <th className="text-left px-2 py-1.5">Telas</th>
                <th className="text-left px-2 py-1.5">Cliques</th>
                <th className="text-left px-2 py-1.5">Fim</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.slice(0, 30).map(s => (
                <tr key={s.id} className="border-t">
                  <td className="px-2 py-1.5">{fmtDate(s.started_at)}</td>
                  <td className="px-2 py-1.5">{fmtDuration(s.duration_seconds)}</td>
                  <td className="px-2 py-1.5">{s.screens}</td>
                  <td className="px-2 py-1.5">{s.clicks}</td>
                  <td className="px-2 py-1.5">
                    {s.online ? <span className="text-emerald-600 flex items-center gap-1"><Circle className="h-2 w-2 fill-emerald-500" /> online</span> : (s.end_reason || 'encerrada')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function UserMetricsView() {
  const [clients, setClients] = useState<LogClient[]>([]);
  const [client, setClient] = useState('master');
  const [data, setData] = useState<UserMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSelectedUser(null);
    try {
      const res = await superLogsService.userMetrics(client);
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    superLogsService.logClients().then(r => setClients(r.data.data.clients)).catch(() => setClients([{ id: 'master', name: 'Principal', master: true }]));
  }, []);

  useEffect(() => { load(); }, [load]);

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
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...</div>
        ) : selectedUser ? (
          <DetailPanel client={client} userId={selectedUser} onBack={() => setSelectedUser(null)} />
        ) : !data || data.users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Users className="h-8 w-8 opacity-30" /> {data?.unavailable ? 'Métricas indisponíveis neste cliente' : 'Nenhum acesso registrado ainda'}
          </div>
        ) : (
          <>
            {/* Overview */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-muted/50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Usuários</p><p className="text-xl font-bold">{data.overview.total_users}</p></div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3"><p className="text-xs text-emerald-700 dark:text-emerald-400">Online agora</p><p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{data.overview.online_now}</p></div>
              <div className="bg-muted/50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Acessos</p><p className="text-xl font-bold">{data.overview.total_accesses}</p></div>
              <div className="bg-muted/50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Tempo total</p><p className="text-xl font-bold">{fmtDuration(data.overview.total_seconds)}</p></div>
            </div>

            <div className="flex justify-end mb-2">
              <button onClick={load} className="flex items-center gap-1 text-xs px-2 py-1 rounded border text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /> Atualizar</button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-muted-foreground text-xs">
                  <tr>
                    <th className="text-left px-3 py-2">Usuário</th>
                    <th className="text-left px-3 py-2">Acessos</th>
                    <th className="text-left px-3 py-2">Tempo total</th>
                    <th className="text-left px-3 py-2">Médio</th>
                    <th className="text-left px-3 py-2">Cliques</th>
                    <th className="text-left px-3 py-2">Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map(u => (
                    <tr key={u.user_id} onClick={() => setSelectedUser(u.user_id)} className="border-t hover:bg-muted/40 cursor-pointer">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {u.online && <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />}
                          <div className="min-w-0">
                            <p className="font-medium truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">{u.accesses}</td>
                      <td className="px-3 py-2">{fmtDuration(u.total_seconds)}</td>
                      <td className="px-3 py-2">{fmtDuration(u.avg_seconds)}</td>
                      <td className="px-3 py-2">{u.clicks}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
