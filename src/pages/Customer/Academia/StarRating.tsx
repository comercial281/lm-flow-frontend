// Avaliação por estrelas — modo leitura (média) ou interativo (nota do usuário).

import { useState } from 'react';
import { Star } from 'lucide-react';

interface Props {
  value: number; // nota atual (0-5), pode ser fracionária no modo leitura
  count?: number; // qtd de avaliações (modo leitura)
  onRate?: (stars: number) => void; // se presente, vira interativo
  size?: number;
  className?: string;
}

export default function StarRating({ value, count, onRate, size = 18, className }: Props) {
  const [hover, setHover] = useState(0);
  const interactive = typeof onRate === 'function';
  const shown = hover || value;

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= Math.round(shown);
          return (
            <button
              key={n}
              type="button"
              disabled={!interactive}
              onClick={() => onRate?.(n)}
              onMouseEnter={() => interactive && setHover(n)}
              onMouseLeave={() => interactive && setHover(0)}
              className={interactive ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}
              title={interactive ? `Avaliar ${n} estrela${n > 1 ? 's' : ''}` : undefined}
            >
              <Star
                size={size}
                className={filled ? 'text-amber-400' : 'text-muted-foreground/40'}
                fill={filled ? 'currentColor' : 'none'}
              />
            </button>
          );
        })}
      </div>
      {typeof count === 'number' && count > 0 && (
        <span className="text-[11px] text-muted-foreground ml-1">
          {value.toFixed(1)} · {count} avaliaç{count === 1 ? 'ão' : 'ões'}
        </span>
      )}
    </div>
  );
}
