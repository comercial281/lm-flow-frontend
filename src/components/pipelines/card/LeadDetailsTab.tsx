// Aba Detalhes do card do lead (spec 2026-10-02):
//   1. "O que sabemos do lead": o que a IA entendeu + respostas do formulário;
//   2. Imóveis de interesse (era uma aba própria);
//   3. Histórico | Observações, lado a lado, cada um com a sua rolagem.
// Histórico e Observações NÃO se juntam: um o sistema escreve sozinho, o outro
// é o comentário que o corretor escolheu deixar (decisão do dono, 02/10).
import { Suspense, useState } from 'react';
import { History, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import AiUnderstandingPanel from '@/components/chat/contact-sidebar/AiUnderstandingPanel';
import CardNotesTab from '@/components/pipelines/CardNotesTab';
import { lazyWithRetry } from '@/utils/chunkReload';
import { RESPOSTAS_VISIVEIS, contatoDoCard, respostasDoLead } from '@/features/cardDoLead/cardDoLead';
import type { PipelineItem } from '@/types/analytics';
import type { Conversation } from '@/types/chat/api';
import type { ContactEvent } from '@/types/notifications/contact-events';

const CardPropertyInterests = lazyWithRetry(() => import('@/components/pipelines/CardPropertyInterests'));

// Os eventos da roleta são o motivo de o gestor abrir o histórico: quem aceitou o
// lead e por que ele trocou de corretor. O prefixo do id vem do backend.
const corDoEvento = (id: string): string => {
  if (id.startsWith('roleta-aceite-')) return 'bg-emerald-500';
  if (id.startsWith('roleta-repasse-') || id.startsWith('roleta-prazo-')) return 'bg-amber-500';
  if (id.startsWith('roleta-diag-')) return 'bg-red-500';
  if (id.startsWith('bolsao-')) return 'bg-indigo-500';
  if (id.startsWith('identity-')) return 'bg-sky-500';
  return 'bg-primary';
};

interface LeadDetailsTabProps {
  item: PipelineItem;
  mostrarImoveis: boolean;
  mostrarObservacoes: boolean;
  historico: ContactEvent[];
  carregandoHistorico: boolean;
  onRecarregarHistorico: () => void;
}

export default function LeadDetailsTab({
  item,
  mostrarImoveis,
  mostrarObservacoes,
  historico,
  carregandoHistorico,
  onRecarregarHistorico,
}: LeadDetailsTabProps) {
  const contato = contatoDoCard(item);
  const respostas = respostasDoLead(contato);
  const [todasAsRespostas, setTodasAsRespostas] = useState(false);
  const respostasVisiveis = todasAsRespostas ? respostas : respostas.slice(0, RESPOSTAS_VISIVEIS);
  const conversa = (item.conversation ?? null) as unknown as Conversation | null;

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* O que sabemos do lead */}
      {(conversa || respostas.length > 0) && (
        <div className="grid grid-cols-2 gap-4 shrink-0">
          <div className="min-w-0">
            {conversa && <AiUnderstandingPanel conversation={conversa} embutido />}
          </div>
          {respostas.length > 0 && (
            <div className="min-w-0 space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Respostas do formulário
              </h4>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
                {/* A chave leva o índice: pergunta repetida (formulário copiado)
                    tem o mesmo rótulo, e a segunda linha sumiria. */}
                {respostasVisiveis.map((r, i) => (
                  <div key={`${r.label}-${i}`} className="flex items-start justify-between gap-3 text-xs">
                    <span className="text-muted-foreground shrink-0 capitalize">{r.label}</span>
                    <span className="text-right font-medium break-words">{r.value}</span>
                  </div>
                ))}
              </div>
              {respostas.length > RESPOSTAS_VISIVEIS && (
                <button
                  type="button"
                  className="text-[11px] text-primary hover:underline"
                  onClick={() => setTodasAsRespostas(v => !v)}
                >
                  {todasAsRespostas ? 'Ver menos' : `Ver todas (${respostas.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Imóveis de interesse */}
      {mostrarImoveis && (
        <div className="shrink-0">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Imóveis de interesse
          </h4>
          <Suspense fallback={null}>
            <CardPropertyInterests item={item} />
          </Suspense>
        </div>
      )}

      {/* Histórico | Observações */}
      <div className={`grid ${mostrarObservacoes ? 'grid-cols-2' : 'grid-cols-1'} gap-4 flex-1 min-h-[220px]`}>
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
              <History className="h-3.5 w-3.5" />
              Histórico
            </h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={onRecarregarHistorico}
              disabled={carregandoHistorico}
              aria-label="Atualizar histórico"
              title="Atualizar histórico"
            >
              <RefreshCw className={`h-3 w-3 ${carregandoHistorico ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {carregandoHistorico ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : historico.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-12">Nenhuma atividade registrada.</p>
            ) : (
              historico.map(ev => (
                <div key={ev.id} className="flex gap-2 text-xs">
                  <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${corDoEvento(ev.id)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-medium break-words">{ev.eventName}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                        {new Date(ev.occurredAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {/* Quebra em vez de cortar: o texto do servidor é a ÚNICA
                        explicação de eventos como o "fora do horário" da roleta. */}
                    {ev.properties && Object.keys(ev.properties).length > 0 && (
                      <p className="text-muted-foreground whitespace-pre-wrap break-words">
                        {Object.entries(ev.properties).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {mostrarObservacoes && (
          <div className="flex flex-col min-h-0 border-l border-border pl-4">
            <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide mb-2 shrink-0">
              <MessageSquare className="h-3.5 w-3.5" />
              Observações
            </h4>
            <div className="flex-1 overflow-hidden min-h-0">
              <CardNotesTab contactId={contato?.id != null ? String(contato.id) : null} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
