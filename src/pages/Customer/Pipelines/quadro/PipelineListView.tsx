// src/pages/Customer/Pipelines/quadro/PipelineListView.tsx
// Visão em Lista do funil: os cards da aba (já filtrados), por ordem de
// chegada, com o mesmo enxugamento do card do quadro (spec funil §4.4): selo,
// nome com ↗, etapa, responsável, o único sinal e a chegada.
import { useMemo, type MouseEvent } from 'react';
import { AlarmClock, ArrowDown, ArrowUp, ArrowUpRight, CalendarClock, ChevronRight, Clock } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import OfferActions from '@/components/roleta/OfferActions';
import SeloSituacao from '@/features/pipelines/situacao/SeloSituacao';
import { detalheDaSituacao, situacaoDe } from '@/features/pipelines/situacao/situacao';
import { linkDoCardCompleto } from '@/features/pipelines/linkDoCard';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import { formatArrivalDate, itemArrivalMs, resolveItemName } from '../pipelineItemHelpers';
import { sinalDoCard, type TipoDoSinal, type TomDoSinal } from './sinalDoCard';

const pararClique = (e: MouseEvent) => e.stopPropagation();

const CLASSE_DO_TOM: Record<TomDoSinal, string> = {
  perigo: 'text-destructive',
  aviso: 'text-amber-700 dark:text-amber-400',
  info: 'text-primary',
};
const ICONE_DO_SINAL: Record<TipoDoSinal, typeof Clock> = {
  tarefaAtrasada: AlarmClock,
  tarefaHoje: AlarmClock,
  visita: CalendarClock,
  semContato: Clock,
};

export interface PipelineListViewProps {
  /** Etapas já filtradas (mesmos filtros do quadro). */
  stages: PipelineStage[];
  ordem: 'asc' | 'desc';
  aoTrocarOrdem: () => void;
  onOpenItem: (item: PipelineItem) => void;
  visitsByContact: Record<string, string>;
}

export default function PipelineListView({ stages, ordem, aoTrocarOrdem, onOpenItem, visitsByContact }: PipelineListViewProps) {
  const { t } = useLanguage('pipelines');
  const linhas = useMemo(() => {
    const rows = stages.flatMap(stage => (stage.items || []).map(item => ({ item, stage })));
    rows.sort((a, b) => {
      const diff = itemArrivalMs(a.item) - itemArrivalMs(b.item);
      return ordem === 'asc' ? diff : -diff;
    });
    return rows;
  }, [stages, ordem]);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
      {linhas.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Nenhum lead nesta aba com esses filtros.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex items-center gap-4 border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground">
            <div className="min-w-0 flex-1">Lead</div>
            <div className="hidden w-40 shrink-0 md:block">Etapa</div>
            <div className="hidden w-44 shrink-0 xl:block">Responsável</div>
            <div className="hidden w-44 shrink-0 lg:block">Sinal</div>
            <button
              type="button"
              onClick={aoTrocarOrdem}
              className="flex w-24 shrink-0 items-center justify-end gap-1 text-right hover:text-foreground"
              title="Ordenar por data de chegada"
            >
              Chegou
              {ordem === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            </button>
            <div className="w-4 shrink-0" />
          </div>

          <div className="divide-y divide-border">
            {linhas.map(({ item, stage }) => {
              const nome = resolveItemName(item, t);
              const dono = item.assignee ?? item.conversation?.assignee;
              const sinal = sinalDoCard(item, visitsByContact);
              const Icone = sinal ? ICONE_DO_SINAL[sinal.tipo] : null;
              return (
                <div
                  key={item.id}
                  onClick={() => onOpenItem(item)}
                  className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <SeloSituacao status={situacaoDe(item)} detalhe={detalheDaSituacao(item)} />
                    <div className="flex min-w-0 items-center gap-1">
                      <span data-testid="nome-na-lista" className="truncate text-sm font-medium text-foreground lm-redact" title={nome}>
                        {nome}
                      </span>
                      <a
                        href={linkDoCardCompleto(item.pipeline_id, item.id)}
                        target="_blank"
                        rel="noopener"
                        onClick={pararClique}
                        aria-label="Abrir o card completo em nova guia"
                        title="Abrir o card completo em nova guia"
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-primary"
                      >
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </div>
                    {/* Etapa — no celular fica embaixo do nome (as colunas somem antes de md) */}
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground md:hidden">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      {stage.name}
                    </span>
                  </div>

                  <div className="hidden w-40 shrink-0 md:block">
                    <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-foreground">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="truncate">{stage.name}</span>
                    </span>
                  </div>

                  <div className="hidden w-44 shrink-0 truncate text-xs text-muted-foreground xl:block">
                    {dono ? (
                      <span title={`Responsável: ${dono.name}`}>{dono.name}</span>
                    ) : (
                      // Sem dono — mas se a roleta ofertou o lead a MIM, aceita daqui.
                      <span onClick={pararClique}>
                        <OfferActions
                          contactId={item.contact?.id ?? item.conversation?.contact?.id}
                          conversationId={item.conversation?.id}
                          compact
                          fallback={<span className="text-muted-foreground/60">Sem responsável</span>}
                        />
                      </span>
                    )}
                  </div>

                  <div className="hidden w-44 shrink-0 lg:block">
                    {sinal && Icone && (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${CLASSE_DO_TOM[sinal.tom]}`}>
                        <Icone className="h-3 w-3" aria-hidden="true" />
                        {sinal.texto}
                      </span>
                    )}
                  </div>

                  <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">{formatArrivalDate(item) || '-'}</div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
