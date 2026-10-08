// Card do quadro do funil, MÍNIMO (spec funil §4.4, decisão 12 do Tony): o
// selo quando fechado, o nome com a setinha ↗ (card completo em outra guia),
// UM sinal de urgência, a foto do responsável e o WhatsApp. O resto mora no
// card (janela ou página).
//
// memo() com comparação SHALLOW padrão: toda prop de função/ref chega
// estabilizada (useCallback) do quadro, e `podeArrastar`/`arquivado` são
// booleanos — só `item`, `visitsByContact` e `openingConversation` variam de
// verdade, e por REFERÊNCIA só quando o conteúdo muda.
import { memo, type DragEvent, type MouseEvent, type MutableRefObject, type SyntheticEvent } from 'react';
import { toast } from 'sonner';
import {
  AlarmClock, Archive, ArchiveRestore, ArrowUpRight, CalendarClock, Clock, ExternalLink, Link2, Maximize2,
  MessageCircle, MoreVertical, Trash2,
} from 'lucide-react';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/ds';
import { useLanguage } from '@/hooks/useLanguage';
import SeloSituacao from '@/features/pipelines/situacao/SeloSituacao';
import { detalheDaSituacao, situacaoDe } from '@/features/pipelines/situacao/situacao';
import { linkAbsolutoDoCard, linkDoCardCompleto } from '@/features/pipelines/linkDoCard';
import { contatoDoCard, conversaDoCard } from '@/features/cardDoLead/cardDoLead';
import type { PipelineItem } from '@/types/analytics';
import { getContactColor, resolveItemName } from './pipelineItemHelpers';
import { sinalDoCard, type TipoDoSinal, type TomDoSinal } from './quadro/sinalDoCard';

// Referências estáveis, fora do componente.
const pararClique = (e: MouseEvent) => e.stopPropagation();
const fotoQuebrada = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none';
  const reserva = e.currentTarget.nextElementSibling as HTMLElement | null;
  if (reserva) reserva.style.display = 'flex';
};

const CLASSE_DO_TOM: Record<TomDoSinal, string> = {
  perigo: 'bg-destructive/10 text-destructive',
  aviso: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  info: 'bg-primary/10 text-primary',
};
const ICONE_DO_SINAL: Record<TipoDoSinal, typeof Clock> = {
  tarefaAtrasada: AlarmClock,
  tarefaHoje: AlarmClock,
  visita: CalendarClock,
  semContato: Clock,
};

interface PipelineItemCardProps {
  item: PipelineItem;
  stageId: string;
  visitsByContact: Record<string, string>;
  /** Ganhos, Perdidos e Arquivados não arrastam; em Todos, só o card aberto. */
  podeArrastar: boolean;
  /** Aba Arquivados: o card mostra Desarquivar. */
  arquivado: boolean;
  isDraggingRef: MutableRefObject<boolean>;
  suppressClickUntilRef: MutableRefObject<number>;
  onDragStart: (item: PipelineItem) => void;
  onDragEnd: () => void;
  onCardDragOver: (e: DragEvent) => void;
  onCardDrop: (e: DragEvent, item: PipelineItem, stageId: string) => void;
  onOpenItem: (item: PipelineItem) => void;
  onArchive: (item: PipelineItem) => void;
  onUnarchive: (item: PipelineItem) => void;
  onRemove: (item: PipelineItem) => void;
  // Abre a conversa DENTRO do LM Flow (useOpenLeadConversation, levantado no
  // quadro: a janela de "iniciar conversa" monta uma vez só).
  onOpenConversation: (item: PipelineItem) => void;
  openingConversation: boolean;
}

