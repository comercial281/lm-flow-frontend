import { cn } from '@/utils/cn';
import type { SupportMessage } from '@/services/support/supportService';
import { quandoFoi } from './rotulos';

interface Props {
  mensagens: SupportMessage[];
  /** De que lado está quem olha: as mensagens dele ficam à direita. */
  eu: 'customer' | 'team';
}

/** Balões do chamado. A mesma no card do cliente e no admin (espelhada). */
export default function SupportThread({ mensagens, eu }: Props) {
  return (
    <ol className="space-y-3 p-3">
      {mensagens.map(m => {
        const minha = m.author_side === eu;
        // Pedido do dono (04/10/2026): o cliente vê só "Suporte", nunca o nome de quem respondeu.
        const nome = m.author_side === 'team' ? 'Suporte' : (m.author_name ?? 'Cliente');
        return (
          <li key={m.id} data-lado={minha ? 'eu' : 'outro'} className={cn('flex flex-col gap-1', minha ? 'items-end' : 'items-start')}>
            {!minha && <span className="text-xs text-muted-foreground">{nome}</span>}
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                minha ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
              )}
            >
              {m.body && <p>{m.body}</p>}
              {m.images.length > 0 && (
                <div className={cn('flex flex-wrap gap-1.5', m.body && 'mt-2')}>
                  {m.images.map((src, i) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" aria-label={`Abrir imagem ${i + 1}`}>
                      <img src={src} alt="" className="h-20 w-20 rounded-md object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">{quandoFoi(m.created_at)}</span>
          </li>
        );
      })}
    </ol>
  );
}
