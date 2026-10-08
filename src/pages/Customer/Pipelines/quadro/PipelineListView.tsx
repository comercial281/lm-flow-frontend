// src/pages/Customer/Pipelines/quadro/PipelineListView.tsx
// Visão em Lista do funil: todos os leads (já filtrados) numa lista única, por
// ordem de chegada, com a etapa de cada um. Saiu do PipelineKanban.tsx sem
// mudar comportamento (spec funil §4.5); o enxugamento é a P3-T18.
import { useMemo } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Phone, Shuffle, User } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { telefone } from '@/lib/formato';
import OfferActions from '@/components/roleta/OfferActions';
import { roletaLabel } from '@/services/roletaConfig/roletaConfigService';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import {
  formatArrivalDate, getContactColor, itemArrivalMs, itemTagInfos, resolveItemAvatar, resolveItemName, resolveItemRef,
} from '../pipelineItemHelpers';

export interface PipelineListViewProps {
  /** Etapas já filtradas (mesmos filtros do quadro). */
  stages: PipelineStage[];
  ordem: 'asc' | 'desc';
  aoTrocarOrdem: () => void;
  onOpenItem: (item: PipelineItem) => void;
}

export default function PipelineListView({ stages, ordem, aoTrocarOrdem, onOpenItem }: PipelineListViewProps) {
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
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
      {linhas.length === 0 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          {t('kanban.stage.noConversations')}
        </div>
      ) : (
        <div className="bg-background rounded-xl border border-border overflow-hidden">
          {/* Header da lista */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
            <div className="flex-1 min-w-0">Lead</div>
            <div className="hidden md:block w-40 shrink-0">Coluna</div>
            <div className="hidden xl:block w-44 shrink-0">Responsável</div>
            <div className="hidden lg:flex w-48 shrink-0 flex-wrap gap-1">Etiquetas</div>
            <button
              type="button"
              onClick={aoTrocarOrdem}
              className="w-24 shrink-0 flex items-center gap-1 text-right justify-end hover:text-foreground"
              title="Ordenar por data de chegada"
            >
              Chegou
              {ordem === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            </button>
            <div className="w-4 shrink-0" />
          </div>

          {/* Linhas */}
          <div className="divide-y divide-border">
            {linhas.map(({ item, stage }) => (
              <div
                key={item.id}
                onClick={() => onOpenItem(item)}
                className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                {/* Foto + nome + telefone */}
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <div className="relative shrink-0">
                    {resolveItemAvatar(item) ? (
                      <img
                        src={resolveItemAvatar(item)}
                        alt={resolveItemName(item, t)}
                        className="w-9 h-9 rounded-full object-cover shadow-sm bg-muted"
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                          const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fb) fb.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className="w-9 h-9 rounded-full items-center justify-center text-white text-xs font-bold shadow-sm"
                      style={{
                        backgroundColor: getContactColor(resolveItemName(item, t)),
                        display: resolveItemAvatar(item) ? 'none' : 'flex',
                      }}
                    >
                      {resolveItemName(item, t)?.[0]?.toUpperCase() || 'U'}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{resolveItemName(item, t)}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/60 font-medium">
                        #{resolveItemRef(item).slice(0, 6)}
                      </span>
                    </div>
                    {item.contact?.phone_number && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span className="truncate">{telefone(item.contact.phone_number)}</span>
                      </div>
                    )}
                    {/* Coluna — visível só no mobile (colunas escondem a partir de md) */}
                    <div className="md:hidden mt-1">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${stage.color}22`, color: stage.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coluna atual */}
                <div className="hidden md:block w-40 shrink-0">
                  <span
                    className="inline-flex items-center gap-1.5 max-w-full rounded-full px-2 py-1 text-xs font-medium"
                    style={{ backgroundColor: `${stage.color}22`, color: stage.color }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="truncate">{stage.name}</span>
                  </span>
                </div>

                {/* Responsável + roleta de origem */}
                <div className="hidden xl:block w-44 shrink-0 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {(item.assignee ?? item.conversation?.assignee) ? (
                      <>
                        {(item.assignee ?? item.conversation?.assignee)?.avatar_url ? (
                          <img
                            src={(item.assignee ?? item.conversation?.assignee)?.avatar_url}
                            alt=""
                            className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <User className="w-3 h-3 shrink-0" />
                        )}
                        <span className="truncate">{(item.assignee ?? item.conversation?.assignee)?.name}</span>
                      </>
                    ) : (
                      // Sem responsável — mas se a roleta ofertou o lead a MIM, a
                      // linha diz isso e deixa aceitar daqui.
                      <OfferActions
                        contactId={item.contact?.id ?? item.conversation?.contact?.id}
                        conversationId={item.conversation?.id}
                        compact
                        fallback={<span className="text-muted-foreground/50">Sem responsável</span>}
                      />
                    )}
                  </div>
                  {item.roleta && (
                    <div className="flex items-center gap-1.5 text-muted-foreground/70 mt-0.5">
                      <Shuffle className="w-3 h-3 shrink-0" />
                      <span className="truncate" title={`Veio da roleta: ${roletaLabel(item.roleta)}`}>
                        {roletaLabel(item.roleta)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="hidden lg:flex w-48 shrink-0 flex-wrap gap-1">
                  {itemTagInfos(item).slice(0, 3).map(tag => (
                    <span
                      key={tag.name}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {itemTagInfos(item).length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{itemTagInfos(item).length - 3}</span>
                  )}
                </div>

                {/* Data de chegada */}
                <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                  {formatArrivalDate(item) || '-'}
                </div>

                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/50" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
