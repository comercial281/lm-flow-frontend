import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '@evoapi/design-system/card';
import { Brain, ChevronDown, ArrowRightLeft, History, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

import type { Conversation } from '@/types/chat/api';
import { chatService } from '@/services/chat/chatService';
import type { SalesAgentLeadReport } from '@/types/analytics/pipelines';

/**
 * "O que a IA entendeu" — as leituras da IA Vendedora sobre ESTE lead.
 *
 * A cada turno a IA grava temperatura, resumo, o que já coletou, etapa, intenção
 * e humor do lead. Tudo isso já viajava para o navegador junto com a conversa e
 * NÃO tinha lugar nenhum na tela: o corretor que assumia o lead só enxergava a
 * etiqueta (lead-quente / lead-morno / lead-frio) e precisava reler a conversa
 * inteira para descobrir o resto — que a IA já havia perguntado e anotado.
 *
 * Some sozinho quando a IA ainda não leu nada, para não virar espaço morto na
 * lateral de conversa sem IA.
 */

const TEMPERATURA: Record<string, { label: string; classe: string }> = {
  hot: { label: 'Quente', classe: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  warm: { label: 'Morno', classe: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  cold: { label: 'Frio', classe: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400' },
  unknown: { label: 'Ainda não dá pra dizer', classe: 'bg-muted text-muted-foreground' },
};

const ETAPA: Record<string, string> = {
  descobrindo: 'Descobrindo o que ele quer',
  qualificando: 'Qualificando',
  pronto_para_visita: 'Pronto para visitar',
  agendando: 'Agendando a visita',
  agendado: 'Visita agendada',
  transferir: 'Para passar a um corretor',
};

const INTENCAO: Record<string, string> = {
  comprador: 'Procurando imóvel',
  captacao: 'Quer vender/anunciar um imóvel',
  curioso: 'Só curioso',
  spam: 'Spam',
};

const HUMOR: Record<string, string> = {
  neutro: 'Neutro',
  positivo: 'Animado',
  frustrado: 'Frustrado',
  irritado: 'Irritado',
};

// Ordem de leitura, não ordem alfabética: é a sequência em que o corretor
// pergunta essas coisas numa conversa de verdade.
const COLETADO: Array<{ chave: string; rotulo: string }> = [
  { chave: 'motivo', rotulo: 'Por que está procurando' },
  { chave: 'tipo_imovel', rotulo: 'Tipo de imóvel' },
  { chave: 'regiao', rotulo: 'Região' },
  { chave: 'orcamento', rotulo: 'Orçamento' },
  { chave: 'prazo', rotulo: 'Prazo' },
  { chave: 'financiamento', rotulo: 'Financiamento' },
  { chave: 'fgts', rotulo: 'FGTS' },
];

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

interface Props {
  conversation: Conversation | null;
}

export default function AiUnderstandingPanel({ conversation }: Props) {
  const [aberto, setAberto] = useState(true);
  const [logsAbertos, setLogsAbertos] = useState(false);
  const [report, setReport] = useState<SalesAgentLeadReport | null>(null);

  // Histórico da IA nesta conversa: os turnos que ela já rodou (respondeu, pulou
  // ou falhou) + o próximo passo que o backend calcula. Mesmo dado que a janela
  // "Ativar IA" já usa (getSalesAgentStatus) — só que aqui fica plugado direto
  // na aba, sem precisar abrir aquela janela pra ver (pedido do Giovani, 19/08:
  // "os próximos envios e disparos programados ou não, se meio que morreu").
  useEffect(() => {
    if (!conversation?.id) {
      setReport(null);
      return;
    }
    let alive = true;
    chatService
      .getSalesAgentStatus(conversation.id)
      .then(r => { if (alive) setReport(r); })
      .catch(() => { if (alive) setReport(null); });
    return () => { alive = false; };
  }, [conversation?.id]);

  const attrs = (conversation?.additional_attributes ?? {}) as Record<string, unknown>;

  const temperatura = texto(attrs.sales_agent_temperature);
  const resumo = texto(attrs.sales_agent_summary);
  const etapa = texto(attrs.sales_agent_stage);
  const intencao = texto(attrs.sales_agent_intent);
  const humor = texto(attrs.sales_agent_sentiment);
  const transferiu = attrs.sales_agent_handoff === true;
  const motivoTransferencia = texto(attrs.sales_agent_handoff_reason);
  // A IA QUIS passar o lead e o cenário de repasse escolhido segurou. Sem esta linha o
  // pedido some: a resposta ao lead já foi enviada quando a decisão acontece, então ele
  // pode estar esperando uma pessoa que a IA prometeu e o corretor não faz ideia.
  const repasseSegurado = transferiu ? '' : texto(attrs.sales_agent_handoff_blocked_reason);

  const coletadoBruto = (attrs.sales_agent_collected ?? {}) as Record<string, unknown>;
  const coletado = COLETADO.map(c => ({ ...c, valor: texto(coletadoBruto[c.chave]) })).filter(c => c.valor);

  // "unknown" sozinho não é leitura: é a IA dizendo que ainda não sabe. Nesse
  // caso o bloco só aparece se houver alguma outra coisa de verdade para mostrar
  // — incluindo o log de turnos (uma IA que só falhou não tem "leitura" nenhuma
  // do lead, mas o corretor ainda precisa ver que ela tentou e não deu certo).
  const temLog = Boolean(report && (report.runs.length > 0 || report.why));
  const temLeitura =
    (temperatura && temperatura !== 'unknown') ||
    Boolean(resumo) ||
    Boolean(etapa) ||
    coletado.length > 0 ||
    transferiu ||
    Boolean(repasseSegurado) ||
    temLog;

  if (!temLeitura) return null;

  const temp = TEMPERATURA[temperatura] ?? null;

  return (
    <Card className="border-violet-200 bg-violet-50/30 dark:border-violet-800 dark:bg-violet-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Brain className="h-4 w-4 text-violet-500 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold truncate">O que a IA entendeu</h3>
              <p className="text-xs text-muted-foreground truncate">
                {temp ? `Lead ${temp.label.toLowerCase()}` : 'Leitura da IA Vendedora'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAberto(!aberto)}
            aria-expanded={aberto}
            aria-label={aberto ? 'Fechar o que a IA entendeu' : 'Abrir o que a IA entendeu'}
            className="p-1 text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${aberto ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </CardHeader>

      {aberto && (
        <CardContent className="pt-0 px-3 pb-3">
          <div className="space-y-2">
            {temp && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Temperatura</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${temp.classe}`}>{temp.label}</span>
              </div>
            )}

            {etapa && ETAPA[etapa] && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Etapa</span>
                <span className="font-medium text-right max-w-[60%]">{ETAPA[etapa]}</span>
              </div>
            )}

            {intencao && INTENCAO[intencao] && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Interesse</span>
                <span className="font-medium text-right max-w-[60%]">{INTENCAO[intencao]}</span>
              </div>
            )}

            {/* Humor só quando NÃO é neutro: "Neutro" em toda conversa é ruído que
                esconde as duas leituras que realmente pedem ação. */}
            {humor && humor !== 'neutro' && HUMOR[humor] && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Como está se sentindo</span>
                <span className="font-medium text-right max-w-[60%]">{HUMOR[humor]}</span>
              </div>
            )}

            {coletado.length > 0 && (
              <div className="pt-1 mt-1 border-t border-violet-200/60 dark:border-violet-800/60 space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ela já perguntou</p>
                {coletado.map(c => (
                  <div key={c.chave} className="flex justify-between text-xs gap-2">
                    <span className="text-muted-foreground flex-shrink-0">{c.rotulo}</span>
                    <span className="lm-redact font-medium text-right break-words">{c.valor}</span>
                  </div>
                ))}
              </div>
            )}

            {resumo && (
              <div className="lm-redact text-xs text-muted-foreground bg-muted/40 rounded p-2 mt-1">{resumo}</div>
            )}

            {transferiu && (
              <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 mt-1">
                <ArrowRightLeft className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>
                  Passou para um corretor
                  {motivoTransferencia ? `: ${motivoTransferencia}` : '.'}
                </span>
              </div>
            )}

            {repasseSegurado && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1">
                <ArrowRightLeft className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>
                  A IA quis passar este lead e o cenário escolhido segurou: {repasseSegurado}.
                </span>
              </div>
            )}

            {/* Log da IA nesta conversa: turno a turno (respondeu/pulou/falhou) +
                o próximo passo calculado pelo backend. Fica fechado por padrão —
                é detalhe de investigação, não a primeira coisa que se quer ver. */}
            {temLog && report && (
              <div className="pt-2 mt-2 border-t border-violet-200/60 dark:border-violet-800/60">
                <button
                  type="button"
                  onClick={() => setLogsAbertos(!logsAbertos)}
                  aria-expanded={logsAbertos}
                  className="flex w-full items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <History className="h-3 w-3" />
                    Histórico e próximos passos
                    {report.runs.length > 0 && (
                      <span className="normal-case font-normal">({report.runs.length})</span>
                    )}
                  </span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${logsAbertos ? 'rotate-180' : ''}`} />
                </button>

                {logsAbertos && (
                  <div className="mt-2 space-y-2">
                    <div className="rounded bg-muted/40 p-2 space-y-1">
                      <p className="text-xs">{report.why}</p>
                      {report.next_step && (
                        <p className="text-xs text-muted-foreground">{report.next_step}</p>
                      )}
                    </div>

                    {report.runs.length > 0 && (
                      <ul className="space-y-1">
                        {report.runs.map((run, i) => {
                          const Icon =
                            run.status === 'replied' && run.delivered
                              ? CheckCircle2
                              : run.status === 'failed'
                                ? XCircle
                                : MinusCircle;
                          const cor =
                            run.status === 'replied' && run.delivered
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : run.status === 'failed'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-muted-foreground';
                          const rotulo =
                            run.status === 'replied'
                              ? run.delivered
                                ? 'Respondeu o lead'
                                : 'Gerou resposta, mas não conseguiu enviar'
                              : run.status === 'failed'
                                ? `Falhou: ${run.error_message ?? 'erro no servidor'}`
                                : (run.reason_label ?? 'Não respondeu');
                          return (
                            <li key={i} className="flex items-start gap-1.5 text-[11px]">
                              <Icon className={`h-3 w-3 mt-0.5 flex-shrink-0 ${cor}`} />
                              <span className="text-muted-foreground">
                                {new Date(run.created_at).toLocaleString('pt-BR')} · {rotulo}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
