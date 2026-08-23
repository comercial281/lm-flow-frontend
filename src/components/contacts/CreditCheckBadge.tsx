import { Badge } from '@/components/ui/ds';
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import type { CreditCheckStatus } from '@/types/contacts';

const CONFIG: Record<
  CreditCheckStatus,
  { label: string; className: string; Icon: typeof ShieldCheck }
> = {
  clean: {
    label: 'CPF limpo',
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    Icon: ShieldCheck,
  },
  restricted: {
    label: 'CPF com restrição',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    Icon: ShieldAlert,
  },
  unknown: {
    label: 'CPF consultado',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
    Icon: ShieldQuestion,
  },
};

interface CreditCheckBadgeProps {
  status: CreditCheckStatus;
  score?: number | null;
  /** compact = só ícone + rótulo curto, para o card do kanban */
  compact?: boolean;
  className?: string;
}

export default function CreditCheckBadge({
  status,
  score,
  compact = false,
  className = '',
}: CreditCheckBadgeProps) {
  const cfg = CONFIG[status] ?? CONFIG.unknown;
  const { Icon } = cfg;
  const label = compact && status === 'clean' ? 'Limpo' : compact && status === 'restricted' ? 'Restrição' : cfg.label;

  return (
    <Badge
      className={`inline-flex items-center gap-1 font-medium ${cfg.className} ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
      {typeof score === 'number' ? ` · ${score}` : ''}
    </Badge>
  );
}
