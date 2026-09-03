import { useState, type MouseEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Check, Clock, X, Loader2 } from 'lucide-react';
import { usePendingOffers } from '@/contexts/PendingOffersContext';
import { minutesLeft, type OfferLookup } from './pendingOffersMatch';
import type { BrokerAssignmentDetail } from '@/services/roletaConfig/brokerAssignmentsService';

// O selo "Aguardando seu aceite" com Aceitar/Recusar, onde o lead aparece.
//
// A roleta oferta com prazo, e até aqui a única porta de aceite dentro do app
// era a tela de aceite (pelo link do WhatsApp ou pela faixa amarela). O card
// no funil e a conversa mostravam o lead como de ninguém, sem dizer que ele
// estava esperando JUSTAMENTE quem estava olhando. Agora o aceite acontece
// onde o corretor está.
//
// Reaproveita as mesmas duas chamadas da tela de aceite (aceitar/recusar) —
// não existe segunda porta. `fallback` é o que se desenha quando não há
// oferta minha para este lead (o "Sem responsável" da lista, a faixa de
// Leilão da conversa).
interface OfferActionsProps extends OfferLookup {
  /** Só o selo com o prazo, sem os botões grandes — o card do funil é apertado. */
  compact?: boolean;
  fallback?: ReactNode;
  className?: string;
  onAccepted?: (offer: BrokerAssignmentDetail) => void;
  onRefused?: (offer: BrokerAssignmentDetail) => void;
}

// A API tem DOIS formatos de erro: `error.message` (padrão) e a recusa por
// cargo, que devolve `error` como texto e a explicação em `message`. Ler só o
// primeiro mostra a frase genérica no lugar de "seu cargo não permite".
function reasonOf(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  const err = data?.error;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  if (typeof data?.message === 'string') return data.message;
  if (typeof err === 'string') return err;
  return fallback;
}

export default function OfferActions({
  contactId,
  conversationId,
  conversationDisplayId,
  compact = false,
  fallback = null,
  className = '',
  onAccepted,
  onRefused,
}: OfferActionsProps) {
  const { offerFor, accept, refuse } = usePendingOffers();
  const [acting, setActing] = useState<null | 'accept' | 'refuse'>(null);

  const offer = offerFor({ contactId, conversationId, conversationDisplayId });
  if (!offer) return <>{fallback}</>;

  const left = minutesLeft(offer);
  const prazo = left > 0 ? `${left} min` : 'prazo esgotado';

  // O card inteiro é clicável (abre a ficha): o clique nos botões não pode
  // subir.
  const stop = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  async function onAccept(e: MouseEvent) {
    stop(e);
    setActing('accept');
    try {
      const result = await accept(offer!.id);
      toast.success('Lead aceito! Ele é seu.');
      onAccepted?.(result);
    } catch (err) {
      toast.error(reasonOf(err, 'Não foi possível aceitar.'));
    } finally {
      setActing(null);
    }
  }

  async function onRefuse(e: MouseEvent) {
    stop(e);
    setActing('refuse');
    try {
      const result = await refuse(offer!.id);
      toast.info('Lead recusado. Passamos para o próximo corretor.');
      onRefused?.(result);
    } catch (err) {
      toast.error(reasonOf(err, 'Não foi possível recusar.'));
    } finally {
      setActing(null);
    }
  }

  const btnBase = 'inline-flex items-center gap-1 rounded-md font-medium transition-colors disabled:opacity-60';
  const size = compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      onClick={stop}
      data-testid="offer-actions"
    >
      <span
        className={`inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 ${size}`}
        title="A roleta ofertou este lead a você. Ele só vira seu quando você aceitar."
      >
        <Clock className="h-3 w-3 flex-shrink-0" />
        Aguardando seu aceite · {prazo}
      </span>
      <button
        type="button"
        onClick={onAccept}
        disabled={!!acting}
        className={`${btnBase} ${size} bg-emerald-600 text-white hover:bg-emerald-700`}
      >
        {acting === 'accept' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        Aceitar
      </button>
      <button
        type="button"
        onClick={onRefuse}
        disabled={!!acting}
        className={`${btnBase} ${size} border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30`}
      >
        {acting === 'refuse' ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        Recusar
      </button>
    </div>
  );
}
