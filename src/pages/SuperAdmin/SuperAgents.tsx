import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Label } from '@/components/ui/ds';
import { toast } from 'sonner';
import { AlertTriangle, Bot, ChevronDown, Clock, Coins, MessageSquare } from 'lucide-react';
import Chave from '@/components/base/Chave';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { useConfirmacao, type PedidoDeConfirmacao } from '@/hooks/useConfirmacao';
import {
  superAgentsService,
  MODE_LABELS,
  type SuperAgent,
  type SuperAgentPatch,
  type ModelOption,
} from '@/services/superAdmin/superAgentsService';
import { ESQUELETO, PAGINA, SECAO, SELO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';

type Confirmar = (pedido: PedidoDeConfirmacao) => Promise<boolean>;

/**
 * IA Vendedora → Agentes: todas as IAs Vendedoras de todos os clientes.
 *
 * Padrão da casa (06/10/2026): liga/desliga é `Chave`; DESLIGAR confirma, porque
 * a IA para de responder lead real do cliente; ligar não. Erro de carga nunca vira
 * "nenhuma IA". Busca por cliente ou por IA (são ~30 clientes).
 */
export default function SuperAgents() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [agents, setAgents] = useState<SuperAgent[]>([]);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [busca, setBusca] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEstado('carregando');
    try {
      setAgents(await superAgentsService.listAll());
      setEstado('pronto');
    } catch {
      setEstado('erro');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byTenant = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const map = new Map<string, SuperAgent[]>();
    for (const a of agents) {
      if (termo && !`${a.tenant_name} ${a.name}`.toLowerCase().includes(termo)) continue;
      const lista = map.get(a.tenant_name) ?? [];
      lista.push(a);
      map.set(a.tenant_name, lista);
    }
    return Array.from(map.entries());
  }, [agents, busca]);

  const patchLocal = (id: string, patch: Partial<SuperAgent>) =>
    setAgents(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));

  return (
    <div className={`mx-auto max-w-5xl px-4 py-6 ${PAGINA}`}>
      {estado === 'pronto' && agents.length > 0 && (
        <Input
          type="search"
          aria-label="Buscar cliente"
          placeholder="Buscar cliente ou IA…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="max-w-sm"
        />
      )}

      {estado === 'carregando' && (
        <div aria-busy="true" className="flex flex-col gap-4">
          {[0, 1, 2].map(i => <div key={i} className={`h-24 ${ESQUELETO}`} />)}
        </div>
      )}

      {estado === 'erro' && (
        <EmptyState tipo="erro" title="Não deu pra carregar as IAs" aoTentarDeNovo={() => void load()} />
      )}

      {estado === 'pronto' && agents.length === 0 && (
        <EmptyState
          icon={Bot}
          title="Nenhuma IA Vendedora nos clientes"
          description="Quando um cliente criar a IA dele, ela aparece aqui."
        />
      )}

      {estado === 'pronto' && agents.length > 0 && byTenant.length === 0 && (
        <EmptyState tipo="semResultado" aoLimparFiltros={() => setBusca('')} />
      )}

      {estado === 'pronto' &&
        byTenant.map(([tenant, list]) => (
          <section key={tenant} aria-label={tenant} className={SECAO}>
            <h2 className={TITULO_SECAO}>{tenant}</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {list.map(a => (
                <AgentRow
                  key={a.id}
                  agent={a}
                  open={openId === a.id}
                  confirmar={confirmar}
                  onToggleOpen={() => setOpenId(prev => (prev === a.id ? null : a.id))}
                  onPatched={p => patchLocal(a.id, p)}
                />
              ))}
            </ul>
          </section>
        ))}

      {dialogoDeConfirmacao}
    </div>
  );
}