function PipelineItemCardComponent({
  item, stageId, visitsByContact, podeArrastar, arquivado, isDraggingRef, suppressClickUntilRef,
  onDragStart, onDragEnd, onCardDragOver, onCardDrop, onOpenItem, onArchive, onUnarchive, onRemove,
  onOpenConversation, openingConversation,
}: PipelineItemCardProps) {
  const { t } = useLanguage('pipelines');
  const nome = resolveItemName(item, t);
  const sinal = sinalDoCard(item, visitsByContact);
  const Icone = sinal ? ICONE_DO_SINAL[sinal.tipo] : null;
  // `item.assignee` (topo) já vem do servidor com o dono certo — da conversa ou
  // o default_assignee do contato —, com a foto do WhatsApp dele quando há.
  const dono = item.assignee ?? item.conversation?.assignee;
  const link = linkDoCardCompleto(item.pipeline_id, item.id);
  const temWhatsApp = Boolean(contatoDoCard(item)?.phone_number || conversaDoCard(item));

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkAbsolutoDoCard(item.pipeline_id, item.id));
      toast.success('Link do lead copiado.');
    } catch {
      toast.error('Não consegui copiar o link.');
    }
  };

  return (
    <div
      className="group relative cursor-pointer select-none rounded-xl border border-border bg-background p-3 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md"
      draggable={podeArrastar}
      onDragStart={() => { if (podeArrastar) onDragStart(item); }}
      onDragEnd={onDragEnd}
      onDragOver={onCardDragOver}
      onDrop={e => onCardDrop(e, item, stageId)}
      onClick={() => {
        if (!isDraggingRef.current && Date.now() > suppressClickUntilRef.current) onOpenItem(item);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <SeloSituacao status={situacaoDe(item)} detalhe={detalheDaSituacao(item)} />
          <div className="flex min-w-0 items-center gap-1">
            <h4 className="truncate text-sm font-semibold text-foreground lm-redact" title={nome}>{nome}</h4>
            <a
              href={link}
              target="_blank"
              rel="noopener"
              draggable={false}
              onClick={pararClique}
              aria-label="Abrir o card completo em nova guia"
              title="Abrir o card completo em nova guia"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-primary"
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div onClick={pararClique}
          className="shrink-0 opacity-100 transition-opacity focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto p-1 hover:bg-muted" aria-label="Mais ações" title="Mais ações">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenItem(item)}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Abrir
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={link} target="_blank" rel="noopener">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir em nova guia
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { void copiarLink(); }}>
                <Link2 className="mr-2 h-4 w-4" />
                Copiar link
              </DropdownMenuItem>
              {arquivado ? (
                <DropdownMenuItem onClick={() => onUnarchive(item)}>
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Desarquivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onArchive(item)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Arquivar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onRemove(item)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remover do funil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {sinal && Icone && (
        <span className={`mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${CLASSE_DO_TOM[sinal.tom]}`}>
          <Icone className="h-3 w-3" aria-hidden="true" />
          {sinal.texto}
        </span>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        {dono ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={`Responsável: ${dono.name}`}>
            {dono.avatar_url ? (
              <img src={dono.avatar_url} alt="" className="h-6 w-6 shrink-0 rounded-full bg-muted object-cover" onError={fotoQuebrada} />
            ) : null}
            <span
              className="h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: getContactColor(dono.name), display: dono.avatar_url ? 'none' : 'flex' }}
              aria-hidden="true"
            >
              {dono.name?.[0]?.toUpperCase() || '?'}
            </span>
            <span className="max-w-24 truncate">{dono.name?.split(' ')[0]}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sem responsável</span>
        )}

        <div className="flex shrink-0 items-center gap-1" onClick={pararClique}>
          {arquivado && (
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => onUnarchive(item)}>
              <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
              Desarquivar
            </Button>
          )}
          {temWhatsApp && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenConversation(item)}
              disabled={openingConversation}
              aria-label="Abrir conversa no WhatsApp"
              title="Abrir conversa no WhatsApp"
              className="h-7 w-7 border-emerald-300 p-0 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/40 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const PipelineItemCard = memo(PipelineItemCardComponent);
PipelineItemCard.displayName = 'PipelineItemCard';

export default PipelineItemCard;
