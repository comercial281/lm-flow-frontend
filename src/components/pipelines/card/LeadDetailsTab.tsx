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
import OutrasInformacoes from './OutrasInformacoes';
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

  const historicoBloco = (
    <div className="flex flex-col min-h-0 flex-1 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Histórico
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={onRecarregarHistorico}
          disabled={carregandoHistorico}
          aria-label="Atualizar histórico"
          title="Atualizar histórico"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${carregandoHistorico ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {carregandoHistorico ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : historico.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhuma atividade registrada.</p>
        ) : (
          historico.map(ev => (
            <div key={ev.id} className="flex gap-2.5 text-sm">
              <div className={`mt-2 w-2 h-2 rounded-full shrink-0 ${corDoEvento(ev.id)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium break-words">{ev.eventName}</span>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {new Date(ev.occurredAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {/* Quebra em vez de cortar: o texto do servidor é a ÚNICA
                    explicação de eventos como o "fora do horário" da roleta. */}
                {ev.properties && Object.keys(ev.properties).length > 0 && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                    {Object.entries(ev.properties).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-2">
      {/* Esquerda: o que sabemos do lead + imóveis, em caixas */}
      <div className="flex flex-col gap-4 min-w-0">
        {conversa && (
          // empty:hidden — o painel não desenha nada quando a IA não tem o que
          // dizer, e a caixa vazia ficaria sobrando.
          <div className="rounded-xl border border-border p-4 empty:hidden">
            <AiUnderstandingPanel conversation={conversa} embutido />
          </div>
        )}

        <div className="rounded-xl border border-border p-4 space-y-3">
          <h4 className="text-sm font-semibold">Respostas do formulário</h4>
          {respostas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este lead não respondeu formulário.</p>
          ) : (
            <>
              {/* A chave leva o índice: pergunta repetida (formulário copiado)
                  tem o mesmo rótulo, e a segunda linha sumiria. */}
              <dl className="space-y-2.5">
                {respostasVisiveis.map((r, i) => (
                  <div key={`${r.label}-${i}`} className="space-y-0.5">
                    <dt className="text-xs text-muted-foreground capitalize">{r.label}</dt>
                    <dd className="text-sm font-medium break-words">{r.value}</dd>
                  </div>
                ))}
              </dl>
              {respostas.length > RESPOSTAS_VISIVEIS && (
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => setTodasAsRespostas(v => !v)}
                >
                  {todasAsRespostas ? 'Ver menos' : `Ver todas (${respostas.length})`}
                </button>
              )}
            </>
          )}
        </div>

        {mostrarImoveis && (
          <div className="rounded-xl border border-border p-4 space-y-3">
            <h4 className="text-sm font-semibold">Imóveis de interesse</h4>
            <Suspense fallback={null}>
              <CardPropertyInterests item={item} />
            </Suspense>
          </div>
        )}

        {contato?.id != null && (
          <OutrasInformacoes
            contactId={String(contato.id)}
            atributos={contato.custom_attributes as Record<string, unknown> | null | undefined}
          />
        )}
      </div>

      {/* Direita: Histórico em cima, Observações embaixo — separados de
          propósito (um o sistema escreve, o outro é o comentário do corretor). */}
      <div className="flex flex-col gap-4 min-h-[480px] lg:min-h-0">
        {historicoBloco}
        {mostrarObservacoes && (
          <div className="flex flex-col min-h-0 flex-1 rounded-xl border border-border p-4">
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-3 shrink-0">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
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
