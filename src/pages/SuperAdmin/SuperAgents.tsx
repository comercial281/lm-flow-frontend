import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Label } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Bot, ChevronDown, Power, Clock, MessageSquare, Loader2 } from 'lucide-react';
import {
  superAgentsService,
  MODE_LABELS,
  type SuperAgent,
  type SuperAgentPatch,
} from '@/services/superAdmin/superAgentsService';

/**
 * Épico B — Agentes de IA (todos os clientes) na Área do Admin.
 *
 * Lista os agentes de pré-atendimento de TODOS os tenants e deixa o Giovani
 * configurar cada um (ligar/desligar, modo, gatilho, horário) sem entrar no CRM
 * do cliente via SSO. A instância aparece pra referência (trocar de instância
 * continua no CRM do cliente, onde a lista de inboxes vive).
 */
export default function SuperAgents() {
  const [agents, setAgents] = useState<SuperAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAgents(await superAgentsService.listAll());
    } catch {
      toast.error('Não consegui carregar os agentes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byTenant = useMemo(() => {
    const map = new Map<string, SuperAgent[]>();
    for (const a of agents) {
      const key = a.tenant_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [agents]);

  const patchLocal = (id: string, patch: Partial<SuperAgent>) =>
    setAgents(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Agentes de IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os agentes de pré-atendimento, de todos os clientes. Configure cada um daqui, sem entrar no CRM.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : agents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum agente encontrado nos clientes.
        </p>
      ) : (
        <div className="space-y-6">
          {byTenant.map(([tenant, list]) => (
            <section key={tenant}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tenant}</h2>
              <ul className="space-y-2">
                {list.map(a => (
                  <AgentRow
                    key={a.id}
                    agent={a}
                    open={openId === a.id}
                    onToggleOpen={() => setOpenId(prev => (prev === a.id ? null : a.id))}
                    onPatched={p => patchLocal(a.id, p)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentRow({
  agent,
  open,
  onToggleOpen,
  onPatched,
}: {
  agent: SuperAgent;
  open: boolean;
  onToggleOpen: () => void;
  onPatched: (p: Partial<SuperAgent>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState(agent.mode);
  const [keyword, setKeyword] = useState(agent.trigger_keyword ?? '');
  const [hoursStart, setHoursStart] = useState('');
  const [hoursEnd, setHoursEnd] = useState('');

  useEffect(() => {
    const w = agent.active_hours?.windows?.[0];
    setHoursStart(w?.start ?? '');
    setHoursEnd(w?.end ?? '');
  }, [agent.active_hours]);

  const save = async (patch: SuperAgentPatch, okMsg = 'Salvo.') => {
    setSaving(true);
    try {
      const updated = await superAgentsService.update(agent.id, agent.tenant_slug, patch);
      onPatched(updated);
      toast.success(okMsg);
    } catch {
      toast.error('Não consegui salvar.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = () => void save({ enabled: !agent.enabled }, agent.enabled ? 'Agente desligado.' : 'Agente ligado.');

  const saveConfig = () => {
    const patch: SuperAgentPatch = { mode, trigger_keyword: keyword.trim() || null };
    if (hoursStart && hoursEnd) {
      const existing = agent.active_hours ?? {};
      const days = existing.windows?.[0]?.days ?? [1, 2, 3, 4, 5];
      patch.active_hours = { ...existing, mode: existing.mode ?? 'always', windows: [{ start: hoursStart, end: hoursEnd, days }] };
    }
    void save(patch, 'Configuração salva.');
  };

  return (
    <li className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 p-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${agent.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{agent.name}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{MODE_LABELS[agent.mode] ?? agent.mode}</span>
            {!agent.enabled && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">desligado</span>}
          </div>
          <p className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            {agent.inbox_name && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{agent.inbox_name}</span>}
            {agent.trigger_keyword && <span>gatilho: {agent.trigger_keyword}</span>}
          </p>
        </div>
        <button onClick={toggleEnabled} disabled={saving} title={agent.enabled ? 'Desligar' : 'Ligar'} className={`rounded p-1.5 ${agent.enabled ? 'text-emerald-600' : 'text-muted-foreground'} hover:bg-accent`}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
        </button>
        <button onClick={onToggleOpen} title="Configurar" className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border p-3">
          <div>
            <Label>Modo</Label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {Object.entries(MODE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`kw-${agent.id}`}>Gatilho por palavra (vazio = atende todos)</Label>
            <Input id={`kw-${agent.id}`} value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Ex: fluxoimob" />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Horário de funcionamento</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input type="time" value={hoursStart} onChange={e => setHoursStart(e.target.value)} className="w-32" />
              <span className="text-sm text-muted-foreground">até</span>
              <Input type="time" value={hoursEnd} onChange={e => setHoursEnd(e.target.value)} className="w-32" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Dias úteis. Deixe em branco pra manter o atual.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveConfig} disabled={saving}>Salvar configuração</Button>
          </div>
        </div>
      )}
    </li>
  );
}
