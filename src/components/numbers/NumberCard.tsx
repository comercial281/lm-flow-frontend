import type { ReactNode } from 'react';
import { Bot, Shuffle, Smartphone, UserCircle } from 'lucide-react';
import { Badge, Card, CardContent } from '@/components/ui/ds';
import type { NumberCardData } from '@/features/numbers/types';
import {
  CONNECTION_NOTE, NO_AI, NO_PHONE, NO_ROLETA, OWNER_TITLE, connectionLabel, formatPhone, numberRuleLine, ownerLine,
} from '@/features/numbers/numberTexts';

/* "O número tem cara" (fase 2b.1): em Canais, num lugar só, o nome, o telefone
   de verdade, conectado ou não, o dono (ou da imobiliária), em qual roleta ele
   está e qual IA atende nele. Quem monta os dados é o servidor
   (Numbers::Card); as palavras vêm de features/numbers/numberTexts. A frase
   da regra ("quem escreve nele vai direto pra...") só aparece com a regra
   ligada: sem ela o campo não decide nada, e a tela não pode prometer. */

function Linha({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export default function NumberCard({ card }: { card: NumberCardData }) {
  const conectado = card.connection === 'connected';
  return (
    <Card>
      <CardContent className="space-y-2.5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold">{card.name}</div>
            <div className="text-sm text-muted-foreground">{formatPhone(card.phone) || NO_PHONE}</div>
          </div>
          <Badge variant="outline" className={conectado ? 'text-emerald-600' : 'text-amber-600'}>
            {connectionLabel(card.connection)}
          </Badge>
        </div>

        <Linha icon={<UserCircle className="h-4 w-4" />} label={OWNER_TITLE}>
          <span className="font-medium">{ownerLine(card)}</span>
        </Linha>
        {card.number_owner_rule && (
          <p className="pl-6 text-xs text-muted-foreground">
            {numberRuleLine(card.shared ? null : card.owner)}
          </p>
        )}

        <Linha icon={<Shuffle className="h-4 w-4" />} label="Roleta">
          {card.roletas.length ? card.roletas.join(', ') : NO_ROLETA}
        </Linha>
        <Linha icon={<Bot className="h-4 w-4" />} label="IA">
          {card.ai.length ? card.ai.join(', ') : NO_AI}
        </Linha>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" /> {CONNECTION_NOTE}
        </p>
      </CardContent>
    </Card>
  );
}
