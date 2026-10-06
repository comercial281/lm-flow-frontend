// Painel → Visão geral: o que a IA precisa (pendências com "Corrigir"), o que ela
// entregou (os números que ficavam em Resultados) e as sugestões esperando
// resposta. É a primeira tela que abre.
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/ds';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import AiResultsPanel from '@/components/salesAgents/AiResultsPanel';
import { type AgentPerformance } from '@/types/aiResults';
import {
  salesAgentsService, type HealthReport, type SalesAgent, type SalesAgentSuggestion,
} from '@/services/salesAgents/salesAgentsService';
import { plural } from '@/lib/formato';
import type { TelaId } from '@/features/salesAgents/iaMenu';
import { motivoSemAtendimento, pendenciasDaIa, type Situacao } from '@/features/salesAgents/situacao';
import { SuggestionCard } from './TelaSugestoes';

// Visão geral, números do período — o que ESTA IA produziu, pro próprio cliente ver.
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

export function ResultsTab({ agent, motivo = null }: { agent: SalesAgent; motivo?: string | null }) {
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
          {motivo
            ? `Nenhum atendimento no período. Motivo: ${motivo}. Os números aparecem sozinhos quando ela voltar a responder os leads.`
            : 'Esta IA ainda não tem atendimento registrado no período. Os números aparecem sozinhos conforme ela responde os leads.'}
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

/** Até 3 sugestões esperando resposta; o resto fica em Painel → Sugestões. */
function SugestoesPendentes({ agent, aoIr }: { agent: SalesAgent; aoIr: (tela: TelaId) => void }) {
  const [pendentes, setPendentes] = useState<SalesAgentSuggestion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await salesAgentsService.listSuggestions(agent.id);
      setPendentes(data.suggestions.filter((s) => s.status === 'pending'));
    } catch {
      // Leitura de fundo não grita: o bloco simplesmente não aparece.
      setPendentes([]);
    }
  }, [agent.id]);

  useEffect(() => { void load(); }, [load]);

  const aplicar = async (s: SalesAgentSuggestion) => {
    setBusyId(s.id);
    try {
      await salesAgentsService.applySuggestion(agent.id, s.id);
      toast.success('Aplicada: virou lição em Ensinar');
      await load();
    } catch {
      toast.error('Não consegui transformar em lição.');
    } finally {
      setBusyId(null);
    }
  };

  const descartar = async (s: SalesAgentSuggestion) => {
    setBusyId(s.id);
    try {
      await salesAgentsService.dismissSuggestion(agent.id, s.id);
      await load();
    } catch {
      toast.error('Não consegui descartar.');
    } finally {
      setBusyId(null);
    }
  };

  if (pendentes.length === 0) return null;

  return (
    <section aria-labelledby="vg-sugestoes" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="vg-sugestoes" className="text-sm font-medium">
          {plural(pendentes.length, 'sugestão esperando você', 'sugestões esperando você')}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => aoIr('sugestoes')}>Ver todas</Button>
      </div>
      <ul className="space-y-3">
        {pendentes.slice(0, 3).map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            busy={busyId === s.id}
            onApply={() => void aplicar(s)}
            onDismiss={() => void descartar(s)}
          />
        ))}
      </ul>
    </section>
  );
}

export interface TelaVisaoGeralProps {
  agent: SalesAgent;
  situacao: Situacao;
  diagnostico: HealthReport | null;
  /** O Diagnóstico ainda está sendo lido: não dá pra dizer "nada pendente". */
  conferindo: boolean;
  /** A leitura do Diagnóstico falhou: "nada pendente" seria afirmar sem ter conferido. */
  falhou?: boolean;
  /** Mesma chave das telas Sugestões e Relatório semanal (`ia_insights`). */
  mostrarSugestoes: boolean;
  aoIr: (tela: TelaId, passo?: number) => void;
}

export default function TelaVisaoGeral({ agent, situacao, diagnostico, conferindo, falhou = false, mostrarSugestoes, aoIr }: TelaVisaoGeralProps) {
  const pendencias = pendenciasDaIa(agent, diagnostico);

  return (
    <div className="space-y-8">
      <section aria-labelledby="vg-pendencias" className="space-y-2">
        <h2 id="vg-pendencias" className="text-sm font-medium">O que precisa de atenção</h2>
        {pendencias.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar p-4 text-sm text-muted-foreground">
            {conferindo ? (
              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Conferindo a situação desta IA…</>
            ) : falhou ? (
              <><AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden /> Não consegui conferir a situação desta IA agora.</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> Nada pendente: ela tem tudo para atender.</>
            )}
          </p>
        ) : (
          <ul className="space-y-2">
            {pendencias.map((p) => (
              <li
                key={p.chave}
                className={`flex items-start gap-3 rounded-md border p-3 ${p.grave ? 'border-red-500/40 bg-red-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}
              >
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${p.grave ? 'text-red-500' : 'text-amber-500'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{p.titulo}</div>
                  <div className="text-xs text-muted-foreground">{p.detalhe}</div>
                </div>
                {p.corrigir && (
                  <Button size="sm" variant="outline"
                    onClick={() => (p.corrigir!.passo !== undefined ? aoIr(p.corrigir!.tela, p.corrigir!.passo) : aoIr(p.corrigir!.tela))}>
                    Corrigir
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="vg-numeros" className="space-y-2">
        <h2 id="vg-numeros" className="text-sm font-medium">Números do período</h2>
        <ResultsTab agent={agent} motivo={motivoSemAtendimento(situacao)} />
      </section>

      {mostrarSugestoes && <SugestoesPendentes agent={agent} aoIr={aoIr} />}
    </div>
  );
}
