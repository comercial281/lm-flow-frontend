import { useCallback, useEffect, useState } from 'react';
import { Button, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Sparkles, Check, X, Wand2, BookOpenCheck } from 'lucide-react';
import {
  sdrProposalsService,
  AiUnavailableError,
  KIND_LABELS,
  type SdrProposal,
} from '@/services/superAdmin/sdrProposalsService';
import { superAgentsService, type SuperAgent } from '@/services/superAdmin/superAgentsService';

/**
 * Épicos C+D — Aperfeiçoamento do Cérebro SDR.
 *
 * D: descreva o que não gostou; a IA propõe um ajuste (global ou individual), você aprova.
 * C: curadoria das conversas passadas de um cliente; a IA propõe lições, você aprova.
 * Nada entra sem sua aprovação. (A redação por IA depende de crédito Anthropic; o
 * fluxo de aprovar/rejeitar funciona sempre.)
 */
export default function SdrRefinement() {
  const [proposals, setProposals] = useState<SdrProposal[]>([]);
  const [agents, setAgents] = useState<SuperAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([sdrProposalsService.list('pending'), superAgentsService.listAll()]);
      setProposals(p);
      setAgents(a);
    } catch {
      toast.error('Não consegui carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onNew = (p: SdrProposal | SdrProposal[]) => {
    const arr = Array.isArray(p) ? p : [p];
    setProposals(prev => [...arr, ...prev]);
  };

  const approve = async (p: SdrProposal) => {
    try {
      await sdrProposalsService.approve(p.id);
      setProposals(prev => prev.filter(x => x.id !== p.id));
      toast.success(p.scope === 'global' ? 'Aprovado no cérebro universal.' : 'Aprovado no agente.');
    } catch {
      toast.error('Não consegui aprovar.');
    }
  };

  const reject = async (p: SdrProposal) => {
    try {
      await sdrProposalsService.reject(p.id);
      setProposals(prev => prev.filter(x => x.id !== p.id));
    } catch {
      toast.error('Não consegui rejeitar.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Aperfeiçoamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ensine a IA descrevendo o que quer, ou deixe ela aprender com as conversas passadas. Você aprova cada sugestão.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <RefineBox agents={agents} onNew={onNew} />
        <CurateBox agents={agents} onNew={onNew} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-foreground">Propostas pendentes ({proposals.length})</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : proposals.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma proposta pendente.
          </p>
        ) : (
          <ul className="space-y-2">
            {proposals.map(p => (
              <li key={p.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                        {p.scope === 'global' ? 'Universal' : `Individual: ${p.agent_name ?? ''}`}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{KIND_LABELS[p.kind]}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{sourceLabel(p.source)}</span>
                    </div>
                    {p.context && <p className="mt-1 text-xs text-muted-foreground">Lead: {p.context}</p>}
                    <p className="mt-1 text-sm text-foreground">{p.content}</p>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <button onClick={() => approve(p)} title="Aprovar" className="rounded p-1.5 text-emerald-600 hover:bg-accent"><Check className="h-4 w-4" /></button>
                    <button onClick={() => reject(p)} title="Rejeitar" className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-red-600"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ScopePicker({
  scope, setScope, agentId, setAgentId, agents,
}: {
  scope: string; setScope: (s: string) => void;
  agentId: string; setAgentId: (s: string) => void;
  agents: SuperAgent[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(['global', 'individual'] as const).map(s => (
          <button key={s} onClick={() => setScope(s)} className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${scope === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
            {s === 'global' ? 'Universal (todos)' : 'Individual'}
          </button>
        ))}
      </div>
      {scope === 'individual' && (
        <select value={agentId} onChange={e => setAgentId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="">Escolha o agente...</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.tenant_name} — {a.name}</option>)}
        </select>
      )}
    </div>
  );
}

function RefineBox({ agents, onNew }: { agents: SuperAgent[]; onNew: (p: SdrProposal) => void }) {
  const [message, setMessage] = useState('');
  const [scope, setScope] = useState('global');
  const [agentId, setAgentId] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    const agent = agents.find(a => a.id === agentId);
    setBusy(true);
    try {
      const p = await sdrProposalsService.refine({
        message: message.trim(), scope,
        tenant: scope === 'individual' ? (agent?.tenant_slug ?? '') : undefined,
        agent_id: scope === 'individual' ? agentId : undefined,
      });
      onNew(p);
      setMessage('');
      toast.success('Proposta criada. Revise abaixo.');
    } catch (e) {
      if (e instanceof AiUnavailableError) toast.error(e.message, { duration: 6000 });
      else toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground"><Wand2 className="h-4 w-4" /> Ensinar por descrição</h2>
      <div className="space-y-3">
        <ScopePicker scope={scope} setScope={setScope} agentId={agentId} setAgentId={setAgentId} agents={agents} />
        <div>
          <Label htmlFor="refine-msg">O que você quer ajustar?</Label>
          <Textarea id="refine-msg" value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Ex: não gostei que ela ficou repetindo o nome do lead toda hora. Quero que use só de vez em quando." />
        </div>
        <Button onClick={submit} disabled={busy}><Sparkles className="mr-1 h-4 w-4" /> {busy ? 'Pensando...' : 'Propor ajuste'}</Button>
      </div>
    </div>
  );
}

function CurateBox({ agents, onNew }: { agents: SuperAgent[]; onNew: (p: SdrProposal[]) => void }) {
  const [agentId, setAgentId] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
      toast.error('Escolha o agente do cliente.');
      return;
    }
    setBusy(true);
    try {
      const proposals = await sdrProposalsService.curate({ tenant: agent.tenant_slug ?? '', agent_id: agentId });
      onNew(proposals);
      toast.success(`${proposals.length} lições propostas. Revise abaixo.`);
    } catch (e) {
      if (e instanceof AiUnavailableError) toast.error(e.message, { duration: 6000 });
      else toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground"><BookOpenCheck className="h-4 w-4" /> Aprender com o histórico</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        A IA lê as conversas passadas do cliente, separa o que é de anúncio e capta o tom de voz, e propõe lições pra você aprovar.
      </p>
      <div className="space-y-3">
        <select value={agentId} onChange={e => setAgentId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="">Escolha o agente do cliente...</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.tenant_name} — {a.name}</option>)}
        </select>
        <Button onClick={run} disabled={busy} variant="outline"><BookOpenCheck className="mr-1 h-4 w-4" /> {busy ? 'Analisando...' : 'Aprender com histórico'}</Button>
      </div>
    </div>
  );
}

function sourceLabel(s: SdrProposal['source']): string {
  return s === 'refine' ? 'aperfeiçoamento' : s === 'curation' ? 'curadoria' : 'manual';
}
