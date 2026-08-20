import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Radio, RefreshCw, Loader2, AlertTriangle, X, BellRing, BellOff,
  Volume2, VolumeX, Phone, PhoneOff, Pause, Play, Maximize2, Minimize2,
  GitBranch, Megaphone,
} from 'lucide-react';
import { Badge, Button } from '@/components/ui/ds';
import superLeadsFeedService, {
  type LeadFeedItem,
  type LeadsFeedClient,
  type LeadsFeedData,
} from '@/services/superLeadsFeed/superLeadsFeedService';

/** Intervalo do poll. Não é WebSocket de propósito: não existe canal
 *  cross-tenant no backend (ver o comentário do LeadsFeedController). */
const POLL_MS = 15_000;
/** Janela da carga inicial e teto do buffer em memória. */
const INITIAL_HOURS = 12;
const MAX_CARDS = 300;

const CLIENT_COLORS = [
  '#7c3aed', '#6366f1', '#0ea5e9', '#14b8a6',
  '#f59e0b', '#ec4899', '#84cc16', '#f43f5e',
];

const SILENCE_OPTIONS = [30, 60, 120, 240];

/** Cor estável por cliente: mesmo slug => sempre a mesma cor, sem depender da
 *  ordem em que os clientes chegaram na resposta. */
function clientColor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) hash = (hash * 31 + slug.charCodeAt(i)) % 100_000;
  return CLIENT_COLORS[hash % CLIENT_COLORS.length];
}

/** Mesmo formato do painel de Monitoramento. */
function ageLabel(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return 'sem registro';
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
}

/** Estado espelhado no localStorage: as preferências do mural têm que
 *  sobreviver ao recarregar — em especial o alerta ocultado. */
