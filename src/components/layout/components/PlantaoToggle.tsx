import { useState } from 'react';
import { BellRing, BellOff, Loader2, Send, Power } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/ds';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { sendTestPush } from '@/services/pushNotificationService';
import { toast } from 'sonner';

// Modo Plantão: liga/desliga as notificações push (lead novo na hora) NESTE aparelho.
// Reaproveita o hook usePushNotifications (subscribe/unsubscribe via VAPID + push_subscriptions).
//
// Plantão DESLIGADO -> clique liga direto (1 toque, sem menu no caminho).
// Plantão LIGADO    -> clique abre menu com "Enviar push de teste" e "Desligar".
//
// O teste vive AQUI, e não como um ícone novo no topo, por dois motivos: a barra
// do mobile já estava estourando (a lupa montava em cima da logo) e o teste só
// faz sentido pra quem já tem o plantão ligado.
export default function PlantaoToggle({ compact = false }: { compact?: boolean }) {
  const { status, subscribe, unsubscribe, isSupported } = usePushNotifications();
  const [testing, setTesting] = useState(false);

  // Navegador sem suporte a push (ex: iOS Safari fora de PWA) — não mostra o botão.
  if (!isSupported) return null;

  const on = status === 'subscribed';
  const loading = status === 'loading' || testing;

  const activate = async () => {
    if (status === 'denied') {
      toast.error('Notificações bloqueadas no navegador. Libere nas permissões do site e tente de novo.');
      return;
    }
    try {
      const ok = await subscribe();
      if (ok) toast.success('Modo plantão ativado — você recebe lead novo na hora neste aparelho');
      else toast.error('Não foi possível ativar. Verifique as permissões do navegador.');
    } catch {
      toast.error('Erro ao alterar modo plantão. Tente novamente.');
    }
  };

  const deactivate = async () => {
    try {
      await unsubscribe();
      toast.success('Modo plantão desligado neste aparelho');
    } catch {
      toast.error('Erro ao alterar modo plantão. Tente novamente.');
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const devices = await sendTestPush();
      toast.success(
        devices > 1
          ? `Push de teste enviado para ${devices} aparelhos. Confira a notificação.`
          : 'Push de teste enviado. Confira a notificação neste aparelho.'
      );
    } catch (e: unknown) {
      // O backend devolve 422 quando ninguém tem plantão ligado. Mostrar o motivo
      // real em vez de "erro" genérico — push que não chega já é invisível demais.
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Não consegui enviar o push de teste. Tente de novo.';
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const label = on ? 'Modo plantão ativo — toque para opções' : 'Ativar modo plantão (alerta de lead novo)';

  const icon = loading ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : on ? (
    <BellRing className="h-4 w-4" />
  ) : (
    <BellOff className="h-4 w-4" />
  );

  const trigger = (
    <Button
      variant={on ? 'default' : 'ghost'}
      size={compact ? 'icon' : 'sm'}
      disabled={loading}
      aria-label={label}
      className={compact ? 'cursor-pointer' : 'gap-1.5 cursor-pointer'}
      {...(on ? {} : { onClick: activate })}
    >
      {icon}
      {!compact && <span className="hidden lg:inline text-xs">{on ? 'Plantão ON' : 'Plantão'}</span>}
    </Button>
  );

  // Desligado: botão simples, 1 clique liga.
  if (!on) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Ligado: menu com teste e desligar.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={test} disabled={testing} className="cursor-pointer">
          <Send className="h-4 w-4 mr-2" />
          Enviar push de teste
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={deactivate} className="cursor-pointer">
          <Power className="h-4 w-4 mr-2" />
          Desligar plantão neste aparelho
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
