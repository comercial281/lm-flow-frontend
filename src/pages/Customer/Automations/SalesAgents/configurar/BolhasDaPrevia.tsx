// A conversa de exemplo, desenhada como WhatsApp. Só ilustra: não é o que ela vai
// escrever palavra por palavra.
import { cn } from '@/lib/utils';
import type { Mensagem } from '@/features/salesAgents/previaConversa';

export function BolhasDaPrevia({ mensagens }: { mensagens: Mensagem[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Exemplo de conversa</p>
      <ul className="space-y-1.5">
        {mensagens.map((m, i) => (
          <li key={i} className={cn('max-w-[85%] rounded-lg px-3 py-2 text-sm', m.de === 'ia' ? 'ml-auto bg-emerald-100 text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-50' : 'bg-background')}>
            {m.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}
