import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/ds';
import { toast } from 'sonner';
import { RefreshCw, Loader2, Check } from 'lucide-react';
import { dolar } from '@/lib/formato';
import UltimosAtendimentos from './UltimosAtendimentos';
import EnviosSistemaCliente from '../diagnostico/EnviosSistemaCliente';
import { salesAgentsService, type SalesAgent, type HealthReport, type SalesAgentRunTotals, type PromptPreview } from '@/services/salesAgents/salesAgentsService';

// ---------------- Diagnóstico ----------------
//
// Responde as duas perguntas que antes só o log do Railway respondia: "essa IA
// está mesmo no ar?" e "por que ela não atendeu esse lead?". Cada item do
// checklist é uma falha real que já deixou agente mudo sem erro na tela — a
// campeã é o canal sem credencial da Evolution, em que a IA pensava a resposta,
// pagava o token e não enviava nada.

const HEALTH_STYLE: Record<string, { dot: string; text: string }> = {
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
  warning: { dot: 'bg-amber-500', text: 'text-amber-600' },
  error: { dot: 'bg-red-500', text: 'text-red-600' },
};

export default function TelaDiagnostico({ agent }: { agent: SalesAgent }) {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [totals, setTotals] = useState<SalesAgentRunTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState<PromptPreview | null>(null);
  const [checkingPrompt, setCheckingPrompt] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, r] = await Promise.all([
        salesAgentsService.diagnostics(agent.id),
        salesAgentsService.runs(agent.id, { days: 30, limit: 50 }),
      ]);
      setHealth(h);
      setTotals(r.totals);
    } catch {
      toast.error('Não consegui carregar o diagnóstico.');
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => { void load(); }, [load]);

  const checkPrompt = async () => {
    setCheckingPrompt(true);
    try {
      setPrompt(await salesAgentsService.testPrompt(agent.id));
    } catch {
      toast.error('Não consegui montar o prompt.');
    } finally {
      setCheckingPrompt(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Situação da IA</h3>
          <p className="text-xs text-muted-foreground">Os passos necessários para ela atender, verificados agora.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="space-y-2">
        {(health?.items ?? []).map((item) => {
          const style = HEALTH_STYLE[item.status] ?? HEALTH_STYLE.warning;
          return (
            <div key={item.key} className="flex items-start gap-3 rounded-md border border-sidebar-border p-3">
              <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${style.dot}`} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                <div className={`text-xs ${item.status === 'ok' ? 'text-muted-foreground' : style.text}`}>{item.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {agent.handoff_target === 'webhook' && <EnviosSistemaCliente agentId={agent.id} />}

      {/* Prova de que o cérebro geral chegou neste cliente. Não gasta crédito:
          monta o prompt e não chama o modelo. Existia na API desde sempre e não
          tinha botão em lugar nenhum. */}
      <div className="rounded-md border border-sidebar-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Conferir o que a IA está lendo</div>
            <div className="text-xs text-muted-foreground">Monta o cérebro dela sem gastar crédito nenhum.</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void checkPrompt()} disabled={checkingPrompt}>
            {checkingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Conferir'}
          </Button>
        </div>
        {prompt && (
          <div className="mt-3 space-y-1 text-xs">
            <PromptFlag ok={prompt.has_global_knowledge} label="Cérebro geral da agência" />
            <PromptFlag ok={prompt.has_client_knowledge} label="Base de conhecimento deste cliente" />
            <PromptFlag ok={prompt.has_lessons} label="Aprendizados ensinados" />
            <PromptFlag ok={!!prompt.has_sendable_files} label="Arquivos que ela pode enviar" />
            <p className="text-muted-foreground pt-1">Tamanho do cérebro: {prompt.length.toLocaleString('pt-BR')} caracteres.</p>
          </div>
        )}
      </div>

      {totals && (
        <div>
          <h3 className="text-sm font-medium mb-2">Últimos 30 dias</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Respondeu" value={String(totals.replied)} />
            <Stat label="Não respondeu" value={String(totals.skipped)} />
            <Stat label="Falhou" value={String(totals.failed)} />
            <Stat label="Custo" value={dolar(totals.cost_usd)} />
          </div>
        </div>
      )}

      <UltimosAtendimentos agentId={agent.id} completo />
    </div>
  );
}

function PromptFlag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <span className="h-3.5 w-3.5 text-amber-600">—</span>}
      <span className={ok ? '' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-sidebar-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
