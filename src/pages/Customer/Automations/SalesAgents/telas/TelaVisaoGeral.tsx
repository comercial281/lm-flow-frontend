import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/ds';
import { toast } from 'sonner';
import { RefreshCw, Loader2 } from 'lucide-react';
import AiResultsPanel from '@/components/salesAgents/AiResultsPanel';
import { type AgentPerformance } from '@/types/aiResults';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';

// Aba Resultados — o que ESTA IA produziu, pro próprio cliente ver.
//
// A tela tinha Configuração, Base, Aprendizado, Testar e Diagnóstico: cinco abas
// sobre como a IA está montada e nenhuma sobre o que ela entregou. Quem liga uma
// IA quer saber, na semana seguinte, se valeu — e essa resposta só existia no
// painel da Leal Mídia.
//
// Os números vêm da MESMA medição que a Leal Mídia usa (e o painel é o mesmo
// componente): dois números diferentes pro mesmo fato transformariam qualquer
// conversa numa discussão sobre qual tela mente. O custo em dólar não vem junto —
// é o que a Leal Mídia paga à Anthropic, não o que o cliente paga.
//
// Recortado por ESTA IA, não pela conta inteira: uma imobiliária com uma IA de
// venda e outra de locação leria o número errado se a aba somasse as duas.
const RESULT_PERIODS: [number, string][] = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']];

export function ResultsTab({ agent }: { agent: SalesAgent }) {
  const [data, setData] = useState<AgentPerformance | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await salesAgentsService.performance(agent.id, days));
    } catch {
      toast.error('Não consegui carregar os resultados desta IA.');
    } finally {
      setLoading(false);
    }
  }, [agent.id, days]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1">
          {RESULT_PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                days === value
                  ? 'bg-primary/10 text-primary border-primary/40 font-medium'
                  : 'border-sidebar-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} aria-label="Atualizar" title="Atualizar" className="ml-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {loading && !data ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-sidebar-border bg-sidebar p-4">
          Esta IA ainda não tem atendimento registrado no período. Os números aparecem sozinhos
          conforme ela responde os leads.
        </p>
      ) : (
        // Segura o desenho anterior mais apagado ao recarregar, em vez de piscar
        // um esqueleto e fazer a tela sumir e voltar ao trocar de período.
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <AiResultsPanel
            counts={data}
            series={data.series}
            caption={`O que a IA “${agent.name}” entregou neste período`}
            seriesTitle="Dia a dia"
          />
          <p className="text-xs text-muted-foreground mt-6">
            Período: últimos {data.days} dias. Uma visita conta como “da IA” quando foi a própria IA
            que a marcou dentro da conversa — visita que o corretor marcou à mão não entra aqui.
          </p>
        </div>
      )}
    </div>
  );
}