function AgentRow({
  agent,
  open,
  confirmar,
  onToggleOpen,
  onPatched,
}: {
  agent: SuperAgent;
  open: boolean;
  confirmar: Confirmar;
  onToggleOpen: () => void;
  onPatched: (p: Partial<SuperAgent>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState(agent.mode);
  const [keyword, setKeyword] = useState(agent.trigger_keyword ?? '');
  const [hoursStart, setHoursStart] = useState('');
  const [hoursEnd, setHoursEnd] = useState('');
  const [inboxId, setInboxId] = useState(agent.inbox_id ?? '');
  const [inboxes, setInboxes] = useState<Array<{ id: string; name: string }>>([]);
  // Economia de tokens
  const [model, setModel] = useState(agent.model ?? '');
  const [testModel, setTestModel] = useState(agent.test_model ?? '');
  const [maxOut, setMaxOut] = useState(String(agent.max_output_tokens ?? ''));
  const [catalog, setCatalog] = useState<ModelOption[]>([]);

  useEffect(() => {
    const w = agent.active_hours?.windows?.[0];
    setHoursStart(w?.start ?? '');
    setHoursEnd(w?.end ?? '');
  }, [agent.active_hours]);

  // Carrega os números de WhatsApp do cliente só quando o painel abre.
  useEffect(() => {
    if (!open || inboxes.length > 0) return;
    superAgentsService.inboxes(agent.tenant_slug).then(setInboxes).catch(() => setInboxes([]));
  }, [open, agent.tenant_slug, inboxes.length]);

  // Catálogo de modelos (preço real + mínimo de cache) — só ao abrir.
  useEffect(() => {
    if (!open || catalog.length > 0) return;
    superAgentsService.models().then(setCatalog).catch(() => setCatalog([]));
  }, [open, catalog.length]);

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

  // A Chave vira na hora, volta sozinha se o servidor recusar e avisa. Desligar
  // pergunta antes: a IA para de responder lead real do cliente.
  const ligarOuDesligar = async (ligar: boolean) => {
    if (
      !ligar &&
      !(await confirmar({
        titulo: `Desligar ${agent.name}?`,
        descricao: `A IA de ${agent.tenant_name} para de responder os leads.`,
        rotuloDaAcao: 'Desligar',
        destrutivo: true,
      }))
    )
      return false;
    const updated = await superAgentsService.update(agent.id, agent.tenant_slug, { enabled: ligar });
    onPatched(updated);
  };

  const selectedModel = catalog.find(m => m.id === model);

  const saveConfig = () => {
    const patch: SuperAgentPatch = { mode, trigger_keyword: keyword.trim() || null };
    if (inboxId && inboxId !== agent.inbox_id) patch.inbox_id = inboxId;
    if (model !== (agent.model ?? '')) patch.model = model || null;
    if (testModel !== (agent.test_model ?? '')) patch.test_model = testModel || null;
    if (maxOut !== String(agent.max_output_tokens ?? '')) patch.max_output_tokens = maxOut ? Number(maxOut) : null;
    if (hoursStart && hoursEnd) {
      const existing = agent.active_hours ?? {};
      const days = existing.windows?.[0]?.days ?? [1, 2, 3, 4, 5];
      patch.active_hours = { ...existing, mode: existing.mode ?? 'always', windows: [{ start: hoursStart, end: hoursEnd, days }] };
    }
    void save(patch, 'Configuração salva.');
  };

  return (
    <li className="rounded-lg border border-border">
      <div className="flex items-center gap-3 p-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${agent.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
          <Bot className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{agent.name}</span>
            <span className={`${SELO} text-muted-foreground`}>{MODE_LABELS[agent.mode] ?? agent.mode}</span>
          </div>
          <p className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            {agent.inbox_name && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" aria-hidden="true" />{agent.inbox_name}</span>}
            {agent.trigger_keyword && <span>gatilho: {agent.trigger_keyword}</span>}
          </p>
        </div>
        <Chave
          rotulo={`IA ${agent.name} de ${agent.tenant_name}`}
          semRotuloVisivel
          genero="a"
          ligada={agent.enabled}
          desabilitada={saving}
          aoMudar={ligarOuDesligar}
        />
        <button
          type="button"
          onClick={onToggleOpen}
          aria-label={`Configurar ${agent.name}`}
          aria-expanded={open}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          <div>
            <Label htmlFor={`modo-${agent.id}`}>Modo</Label>
            <Seletor id={`modo-${agent.id}`} value={mode} onChange={e => setMode(e.target.value)} className="mt-1 w-full">
              {Object.entries(MODE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Seletor>
          </div>
          <div>
            <Label htmlFor={`numero-${agent.id}`} className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Número de WhatsApp</Label>
            <Seletor id={`numero-${agent.id}`} value={inboxId} onChange={e => setInboxId(e.target.value)} className="mt-1 w-full">
              <option value="">{agent.inbox_name ? `Atual: ${agent.inbox_name}` : 'Nenhum'}</option>
              {inboxes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Seletor>
          </div>
          <div>
            <Label htmlFor={`kw-${agent.id}`}>Gatilho por palavra (vazio = atende todos)</Label>
            <Input id={`kw-${agent.id}`} value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Ex: fluxoimob" />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> Horário de funcionamento</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input type="time" aria-label="Começa às" value={hoursStart} onChange={e => setHoursStart(e.target.value)} className="w-32" />
              <span className="text-sm text-muted-foreground">até</span>
              <Input type="time" aria-label="Termina às" value={hoursEnd} onChange={e => setHoursEnd(e.target.value)} className="w-32" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Dias úteis. Deixe em branco pra manter o atual.</p>
          </div>
          {/* Custo & Modelo — economia de tokens */}
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <Label className="flex items-center gap-1"><Coins className="h-3.5 w-3.5" aria-hidden="true" /> Custo e modelo</Label>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`modelo-${agent.id}`} className="text-xs">Atendimento ao lead</Label>
                <Seletor id={`modelo-${agent.id}`} value={model} onChange={e => setModel(e.target.value)} className="mt-1 w-full">
                  <option value="">Padrão do sistema</option>
                  {catalog.map(m => <option key={m.id} value={m.id}>{m.label} — ${m.input}/${m.output} por 1M</option>)}
                </Seletor>
                {selectedModel && <p className="mt-1 text-[11px] text-muted-foreground">{selectedModel.use_for}</p>}
              </div>
              <div>
                <Label htmlFor={`teste-${agent.id}`} className="text-xs">Painel Testar (você iterando)</Label>
                <Seletor id={`teste-${agent.id}`} value={testModel} onChange={e => setTestModel(e.target.value)} className="mt-1 w-full">
                  <option value="">Haiku (mais barato) — recomendado</option>
                  {catalog.map(m => <option key={m.id} value={m.id}>{m.label} — ${m.input}/${m.output} por 1M</option>)}
                </Seletor>
                <p className="mt-1 text-[11px] text-muted-foreground">Testar não precisa do modelo caro. Só afeta o painel, nunca o lead real.</p>
              </div>
            </div>
            <div className="mt-3">
              <Label htmlFor={`mo-${agent.id}`} className="text-xs">Teto de resposta (tokens de saída)</Label>
              <Input id={`mo-${agent.id}`} type="number" value={maxOut} onChange={e => setMaxOut(e.target.value)} placeholder="1200 (padrão)" className="h-8 w-40 text-xs" />
              <p className="mt-1 text-[11px] text-muted-foreground">Resposta de WhatsApp é curta. Menor = mais barato e sem textão.</p>
            </div>
            {selectedModel && selectedModel.min_cache_tokens >= 4096 && (
              <p className="mt-2 flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-[11px] text-foreground">
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-none text-destructive" aria-hidden="true" />
                Atenção: este modelo só usa cache com prompt acima de {selectedModel.min_cache_tokens.toLocaleString('pt-BR')} tokens.
                Se o prompt deste agente for menor, o cache para de funcionar em silêncio e o custo sobe.
              </p>
            )}
            {selectedModel && !selectedModel.sampling && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Este modelo ignora o ajuste de temperatura (o comportamento se guia pelo prompt).
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={saveConfig} disabled={saving}>Salvar configuração</Button>
          </div>
        </div>
      )}
    </li>
  );
}
