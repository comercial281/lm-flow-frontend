import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/ds';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

// Modo Plantão: liga/desliga as notificações push (lead novo na hora) NESTE aparelho.
// Reaproveita o hook usePushNotifications (subscribe/unsubscribe via VAPID + push_subscriptions).
export default function PlantaoToggle({ compact = false }: { compact?: boolean }) {
  const { status, subscribe, unsubscribe, isSupported } = usePushNotifications();

  // Navegador sem suporte a push (ex: iOS Safari fora de PWA) — não mostra o botão.
  if (!isSupported) return null;

  const on = status === 'subscribed';
  const loading = status === 'loading';

  const handle = async () => {
    if (status === 'denied') {
      toast.error('Notificações bloqueadas no navegador. Libere nas permissões do site e tente de novo.');
      return;
    }
    try {
      if (on) {
        await unsubscribe();
        toast.success('Modo plantão desligado neste aparelho');
      } else {
        const ok = await subscribe();
        if (ok) toast.success('Modo plantão ativado — você recebe lead novo na hora neste aparelho');
        else toast.error('Não foi possível ativar. Verifique as permissões do navegador.');
      }
    } catch {
      toast.error('Erro ao alterar modo plantão. Tente novamente.');
    }
  };

  const label = on ? 'Modo plantão ativo — toque para desligar' : 'Ativar modo plantão (alerta de lead novo)';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={on ? 'default' : 'ghost'}
          size={compact ? 'icon' : 'sm'}
          onClick={handle}
          disabled={loading}
          aria-label={label}
          className={compact ? 'cursor-pointer' : 'gap-1.5 cursor-pointer'}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : on ? (
            <BellRing className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
          {!compact && (
            <span className="hidden lg:inline text-xs">{on ? 'Plantão ON' : 'Plantão'}</span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
