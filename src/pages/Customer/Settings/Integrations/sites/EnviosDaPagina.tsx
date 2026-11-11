// Últimos envios da página (Task 9): hora, nome + telefone e o desfecho. Envio 'failed' (Erro) ou 'rejected' (Recusado) sai em vermelho com o motivo; sem desfecho conhecido = Processando, neutro.
import { cn } from '@/lib/utils';
import { dataHora } from '@/lib/formato';
import type { EnvioDaPagina, ResultadoDoEnvio } from '@/services/externalLeadPages/externalLeadPagesService';

const ROTULO: Record<ResultadoDoEnvio, string> = { entered: 'Entrou', repeated: 'Repetido', rejected: 'Recusado', failed: 'Erro' };

const rotuloDe = (o: string | null | undefined): string => (o && ROTULO[o as ResultadoDoEnvio]) || 'Processando';

const quando = (iso: string) => dataHora(iso);

export default function EnviosDaPagina({ itens, falhou, resultadoDoTeste }: {
  itens: EnvioDaPagina[] | null;
  falhou: boolean;
  /** `summary` devolvido pelo último "Mandar lead de teste": fica no topo da lista. */
  resultadoDoTeste: string | null;
}) {
  return (
    <div data-testid="ultimos-envios" className="grid gap-2">
      {resultadoDoTeste && (
        <p data-testid="resultado-do-teste" className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">{resultadoDoTeste}</p>
      )}
      {itens === null && !falhou && <p className="text-sm text-muted-foreground">Carregando os envios…</p>}
      {falhou && <p className="text-sm text-muted-foreground">Não deu pra carregar os envios. Feche e abra a janela para tentar de novo.</p>}
      {itens !== null && itens.length === 0 && !resultadoDoTeste && (
        <p className="text-sm text-muted-foreground">Ainda sem envios. Cole o endereço na página e mande um teste.</p>
      )}
      {itens !== null && itens.length > 0 && (
        <ul className="max-h-60 overflow-y-auto rounded-md border border-border">
          {itens.map((e, i) => {
            const ruim = e.outcome === 'failed' || e.outcome === 'rejected';
            return (
              <li key={`${e.at}-${i}`} data-outcome={e.outcome}
                className={cn('grid gap-0.5 border-b border-border px-3 py-2 text-sm last:border-0', e.outcome === 'failed' && 'text-destructive')}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{[e.name, e.phone].filter(Boolean).join(' · ') || 'Sem dados'}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{quando(e.at)}</span>
                </span>
                <span className={cn('text-xs', ruim ? 'text-destructive' : 'text-muted-foreground')}>
                  <strong>{rotuloDe(e.outcome)}</strong>{e.summary ? <>: <span>{e.summary}</span></> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
