import { Link } from 'react-router-dom';
import { Loader2, Star } from 'lucide-react';
import { Badge, Button } from '@/components/ui/ds';
import type { OwnedNumber } from '@/features/numbers/types';
import {
  CHANGE_IN_CHANNELS, MAKE_PRIMARY, PRINCIPAL, connectionLabel, formatPhone,
} from '@/features/numbers/numberTexts';

/* "Números de atendimento" (fase 2b.1): os números de que a pessoa é DONA.
   Só leitura aqui — quem é dono se define em Canais (o link de cada linha).
   Quem tem mais de um escolhe o PRINCIPAL, que só serve de desempate. É o
   mesmo componente no Perfil e na Equipe, de propósito: duas telas contando a
   mesma história de dois jeitos é como elas voltam a divergir. */

interface OwnedNumbersListProps {
  numbers: OwnedNumber[];
  /** Pode trocar o principal? (a própria pessoa, ou quem tem users.update) */
  canChoosePrimary: boolean;
  /** O número que está virando principal agora. */
  busyId?: string | null;
  onChoosePrimary?: (inboxId: string) => void;
  emptyText: string;
  /** Explicação do principal, embaixo da lista (só com 2+ números). */
  hint?: string;
}

export default function OwnedNumbersList({
  numbers, canChoosePrimary, busyId = null, onChoosePrimary, emptyText, hint,
}: OwnedNumbersListProps) {
  if (numbers.length === 0) return <p className="text-xs text-muted-foreground">{emptyText}</p>;

  const podeEscolher = canChoosePrimary && numbers.length > 1 && !!onChoosePrimary;
  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {numbers.map(n => (
          <li key={n.inbox_id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{formatPhone(n.phone) || n.name}</div>
              <div className="truncate text-xs text-muted-foreground">{`${n.name} · ${connectionLabel(n.connection)}`}</div>
            </div>
            {n.principal && (
              <Badge variant="outline" className="gap-1 text-xs text-violet-600">
                <Star className="h-3 w-3" /> {PRINCIPAL}
              </Badge>
            )}
            {podeEscolher && !n.principal && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={!!busyId}
                onClick={() => onChoosePrimary?.(n.inbox_id)}
              >
                {busyId === n.inbox_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : MAKE_PRIMARY}
              </Button>
            )}
            <Link to={`/channels/${n.inbox_id}/settings`} className="text-xs text-[#7c3aed] hover:underline">
              {CHANGE_IN_CHANNELS}
            </Link>
          </li>
        ))}
      </ul>
      {hint && numbers.length > 1 && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
