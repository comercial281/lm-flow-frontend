import { useCallback, useEffect, useState } from 'react';
import { Button, Label, Textarea } from '@/components/ui/ds';
import { toast } from 'sonner';
import { BookOpenCheck, Sparkles, Wand2 } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import {
  sdrProposalsService,
  AiUnavailableError,
  KIND_LABELS,
  type SdrProposal,
} from '@/services/superAdmin/sdrProposalsService';
import { superAgentsService, type SuperAgent } from '@/services/superAdmin/superAgentsService';
import { CORPO_SECAO, ESQUELETO, SECAO, SELO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';

/**
 * Épicos C+D — Aperfeiçoamento do Cérebro SDR.
 *
 * D: descreva o que não gostou; a IA propõe um ajuste (global ou individual), você aprova.
 * C: curadoria das conversas passadas de um cliente; a IA propõe lições, você aprova.
 * Nada entra sem sua aprovação. (A redação por IA depende de crédito Anthropic; o
 * fluxo de aprovar/rejeitar funciona sempre.)
 *
 * 06/10/2026: aprovar lição GLOBAL confirma — ela entra no prompt de TODA IA de
 * TODO cliente. Aprovar lição de um cliente e rejeitar não confirmam.
 */
export default function SdrRefinement() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [proposals, setProposals] = useState<SdrProposal[]>([]);
  const [agents, setAgents] = useState<SuperAgent[]>([]);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');

  const load = useCallback(async () => {
    setEstado('carregando');
    try {
      const [p, a] = await Promise.all([sdrProposalsService.list('pending'), superAgentsService.listAll()]);
      setProposals(p);
      setAgents(a);
      setEstado('pronto');
    } catch {
      setEstado('erro');
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
    if (
      p.scope === 'global' &&
      !(await confirmar({
        titulo: 'Aprovar para todos os clientes?',
        descricao: 'Esta lição passa a valer para todas as IAs de todos os clientes.',
        rotuloDaAcao: 'Aprovar para todos',
      }))
    )
      return;
    try {
      await sdrProposalsService.approve(p.id);
      setProposals(prev => prev.filter(x => x.id !== p.id));
      toast.success(p.scope === 'global' ? 'Aprovado para todas as IAs.' : 'Aprovado na IA do cliente.');
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
    <section aria-labelledby="aperfeicoamento" className={SECAO}>
      <h2 id="aperfeicoamento" className={TITULO_SECAO}>Aperfeiçoamento</h2>
      <p className={SUBTITULO_SECAO}>
        Ensine a IA descrevendo o que quer, ou deixe ela aprender com as conversas passadas. Você aprova cada sugestão.
      </p>

      <div className={`${CORPO_SECAO} grid gap-6 md:grid-cols-2`}>
        <RefineBox agents={agents} onNew={onNew} />
        <CurateBox agents={agents} onNew={onNew} />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">Propostas pendentes {estado === 'pronto' ? `(${proposals.length})` : ''}</h3>
        {estado === 'carregando' && <div aria-busy="true" className={`h-24 ${ESQUELETO}`} />}
        {estado === 'erro' && <EmptyState tipo="erro" title="Não deu pra carregar as propostas" aoTentarDeNovo={() => void load()} />}
        {estado === 'pronto' && proposals.length === 0 && (
          <EmptyState title="Nenhuma proposta pendente" description="As sugestões aparecem aqui para você aprovar." />
        )}
        {estado === 'pronto' && proposals.length > 0 && (
          <ul className="flex flex-col gap-2">
            {proposals.map(p => (
              <li key={p.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`${SELO} ${p.scope === 'global' ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                        {p.scope === 'global' ? 'Todos os clientes' : `Só a IA ${p.agent_name ?? ''}`.trim()}
                      </span>
                      <span className={`${SELO} text-muted-foreground`}>{KIND_LABELS[p.kind]}</span>
                      <span className={`${SELO} text-muted-foreground`}>{sourceLabel(p.source)}</span>
                    </div>
                    {p.context && <p className="mt-1 text-xs text-muted-foreground">Lead: {p.context}</p>}
                    <p className="mt-1 text-sm text-foreground">{p.content}</p>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => void approve(p)}>Aprovar</Button>
                    <Button size="sm" variant="ghost" onClick={() => void reject(p)}>Rejeitar</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {dialogoDeConfirmacao}
    </section>
  );
}

function ScopePicker({
  scope, setScope, agentId, setAgentId, agents, id,
}: {
  scope: string; setScope: (s: string) => void;
  agentId: string; setAgentId: (s: string) => void;
  agents: SuperAgent[]; id: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Label htmlFor={`${id}-escopo`}>Vale para</Label>
        <Seletor id={`${id}-escopo`} value={scope} onChange={e => setScope(e.target.value)} className="mt-1 w-full">
          <option value="global">Todos os clientes</option>
          <option value="individual">Uma IA só</option>
        </Seletor>
      </div>
      {scope === 'individual' && (
        <Seletor aria-label="IA" value={agentId} onChange={e => setAgentId(e.target.value)} className="w-full">
          <option value="">Escolha a IA...</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.tenant_name} — {a.name}</option>)}
        </Seletor>
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
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-foreground"><Wand2 className="h-4 w-4" aria-hidden="true" /> Ensinar por descrição</h3>
      <ScopePicker id="refine" scope={scope} setScope={setScope} agentId={agentId} setAgentId={setAgentId} agents={agents} />
      <div>
        <Label htmlFor="refine-msg">O que você quer ajustar?</Label>
        <Textarea id="refine-msg" value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Ex: não gostei que ela ficou repetindo o nome do lead toda hora. Quero que use só de vez em quando." />
      </div>
      <Button onClick={submit} disabled={busy} className="w-fit"><Sparkles className="mr-1 h-4 w-4" /> {busy ? 'Pensando...' : 'Propor ajuste'}</Button>
    </div>
  );
}

function CurateBox({ agents, onNew }: { agents: SuperAgent[]; onNew: (p: SdrProposal[]) => void }) {
  const [agentId, setAgentId] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
      toast.error('Escolha a IA do cliente.');
      return;
    }
    setBusy(true);
    try {
      const proposals = await sdrProposalsService.curate({ tenant: agent.tenant_slug ?? '', agent_id: agentId });
      onNew(proposals);
      toast.success(`${proposals.length} ${proposals.length === 1 ? 'lição proposta' : 'lições propostas'}. Revise abaixo.`);
    } catch (e) {
      if (e instanceof AiUnavailableError) toast.error(e.message, { duration: 6000 });
      else toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-foreground"><BookOpenCheck className="h-4 w-4" aria-hidden="true" /> Aprender com o histórico</h3>
      <p className="text-xs text-muted-foreground">
        A IA lê as conversas passadas do cliente, separa o que é de anúncio e capta o tom de voz, e propõe lições pra você aprovar.
      </p>
      <Seletor aria-label="IA do cliente" value={agentId} onChange={e => setAgentId(e.target.value)} className="w-full">
        <option value="">Escolha a IA do cliente...</option>
        {agents.map(a => <option key={a.id} value={a.id}>{a.tenant_name} — {a.name}</option>)}
      </Seletor>
      <Button onClick={run} disabled={busy} variant="outline" className="w-fit"><BookOpenCheck className="mr-1 h-4 w-4" /> {busy ? 'Analisando...' : 'Aprender com histórico'}</Button>
    </div>
  );
}

function sourceLabel(s: SdrProposal['source']): string {
  return s === 'refine' ? 'aperfeiçoamento' : s === 'curation' ? 'curadoria' : 'manual';
}
