import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Loader2, Check, Lightbulb, Users, MessageSquare, Sparkles, X } from 'lucide-react';
import { dolar, plural } from '@/lib/formato';
import { salesAgentsService, type SalesAgent, type SalesAgentSuggestion, type SuggestionsPayload } from '@/services/salesAgents/salesAgentsService';
import { motivoDaFalha } from '@/features/salesAgents/erroDoServidor';
import { Seletor } from '@/components/base/Seletor';

// ---------------- Sugestões (a IA relê as conversas e propõe melhorias) ----------------

const SUGGESTION_PERIODS: [number, string][] = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']];

export const WEEKDAY_OPTIONS: [number, string][] = [
  [1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado'], [7, 'Domingo'],
];

// Selo por categoria. A cor separa o que é da IA do que é recado para gente.
const SUGGESTION_STYLE: Record<string, string> = {
  objecao: 'bg-amber-500/10 text-amber-600',
  pergunta: 'bg-blue-500/10 text-blue-600',
  travamento: 'bg-red-500/10 text-red-500',
  operacao: 'bg-violet-500/10 text-violet-500',
};

export default function TelaSugestoes({ agent }: { agent: SalesAgent }) {
  const [data, setData] = useState<SuggestionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [days, setDays] = useState(30);
  const [mostrarDescartadas, setMostrarDescartadas] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await salesAgentsService.listSuggestions(agent.id));
    } catch {
      // Leitura que a própria tela dispara ao abrir não grita: o pedaço
      // simplesmente não aparece. Aviso é para quando a pessoa clicou.
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => { void load(); }, [load]);

  /**
   * ⚠️ O botão COMEÇA a análise; ele não espera por ela.
   *
   * A IA lê as conversas do período e escreve as sugestões: 30 a 90 segundos. O
   * servidor derruba qualquer requisição que passe de 15, e a requisição derrubada
   * volta SEM motivo dentro — foi por isso que este botão só sabia dizer "Não
   * consegui analisar agora", que é a frase que não explica nada. Agora o servidor
   * responde na hora e a tela pergunta o estado até terminar.
   */
  const analisar = async () => {
    setAnalyzing(true);
    try {
      const inicio = await salesAgentsService.analyzeSuggestions(agent.id, days);
      setData(inicio);
      const quantasAntes = inicio.suggestions.length;
      if (!inicio.analyzing) {
        finalizarAnalise(inicio, quantasAntes);
        return;
      }
      await acompanharAnalise(quantasAntes);
    } catch (e) {
      // Aqui a pessoa CLICOU: o motivo em português vem do servidor.
      toast.error(motivoDaFalha(e, 'Não consegui analisar agora.'));
      setAnalyzing(false);
    }
  };

  /**
   * Pergunta ao servidor de 4 em 4 segundos até a análise sair do ar. O teto de ~4
   * minutos é rede de segurança para o processo que morre no meio (deploy): sem ele
   * a tela ficaria "Analisando..." para sempre. A reserva do servidor expira sozinha
   * em 10 minutos, então o botão nunca fica travado de verdade.
   */
  const acompanharAnalise = async (quantasAntes: number) => {
    for (let tentativa = 0; tentativa < 60; tentativa += 1) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const atual = await salesAgentsService.listSuggestions(agent.id);
        setData(atual);
        if (!atual.analyzing) {
          finalizarAnalise(atual, quantasAntes);
          return;
        }
      } catch {
        // Oscilação de rede no meio da espera não é motivo para desistir da
        // análise, que continua rodando no servidor. Tenta de novo no próximo ciclo.
      }
    }
    setAnalyzing(false);
    toast.message('A análise está demorando mais que o normal. Recarregue a aba em instantes.');
  };

  const finalizarAnalise = (payload: SuggestionsPayload, quantasAntes: number) => {
    setAnalyzing(false);
    if (payload.analysis_error) {
      toast.error(payload.analysis_error);
      return;
    }
    const novas = payload.suggestions.length - quantasAntes;
    toast.success(novas > 0 ? plural(novas, 'sugestão nova', 'sugestões novas') : 'Nenhum padrão novo desta vez');
  };

  const aplicar = async (s: SalesAgentSuggestion) => {
    setBusyId(s.id);
    try {
      await salesAgentsService.applySuggestion(agent.id, s.id);
      toast.success('Aplicada — virou lição na aba Aprendizado');
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

  const salvarAuto = async (patch: { auto?: boolean; weekday?: number; hour?: number }) => {
    try {
      const auto = await salesAgentsService.saveSuggestionConfig(agent.id, patch);
      setData((prev) => (prev ? { ...prev, auto } : prev));
      toast.success('Salvo');
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  const todas = data?.suggestions ?? [];
  const visiveis = mostrarDescartadas ? todas : todas.filter((s) => s.status !== 'dismissed');
  const descartadas = todas.length - todas.filter((s) => s.status !== 'dismissed').length;
  const noTeto = (data?.lessons_active ?? 0) >= (data?.lessons_cap ?? 12);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        A IA relê as conversas que ela atendeu e aponta o que se repete: a objeção que derruba
        lead, a pergunta que ela não soube responder, onde a conversa morre. O que é sobre o jeito
        de ela falar você aplica com um clique e vira lição. O que é sobre o time fica como recado.
      </p>

      {/* Analisar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {SUGGESTION_PERIODS.map(([value, label]) => (
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
        <Button size="sm" onClick={() => void analisar()} disabled={analyzing} className="ml-auto">
          {analyzing
            ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Lendo as conversas…</>
            : <><Sparkles className="h-4 w-4 mr-1" /> Analisar agora</>}
        </Button>
      </div>

      {/* Automático */}
      <div className="rounded-lg border border-sidebar-border bg-sidebar p-4 space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data?.auto.auto ?? false}
            onChange={(e) => void salvarAuto({ auto: e.target.checked })}
          />
          Analisar sozinha toda semana
        </label>
        <p className="text-xs text-muted-foreground">
          Cada análise é uma consulta paga à IA. Desligada, ela só roda quando você clica em
          <span className="font-medium"> Analisar agora</span>.
        </p>
        {data?.auto.auto && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Seletor
              value={data.auto.weekday}
              onChange={(e) => void salvarAuto({ weekday: Number(e.target.value) })}
              className="w-28 rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm"
            >
              {WEEKDAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Seletor>
            <span className="text-sm text-muted-foreground">às</span>
            <Seletor
              value={data.auto.hour}
              onChange={(e) => void salvarAuto({ hour: Number(e.target.value) })}
              className="w-24 rounded-md border border-sidebar-border bg-background px-3 py-1.5 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </Seletor>
          </div>
        )}
      </div>

      {/* Lista */}
      {loading && !data ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-sidebar-border bg-sidebar p-4">
          Nenhuma sugestão ainda. Clique em <span className="font-medium">Analisar agora</span> — a IA
          precisa de conversas atendidas no período para encontrar um padrão.
        </p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              busy={busyId === s.id}
              onApply={() => void aplicar(s)}
              onDismiss={() => void descartar(s)}
            />
          ))}
        </ul>
      )}

      {descartadas > 0 && (
        <button
          type="button"
          onClick={() => setMostrarDescartadas((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {mostrarDescartadas ? 'Esconder' : 'Ver'} {plural(descartadas, 'descartada', 'descartadas')}
        </button>
      )}

      {/* Rodapé: o que já custou e quanto a IA de fato lê */}
      {data && (
        <div className="pt-3 border-t border-sidebar-border text-xs text-muted-foreground space-y-1">
          {data.last_analysis_at && (
            <p>
              Última análise em {new Date(data.last_analysis_at).toLocaleDateString('pt-BR')}
              {data.last_analysis_cost_usd > 0 && ` — custou ${dolar(data.last_analysis_cost_usd, 4)}`}
            </p>
          )}
          <p className={noTeto ? 'text-amber-600' : undefined}>
            {plural(data.lessons_active, 'lição ativa', 'lições ativas')}.
            {noTeto
              ? ` A IA lê no máximo ${data.lessons_cap} de cada tipo: aplicar mais não muda o comportamento dela. Remova as que já não valem, na aba Aprendizado.`
              : ` Ela lê até ${data.lessons_cap} de cada tipo.`}
          </p>
        </div>
      )}
    </div>
  );
}

export function SuggestionCard({
  suggestion, busy, onApply, onDismiss,
}: {
  suggestion: SalesAgentSuggestion;
  busy: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const conversas = suggestion.evidence?.conversations ?? 0;
  const citacoes = suggestion.evidence?.quotes ?? [];
  const aplicada = suggestion.status === 'applied';
  const descartada = suggestion.status === 'dismissed';

  return (
    <li className={`rounded-lg border border-sidebar-border p-4 space-y-2 ${descartada ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${SUGGESTION_STYLE[suggestion.category] ?? 'bg-primary/10 text-primary'}`}>
          {suggestion.category_label}
        </span>
        {/* ⚠️ O selo do time não é enfeite: ele explica por que não existe botão
            de aplicar. Recado para gente virando lição faria a IA repetir isso
            para o lead. */}
        {suggestion.target === 'equipe' && (
          <span className="text-xs px-2 py-0.5 rounded shrink-0 bg-sidebar text-muted-foreground border border-sidebar-border">
            <Users className="h-3 w-3 inline mr-1" />Recado para o time
          </span>
        )}
        {aplicada && (
          <span className="text-xs px-2 py-0.5 rounded shrink-0 bg-green-500/10 text-green-600">
            <Check className="h-3 w-3 inline mr-1" />Aplicada
          </span>
        )}
        <span className="flex-1" />
        {conversas > 0 && (
          <span className="text-xs text-muted-foreground shrink-0" title="Em quantas conversas isso apareceu">
            <MessageSquare className="h-3 w-3 inline mr-1" />{conversas}
          </span>
        )}
      </div>

      <div className="text-sm font-medium">{suggestion.title}</div>
      {suggestion.body && <p className="text-sm text-muted-foreground">{suggestion.body}</p>}

      {citacoes.length > 0 && (
        <ul className="space-y-1 pt-1">
          {citacoes.map((q, i) => (
            <li key={i} className="text-xs text-muted-foreground border-l-2 border-sidebar-border pl-2 italic">
              “{q}”
            </li>
          ))}
        </ul>
      )}

      {suggestion.appliable && suggestion.lesson_content && (
        <div className="text-xs rounded-md bg-sidebar border border-sidebar-border p-2">
          <span className="text-muted-foreground">Vira esta lição: </span>
          {suggestion.lesson_content}
        </div>
      )}

      {!descartada && (
        <div className="flex gap-2 pt-1">
          {/* Quem manda no botão é o servidor (`appliable`), não uma dedução da tela. */}
          {suggestion.appliable && !aplicada && (
            <Button size="sm" onClick={onApply} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lightbulb className="h-4 w-4 mr-1" /> Aplicar</>}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDismiss} disabled={busy}>
            <X className="h-4 w-4 mr-1" /> Descartar
          </Button>
        </div>
      )}
    </li>
  );
}
