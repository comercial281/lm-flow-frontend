// Painel → Visão geral: o que a IA precisa (pendências com "Corrigir"), o que ela
// entregou (os números que ficavam em Resultados) e as sugestões esperando
// resposta. É a primeira tela que abre.
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/ds';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, EyeOff, RefreshCw, Loader2 } from 'lucide-react';
import AiResultsPanel from '@/components/salesAgents/AiResultsPanel';
import { type AgentPerformance } from '@/types/aiResults';
import {
  salesAgentsService, type HealthReport, type SalesAgent, type SalesAgentSuggestion,
} from '@/services/salesAgents/salesAgentsService';
import { plural } from '@/lib/formato';
import type { TelaId } from '@/features/salesAgents/iaMenu';
import type { PaginaId } from '../configurar/paginas';
import type { PaginaDoEnsinar } from './ensinar/paginas';
import { motivoSemAtendimento, NUNCA_OCULTA, pendenciasDaIa, separarOcultas, type Situacao } from '@/features/salesAgents/situacao';
import { SuggestionCard } from './TelaSugestoes';
import UltimosAtendimentos from './UltimosAtendimentos';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';

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
  // Falha na leitura não vira "Nenhum atendimento no período".
  const [erroAoCarregar, setErroAoCarregar] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await salesAgentsService.performance(agent.id, days));
      setErroAoCarregar(false);
    } catch {
      setErroAoCarregar(true);
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
        <Carregando variante="texto" linhas={5} rotulo="Carregando…" />
      ) : !data && erroAoCarregar ? (
        <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={() => void load()} />
      ) : !data ? (
        <EmptyState
          tamanho="compacto"
          title={
            motivo
              ? `Nenhum atendimento no período. Motivo: ${motivo}. Os números aparecem sozinhos quando ela voltar a responder os leads.`
              : 'Esta IA ainda não tem atendimento registrado no período. Os números aparecem sozinhos conforme ela responde os leads.'
          }
        />
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
  /** Equipe da Leal Mídia: vê o custo e o erro técnico nos últimos atendimentos. */
  equipe: boolean;
  /** `pagina`: a página do Configurar (onda 3) ou do Ensinar que corrige a pendência. */
  aoIr: (tela: TelaId, pagina?: PaginaId | PaginaDoEnsinar) => void;
  /** Devolve a IA gravada ao ocultar/mostrar um aviso. */
  aoSalvo?: (a: SalesAgent) => void;
  /** Quem edita a IA oculta aviso amarelo do Painel (11/10/2026). */
  podeOcultar?: boolean;
  /** O número da IA é da API oficial: "Reconectar" leva à tela dele, não ao QR. */
  numeroOficial?: boolean;
}

export default function TelaVisaoGeral({ agent, situacao, diagnostico, conferindo, falhou = false, mostrarSugestoes, equipe, aoIr, aoSalvo, podeOcultar = false, numeroOficial = false }: TelaVisaoGeralProps) {
  const { visiveis, ocultas } = separarOcultas(pendenciasDaIa(agent, diagnostico, numeroOficial), agent.hidden_warnings);
  const [verOcultas, setVerOcultas] = useState(false);
  const [gravando, setGravando] = useState<string | null>(null);

  // Grava a lista inteira (o servidor limpa). Só quem edita a IA chega aqui.
  const mudarOcultas = async (chave: string, ocultar: boolean) => {
    const atual = agent.hidden_warnings ?? [];
    const nova = ocultar ? [...new Set([...atual, chave])] : atual.filter((k) => k !== chave);
    setGravando(chave);
    try {
      aoSalvo?.(await salesAgentsService.update(agent.id, { hidden_warnings: nova }));
    } catch {
      toast.error(ocultar ? 'Não consegui ocultar o aviso.' : 'Não consegui mostrar o aviso de novo.');
    } finally {
      setGravando(null);
    }
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="vg-pendencias" className="space-y-2">
        <h2 id="vg-pendencias" className="text-sm font-medium">O que precisa de atenção</h2>
        {visiveis.length === 0 ? (
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
            {visiveis.map((p) => (
              <li key={p.chave}>
                <Aviso
                  tom={p.grave ? 'erro' : 'atencao'}
                  titulo={p.titulo}
                  acao={
                    (p.corrigir || (podeOcultar && !p.grave && !NUNCA_OCULTA.has(p.chave))) ? (
                      <>
                        {/* Fora da IA (WhatsApp desconectado): link pra configuração do número. */}
                        {p.corrigir?.rota ? (
                          <Button asChild size="sm" variant="outline"><Link to={p.corrigir.rota}>Corrigir</Link></Button>
                        ) : p.corrigir ? (
                          <Button size="sm" variant="outline"
                            onClick={() => (p.corrigir!.pagina ? aoIr(p.corrigir!.tela, p.corrigir!.pagina) : aoIr(p.corrigir!.tela))}>
                            Corrigir
                          </Button>
                        ) : null}
                        {podeOcultar && !p.grave && !NUNCA_OCULTA.has(p.chave) && (
                          <Button size="sm" variant="ghost" disabled={gravando !== null} onClick={() => void mudarOcultas(p.chave, true)}>
                            <EyeOff className="h-3.5 w-3.5" aria-hidden /> Ocultar
                          </Button>
                        )}
                      </>
                    ) : undefined
                  }
                >
                  <p className="text-xs">{p.detalhe}</p>
                </Aviso>
              </li>
            ))}
          </ul>
        )}
        {ocultas.length > 0 && (
          <div className="space-y-2">
            <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              aria-expanded={verOcultas} onClick={() => setVerOcultas((v) => !v)}>
              {plural(ocultas.length, 'aviso oculto', 'avisos ocultos')} · {verOcultas ? 'Esconder' : 'Mostrar'}
            </button>
            {verOcultas && (
              <ul className="space-y-2">
                {ocultas.map((p) => (
                  <li key={p.chave}>
                    <Aviso tom="neutro" titulo={p.titulo}
                      acao={podeOcultar ? (
                        <Button size="sm" variant="ghost" disabled={gravando !== null} onClick={() => void mudarOcultas(p.chave, false)}>Mostrar de novo</Button>
                      ) : undefined}>
                      <p className="text-xs">{p.detalhe}</p>
                    </Aviso>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="vg-numeros" className="space-y-2">
        <h2 id="vg-numeros" className="text-sm font-medium">Números do período</h2>
        <ResultsTab agent={agent} motivo={motivoSemAtendimento(situacao)} />
      </section>

      <UltimosAtendimentos agentId={agent.id} completo={equipe} />

      {mostrarSugestoes && <SugestoesPendentes agent={agent} aoIr={aoIr} />}
    </div>
  );
}
