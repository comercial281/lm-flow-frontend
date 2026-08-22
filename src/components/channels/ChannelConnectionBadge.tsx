import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import type { ChannelConnectionStatus } from '@/types/channels/inbox';

// Selo de "essa instância está no ar?" para a tela de Canais.
//
// Fica no CARD, não só dentro do canal: com uma dúzia de números conectados,
// descobrir qual caiu exigia abrir um por um — e ninguém abre um por um todo
// dia, então a queda só aparecia quando um cliente reclamava que ninguém
// respondeu.
//
// Quem manda no estado é o backend (o campo já vem resolvido numa palavra só).
// A tela NÃO deduz nada a partir do estado cru da conexão: o mesmo "caiu" já foi
// gravado como 'close', 'closed', 'disconnected' e 'logged_out' por caminhos
// diferentes, e a conta refeita aqui é a que sai do compasso na próxima vez.
//
// `status` nulo NÃO desenha nada: é canal sem sessão pra cair (Cloud API,
// 360dialog, Notificame, e-mail, widget…). Um selo cinza ali só faria a pessoa
// procurar defeito onde não tem.
type ChannelConnectionBadgeProps = {
  status?: ChannelConnectionStatus | null;
  /** Quando caiu (ISO). Vira o "fora do ar desde ..." embaixo do selo. */
  disconnectedAt?: string | null;
  /** `compact` é a versão da tabela: só o ponto e o rótulo, sem a data. */
  variant?: 'default' | 'compact';
  className?: string;
};

const STYLES: Record<ChannelConnectionStatus, { pill: string; dot: string; pulse: boolean }> = {
  connected: {
    pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    pulse: false,
  },
  connecting: {
    pill: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
    pulse: true,
  },
  disconnected: {
    pill: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    pulse: true,
  },
};

export default function ChannelConnectionBadge({
  status,
  disconnectedAt,
  variant = 'default',
  className,
}: ChannelConnectionBadgeProps) {
  const { t } = useLanguage('channels');

  if (!status) return null;

  const style = STYLES[status];
  const label = t(`card.connection.${status}`);
  const since = status === 'disconnected' ? formatSince(disconnectedAt) : null;

  return (
    <div className={cn('flex flex-col items-end gap-0.5', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none',
          style.pill,
        )}
        title={t(`card.connection.${status}Hint`)}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {style.pulse && (
            <span
              aria-hidden
              className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', style.dot)}
            />
          )}
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', style.dot)} />
        </span>
        {label}
      </span>
      {variant === 'default' && since && (
        <span className="text-[10px] text-sidebar-foreground/50">
          {t('card.connection.since', { since })}
        </span>
      )}
    </div>
  );
}

// Data curta e legível ("14/08 09:32"). Valor inválido some em vez de virar
// "Invalid Date" no meio do card.
function formatSince(value?: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
