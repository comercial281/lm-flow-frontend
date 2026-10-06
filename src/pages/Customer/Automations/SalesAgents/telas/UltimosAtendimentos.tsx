// Últimos atendimentos (onda 3, decisão 6): saíram do Diagnóstico (que foi pro "⋯",
// só equipe) e vieram pra Visão geral, na largura toda. Pro cliente, sem o custo em
// dólar (é o que a Leal Mídia paga, não o cliente — mesma regra dos números da
// Visão geral) e sem o erro técnico. A equipe vê tudo (no Diagnóstico, completo).
//
// ⚠️ Leitura de fundo: cargo sem a permissão (`sales_agents.runs`) recebe 403 e o
// bloco só não aparece. Hora pelo módulo de formato (nada de toLocaleString).
import { useEffect, useState } from 'react';
import { salesAgentsService, type SalesAgentRun } from '@/services/salesAgents/salesAgentsService';
import { dataHora, dolar } from '@/lib/formato';

const SITUACAO: Record<string, string> = { replied: 'Respondeu', skipped: 'Não respondeu', failed: 'Falhou' };
const TIPO: Record<string, string> = { live: 'Conversa', followup: 'Follow-up', reengage: 'Retomada', engage: 'Acionada pelo corretor', test: 'Teste' };
const COR: Record<string, string> = { replied: 'bg-emerald-500', failed: 'bg-red-500', skipped: 'bg-amber-500' };

export default function UltimosAtendimentos({ agentId, completo }: { agentId: string; completo: boolean }) {
  const [runs, setRuns] = useState<SalesAgentRun[] | null>(null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await salesAgentsService.runs(agentId, { days: 30, limit: 50 });
        if (vivo) setRuns(r.runs);
      } catch {
        if (vivo) setRuns(null);
      }
    })();
    return () => { vivo = false; };
  }, [agentId]);

  if (!runs) return null;

  return (
    <section aria-labelledby="ultimos-atendimentos" className="space-y-2">
      <h2 id="ultimos-atendimentos" className="text-sm font-medium">Últimos atendimentos</h2>
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro ainda. Cada mensagem que chegar aparece aqui, inclusive as que ela decidir não responder.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {runs.map((run) => {
            const tecnico = run.error_message && (completo || run.error_class === 'Detalhe');
            return (
              <li key={run.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${COR[run.status] ?? 'bg-amber-500'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">{SITUACAO[run.status] ?? run.status}</span>
                    <span className="text-muted-foreground"> · {TIPO[run.kind] ?? run.kind} · {dataHora(run.created_at)}</span>
                  </p>
                  {run.reason_label && (run.status !== 'replied' || (run.delivered === false && run.skip_reason)) && (
                    <p className="text-muted-foreground">{run.reason_label}</p>
                  )}
                  {tecnico && (
                    <p className={`break-words ${run.status === 'failed' ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {run.error_class === 'Detalhe' ? run.error_message : `${run.error_class}: ${run.error_message}`}
                    </p>
                  )}
                  {run.status === 'replied' && !run.delivered && !run.skip_reason && (
                    <p className="text-amber-600">A resposta foi gerada mas o WhatsApp não aceitou o envio.</p>
                  )}
                </div>
                {completo && run.cost_usd > 0 && <span className="whitespace-nowrap text-muted-foreground">{dolar(run.cost_usd, 4)}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
