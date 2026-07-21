import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button } from '@/components/ui/ds';
import { Check, Loader2, TrendingUp } from 'lucide-react';
import {
  capiEventsService,
  CAPI_MANUAL_HINTS,
  CAPI_MANUAL_LABELS,
  type CapiManualEvent,
  type CapiManualStatus,
} from '@/services/capi/capiEventsService';

interface CapiConversionPanelProps {
  contactId?: string | number | null;
  pipelineItemId?: string | number | null;
  className?: string;
}

function formatSentAt(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Seção "Conversão Meta" — disparo MANUAL de conversão pro Meta Ads (Pixel/CAPI).
 *
 * Aparece dentro do card do lead (aba Detalhes) e na sidebar da conversa. É
 * paralela ao disparo automático por coluna: aqui quem decide é o atendente.
 * Marcar Qualificado manda o evento de Lead pro Meta buscar gente parecida;
 * Desqualificado manda como exclusão; Venda manda Purchase com valor.
 */
export default function CapiConversionPanel({
  contactId,
  pipelineItemId,
  className,
}: CapiConversionPanelProps) {
  const [status, setStatus] = useState<CapiManualStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  const hasTarget = Boolean(contactId || pipelineItemId);

  const load = useCallback(async () => {
    if (!hasTarget) {
      setLoading(false);
      return;
    }
    try {
      const data = await capiEventsService.status({ contactId, pipelineItemId });
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [contactId, pipelineItemId, hasTarget]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function handleSend(event: CapiManualEvent) {
    if (sending) return;
    setSending(event.event_name);
    try {
      const updated = await capiEventsService.send({ contactId, pipelineItemId }, event.event_name);
      setStatus(updated);
      toast.success(`${CAPI_MANUAL_LABELS[event.event_name] ?? event.event_name} enviado ao Meta.`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response
          ?.data?.error?.message ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Não foi possível enviar a conversão.';
      toast.error(message);
    } finally {
      setSending(null);
    }
  }

  if (!hasTarget || loading) return null;
  // Cliente sem pixel configurado: a seção não polui a tela de quem não usa CAPI.
  if (!status || !status.is_enabled) return null;

  return (
    <div className={`rounded-lg border border-border p-3 space-y-3 ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Conversão Meta</span>
        <Badge variant="secondary" className="text-[10px]">
          Meta Ads
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Isso alimenta os anúncios, não substitui o CRM. Marque como o lead terminou para o Meta
        aprender quem vale a pena buscar.
      </p>

      <div className="flex flex-wrap gap-2">
        {status.events.map((event) => {
          const sent = Boolean(event.sent_at);
          const isSending = sending === event.event_name;
          return (
            <Button
              key={event.event_name}
              type="button"
              size="sm"
              variant={sent ? 'default' : 'outline'}
              disabled={Boolean(sending)}
              onClick={() => handleSend(event)}
              title={CAPI_MANUAL_HINTS[event.event_name] ?? ''}
              className="gap-1.5"
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : sent ? (
                <Check className="h-3.5 w-3.5" />
              ) : null}
              {CAPI_MANUAL_LABELS[event.event_name] ?? event.event_name}
            </Button>
          );
        })}
      </div>

      {status.events
        .filter((event) => event.sent_at)
        .map((event) => (
          <p key={event.event_name} className="text-[11px] text-muted-foreground">
            {CAPI_MANUAL_LABELS[event.event_name] ?? event.event_name} enviado em{' '}
            {formatSentAt(event.sent_at as string)}
            {event.sent_by ? ` por ${event.sent_by}` : ''}
            {event.sent_to?.includes('lm') ? ' (cliente + acervo LM)' : ''}
          </p>
        ))}

      {!status.client_ready && (
        <p className="text-[11px] text-amber-600">
          Pixel ou token do cliente incompletos em Automações, Pixel/CAPI.
        </p>
      )}
    </div>
  );
}