function usePersisted<T>(key: string, initial: T) {
  const storageKey = `lmflow.leadsFeed.${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* localStorage cheio/bloqueado não pode quebrar a tela */
    }
  }, [storageKey, value]);
  return [value, setValue] as const;
}

/** Bipe curto via WebAudio — evita adicionar um binário de áudio ao repo. */
function playBeep() {
  try {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => ctx.close().catch(() => undefined);
  } catch {
    /* som é enfeite, nunca erro de tela */
  }
}

export default function LeadsFeed() {
  const [leads, setLeads] = useState<LeadFeedItem[]>([]);
  const [clients, setClients] = useState<LeadsFeedClient[]>([]);
  const [overview, setOverview] = useState<LeadsFeedData['overview'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [paused, setPaused] = useState(false);
  const [mural, setMural] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  /** Só pra recalcular os "há X min" sem precisar de resposta do servidor. */
  const [now, setNow] = useState(() => Date.now());

  // Preferências persistidas
  const [alertsHidden, setAlertsHidden] = usePersisted('alertsHidden', false);
  const [mutedClients, setMutedClients] = usePersisted<string[]>('mutedClients', []);
  const [silenceMinutes, setSilenceMinutes] = usePersisted('silenceMinutes', 120);
  const [soundOn, setSoundOn] = usePersisted('soundOn', false);
  const [notifyOn, setNotifyOn] = usePersisted('notifyOn', false);
  const [showPhone, setShowPhone] = usePersisted('showPhone', false);
  const [showStage, setShowStage] = usePersisted('showStage', false);

  const cursorRef = useRef<string | null>(null);
  // Uma resposta do mural varre TODOS os clientes. Se ela demorar mais que o
  // poll, sem estas duas travas os ticks empilham requisição em cima de
  // requisição — e o cursor passa a depender de qual delas responde primeiro.
  // Enquanto uma está no ar, a próxima fica só anotada e roda quando a atual
  // termina (mudar o limiar de silêncio não pode ser engolido).
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  // Lidos dentro do poll: em refs pra não recriar o `load` (e com ele o
  // intervalo) a cada toggle de preferência.
  const soundRef = useRef(soundOn);
  const notifyRef = useRef(notifyOn);
  const silenceRef = useRef(silenceMinutes);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
  useEffect(() => { notifyRef.current = notifyOn; }, [notifyOn]);
  useEffect(() => { silenceRef.current = silenceMinutes; }, [silenceMinutes]);

  const load = useCallback(async (mode: 'initial' | 'tail') => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    inFlightRef.current = true;
    setLoading(true);
    try {
      const since = mode === 'tail' ? cursorRef.current ?? undefined : undefined;
      const res = await superLeadsFeedService.getLeadsFeed({
        since,
        hours: since ? undefined : INITIAL_HOURS,
        silence_minutes: silenceRef.current,
      });
      const data = res.data.data;
      cursorRef.current = data.server_time;

      setClients(data.clients);
      setOverview(data.overview);
      setUpdatedAt(new Date());
      setError(null);

      const incoming = data.leads;
      setLeads((prev) => {
        if (!since) return [...incoming].reverse().slice(0, MAX_CARDS);
        if (incoming.length === 0) return prev;
        const known = new Set(prev.map((l) => l.id));
        const fresh = incoming.filter((l) => !known.has(l.id));
        if (fresh.length === 0) return prev;
        return [...[...fresh].reverse(), ...prev].slice(0, MAX_CARDS);
      });

      // Avisos só no tail: a carga inicial não é "lead novo chegando".
      if (since && incoming.length > 0) {
        if (soundRef.current) playBeep();
        if (notifyRef.current && 'Notification' in window && Notification.permission === 'granted') {
          const first = incoming[incoming.length - 1];
          const title = incoming.length === 1
            ? `Lead novo · ${first.client_name}`
            : `${incoming.length} leads novos`;
          const body = incoming.length === 1
            ? `${first.name} — ${first.origin.label}`
            : incoming.map((l) => l.client_name).filter((v, i, a) => a.indexOf(v) === i).join(', ');
          new Notification(title, { body, tag: 'lmflow-leads-feed' });
        }
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 403
        ? 'Acesso restrito ao super-admin.'
        : 'Não foi possível carregar o mural de leads.');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setFirstLoadDone(true);
      if (pendingRef.current) {
        pendingRef.current = false;
        // Sempre tail: a carga inicial já aconteceu e o cursor está em dia.
        loadRef.current('tail');
      }
    }
  }, []);

  // O `load` se auto-chama pra rodar a requisição que ficou pendente; via ref
  // pra não se referenciar antes de existir.
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  // Carga inicial.
  useEffect(() => {
    load('initial');
  }, [load]);

  // O `silent` é decidido pelo backend, então mudar o limiar exige uma ida nova
  // — mas um tail, que não descarta os cards já no mural.
  const silenceTouched = useRef(false);
  useEffect(() => {
    if (!silenceTouched.current) {
      silenceTouched.current = true;
      return;
    }
    load('tail');
  }, [silenceMinutes, load]);

  // Poll do tail. Pausa manual e aba escondida param o relógio; ao voltar pra
  // aba, busca imediatamente o que perdeu.
  useEffect(() => {
    if (paused) return undefined;

    const tick = () => {
      if (document.visibilityState === 'visible') load('tail');
    };
    const id = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load('tail');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [paused, load]);

  // Relógio local pros "há X min" dos cards.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ESC sai do modo mural (num segundo monitor é o atalho esperado).
  useEffect(() => {
    if (!mural) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMural(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mural]);

  const toggleNotify = useCallback(() => {
    if (notifyOn) {
      setNotifyOn(false);
      return;
    }
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      setNotifyOn(true);
      return;
    }
    Notification.requestPermission().then((p) => setNotifyOn(p === 'granted'));
  }, [notifyOn, setNotifyOn]);

  const toggleClient = useCallback((slug: string) => {
    setSelectedClients((prev) => (
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    ));
  }, []);

  const muteClient = useCallback((slug: string) => {
    setMutedClients((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  }, [setMutedClients]);

  // Nenhum cliente marcado = todos (o padrão de um mural: mostra tudo).
  const visibleLeads = useMemo(() => (
    selectedClients.length === 0
      ? leads
      : leads.filter((l) => selectedClients.includes(l.client_slug))
  ), [leads, selectedClients]);

  const silentClients = useMemo(() => (
    clients.filter((c) => c.silent && !mutedClients.includes(c.slug))
  ), [clients, mutedClients]);

  const unavailableClients = useMemo(() => clients.filter((c) => c.unavailable), [clients]);
  const showAlert = silentClients.length > 0 && !alertsHidden;

  const body = (
    <div className={`mx-auto w-full space-y-4 p-4 md:p-6 ${mural ? 'max-w-3xl' : 'max-w-2xl'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#7c3aed] to-[#a855f7] shrink-0">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Leads ao Vivo</h1>
            <p className="text-sm text-muted-foreground">
              {overview
                ? `${overview.total_today} hoje · ${overview.total_1h} na última hora`
                : 'Carregando…'}
              {updatedAt && ` · ${paused ? 'pausado' : 'atualizado'} ${updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={soundOn ? 'default' : 'outline'}
            size="icon"
            onClick={() => setSoundOn(!soundOn)}
            title={soundOn ? 'Som ligado' : 'Som desligado'}
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button
            variant={notifyOn ? 'default' : 'outline'}
            size="icon"
            onClick={toggleNotify}
            title={notifyOn ? 'Notificação do navegador ligada' : 'Notificação do navegador desligada'}
          >
            {notifyOn ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </Button>
          <Button
            variant={showPhone ? 'default' : 'outline'}
            size="icon"
            onClick={() => setShowPhone(!showPhone)}
            title={showPhone ? 'Escondendo telefone' : 'Mostrar telefone'}
          >
            {showPhone ? <Phone className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
          </Button>
          <Button
            variant={showStage ? 'default' : 'outline'}
            size="icon"
            onClick={() => setShowStage(!showStage)}
            title={showStage ? 'Escondendo funil/etapa' : 'Mostrar funil/etapa'}
          >
            <GitBranch className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPaused(!paused)}
            title={paused ? 'Retomar' : 'Pausar'}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={() => load('tail')} disabled={loading} title="Atualizar agora">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMural(!mural)}
            title={mural ? 'Sair do modo mural (Esc)' : 'Modo mural (tela cheia)'}
          >
            {mural ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Alerta de cliente mudo — OCULTÁVEL: o X persiste no localStorage e o
          sino ao lado do limiar traz de volta. */}
      {showAlert && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                {silentClients.length === 1
                  ? '1 cliente sem lead novo'
                  : `${silentClients.length} clientes sem lead novo`}
                {` há mais de ${ageLabel(silenceMinutes)}`}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {silentClients.map((c) => (
                  <span
                    key={c.slug}
                    className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/50 px-2 py-0.5 text-[11px] text-orange-800 dark:text-orange-300"
                  >
                    {c.name} · {ageLabel(c.minutes_since_last_lead)}
                    <button
                      type="button"
                      onClick={() => muteClient(c.slug)}
                      className="ml-0.5 opacity-60 hover:opacity-100"
                      title="Silenciar este cliente (campanha pausada de propósito)"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAlertsHidden(true)}
              className="text-orange-600 dark:text-orange-400 opacity-70 hover:opacity-100 shrink-0"
              title="Ocultar alertas"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Controles do alerta: limiar + reativar quando está oculto */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        <span>Alertar após</span>
        <select
          value={silenceMinutes}
          onChange={(e) => setSilenceMinutes(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
        >
          {SILENCE_OPTIONS.map((m) => (
            <option key={m} value={m}>{ageLabel(m)} sem lead</option>
          ))}
        </select>
        {alertsHidden && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAlertsHidden(false)}>
            <BellRing className="h-3.5 w-3.5 mr-1" />
            Reativar alertas
            {silentClients.length > 0 && ` (${silentClients.length})`}
          </Button>
        )}
        {mutedClients.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMutedClients([])}>
            Reativar {mutedClients.length} cliente(s) silenciado(s)
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {unavailableClients.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sem leitura agora: {unavailableClients.map((c) => c.name).join(', ')}
        </p>
      )}

      {/* Filtro por cliente — nenhum marcado = todos */}
      {clients.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {clients.filter((c) => !c.unavailable).map((c) => {
            const on = selectedClients.includes(c.slug);
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggleClient(c.slug)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  on
                    ? 'border-transparent bg-[#7c3aed] text-white'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
                title={`${c.count_today ?? 0} lead(s) hoje · última ${ageLabel(c.minutes_since_last_lead)}`}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: clientColor(c.slug) }} />
                {c.name}
                <span className={on ? 'opacity-80' : 'opacity-60'}>{c.count_today ?? 0}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Mural */}
      {!firstLoadDone && loading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando…
        </div>
      )}

      {firstLoadDone && visibleLeads.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Megaphone className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm">
            {selectedClients.length > 0
              ? 'Nenhum lead dos clientes filtrados'
              : `Nenhum lead nas últimas ${INITIAL_HOURS}h`}
          </p>
          <p className="text-xs mt-1">Os novos aparecem aqui sozinhos.</p>
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {visibleLeads.map((lead) => {
            const color = clientColor(lead.client_slug);
            const mins = minutesSince(lead.created_at, now);
            return (
              <motion.div
                key={lead.id}
                layout
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm"
                style={{ borderLeftWidth: 4, borderLeftColor: color }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate" style={{ color }}>
                    {lead.client_name}
                  </span>
                  <span className={`text-[11px] shrink-0 ${mins < 2 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {ageLabel(mins)}
                  </span>
                </div>

                <p className="mt-0.5 text-sm font-medium text-foreground truncate">{lead.name}</p>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {lead.origin.label}
                    {lead.origin.campaign && ` · ${lead.origin.campaign}`}
                  </Badge>
                  {showStage && lead.pipeline?.stage && (
                    <span className="text-[10px] text-muted-foreground">
                      {lead.pipeline.name ? `${lead.pipeline.name} / ` : ''}{lead.pipeline.stage}
                    </span>
                  )}
                </div>

                {showPhone && lead.phone && (
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{lead.phone}</p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );

  // Modo mural: sobrepõe o shell do admin sem trocar de rota, pra deixar aberto
  // num segundo monitor em coluna vertical.
  if (mural) {
    return <div className="fixed inset-0 z-50 overflow-auto bg-background">{body}</div>;
  }

  return body;
}
