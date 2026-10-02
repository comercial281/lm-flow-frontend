import { useEffect, useState } from 'react';
import { Clock, ExternalLink, Thermometer } from 'lucide-react';

import { esperaDoLead } from '@/features/conversas/itemDaLista';
import { TEXTOS_DO_PAINEL as T, selosDoLead, type SeloDoLead } from '@/features/conversas/painelDoLead';
import type { Pipeline } from '@/types/analytics';
import type { Conversation } from '@/types/chat/api';

// Cada selo com o fundo claro da sua cor, e a versão do escuro. A etapa usa a cor
// que o gestor deu à etapa no funil (inline, porque vem do servidor).
const CLASSE_POR_TOM = {
  quente: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  morno: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  frio: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
} as const;
const CLASSE_ORIGEM = 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
const CLASSE_ESPERA = 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300';
const BASE = 'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium';

interface FaixaDeSelosProps {
  /** Os funis da conversa que o painel já carregou (sem requisição a mais). */
  pipelines: Pipeline[];
  /** `sales_agent_temperature` da conversa: a mesma fonte do "O que a IA entendeu". */
  temperatura: string | null;
  origem: { rotulo: string; link: string | null } | null;
  conversa: Pick<Conversation, 'waiting_since' | 'last_non_activity_message' | 'status'> | null;
}

function Selo({ selo }: { selo: SeloDoLead }) {
  switch (selo.tipo) {
    case 'etapa':
      return (
        <span
          className={`${BASE} text-foreground ${selo.cor ? '' : 'bg-muted'}`}
          style={selo.cor ? { backgroundColor: `color-mix(in srgb, ${selo.cor} 16%, transparent)` } : undefined}
          title={selo.funil ? `${selo.funil} · ${selo.texto}` : selo.texto}
        >
          <span
            aria-hidden
            className="h-2 w-2 flex-shrink-0 rounded-full bg-muted-foreground"
            style={selo.cor ? { backgroundColor: selo.cor } : undefined}
          />
          <span className="truncate">{selo.texto}</span>
        </span>
      );
    case 'temperatura':
      return (
        <span className={`${BASE} ${CLASSE_POR_TOM[selo.tom]}`}>
          <Thermometer aria-hidden className="h-3 w-3 flex-shrink-0" />
          {selo.texto}
        </span>
      );
    case 'origem':
      // "Ver anúncio" é o próprio selo, quando há link de anúncio.
      return selo.link ? (
        <a
          href={selo.link}
          target="_blank"
          rel="noopener noreferrer"
          title={T.verAnuncio}
          className={`${BASE} ${CLASSE_ORIGEM} hover:underline`}
        >
          <span className="truncate">{selo.texto}</span>
          <ExternalLink aria-hidden className="h-3 w-3 flex-shrink-0" />
        </a>
      ) : (
        <span className={`${BASE} ${CLASSE_ORIGEM}`}>
          <span className="truncate">{selo.texto}</span>
        </span>
      );
    case 'espera':
      return (
        <span className={`${BASE} ${CLASSE_ESPERA}`}>
          <Clock aria-hidden className="h-3 w-3 flex-shrink-0" />
          {selo.texto}
        </span>
      );
  }
}

/**
 * Faixa de selos logo abaixo do nome do lead (Proposta B, 02/10): etapa,
 * temperatura da IA, origem e espera. Em uma linha que quebra se precisar.
 * Sem selo nenhum, a faixa não ocupa espaço.
 */
export default function FaixaDeSelos({ pipelines, temperatura, origem, conversa }: FaixaDeSelosProps) {
  // "sem resposta há X" anda sozinho, como na lista (a cada 60 s).
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const espera = conversa ? esperaDoLead(conversa, agora) : null;
  const selos = selosDoLead({ pipelines, temperatura, origem, espera });
  if (selos.length === 0) return null;

  return (
    <div role="group" aria-label={T.resumoDoLead} className="flex flex-wrap items-center gap-1.5">
      {selos.map(selo => (
        <Selo key={selo.id} selo={selo} />
      ))}
    </div>
  );
}
