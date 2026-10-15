// src/pages/Customer/Pipelines/quadro/MiniCardDoLead.tsx
// O mini card que abre ao lado do card do quadro quando o mouse fica parado em
// cima dele (versão "Enxuto", 15/10/2026): telefone, dias na etapa e próxima
// tarefa. O título da tarefa só é pedido ao servidor aqui, com ele aberto.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { CheckSquare, Clock, Phone } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui/ds';
import { useLanguage } from '@/hooks/useLanguage';
import { usePendingOffers } from '@/contexts/PendingOffersContext';
import { nomeNaTela } from '@/features/conversas/painelDoLead';
import { EVENTO_TAREFAS_MUDARAM, tarefasService } from '@/features/tarefas/tarefasService';
import type { PipelineItem } from '@/types/analytics';
import { resolveItemName } from '../pipelineItemHelpers';
import { linhaDaEtapa, posicaoDoMiniCard, proximaTarefa, telefoneDoMiniCard, textoDaTarefa } from './miniCard';
import type { AlvoDoMiniCard } from './useMiniCard';

const LARGURA = 288;

// Título da próxima tarefa por card, enquanto a página vive. A chave leva os
// prazos abertos: tarefa nova ou concluída no quadro muda a chave e pede de novo.
const titulos = new Map<string, string | null>();
if (typeof window !== 'undefined') window.addEventListener(EVENTO_TAREFAS_MUDARAM, () => titulos.clear());

const chaveDoTitulo = (item: PipelineItem) =>
  `${item.id}|${(item.tasks_info?.open_tasks ?? []).map(t => t.due_at ?? '-').join(',')}`;

interface Props {
  alvo: AlvoDoMiniCard | null;
  nomeDaEtapa: string | null;
  onEntrar: () => void;
  onSair: () => void;
}

export default function MiniCardDoLead({ alvo, nomeDaEtapa, onEntrar, onSair }: Props) {
  if (!alvo) return null;
  return createPortal(
    <Conteudo key={alvo.item.id} alvo={alvo} nomeDaEtapa={nomeDaEtapa} onEntrar={onEntrar} onSair={onSair} />,
    document.body,
  );
}

function Conteudo({ alvo, nomeDaEtapa, onEntrar, onSair }: Props & { alvo: AlvoDoMiniCard }) {
  const { t } = useLanguage('pipelines');
  const { item } = alvo;
  const { loaded, offerFor } = usePendingOffers();
  const temOferta = Boolean(offerFor({
    contactId: item.contact?.id ?? item.conversation?.contact?.id,
    conversationId: item.conversation?.id ? String(item.conversation.id) : undefined,
  }));
  const fone = telefoneDoMiniCard(item, { carregadas: loaded, temOferta });
  const nome = nomeNaTela(resolveItemName(item, t), fone?.mascarado ?? false);
  const etapa = linhaDaEtapa(item);
  const tarefa = proximaTarefa(item);

  // undefined = buscando; null = não deu (fica "Tarefa marcada").
  const chave = chaveDoTitulo(item);
  const [titulo, setTitulo] = useState<string | null | undefined>(() => (titulos.has(chave) ? titulos.get(chave) : undefined));
  useEffect(() => {
    if (!tarefa || titulos.has(chave)) return;
    let vivo = true;
    tarefasService
      .listar({ bucket: 'para_fazer', kind: 'task', pipeline_item_ids: [item.id], per_page: 1 })
      .then(r => r.data?.[0]?.title ?? null)
      .catch(() => null)
      .then(achado => {
        titulos.set(chave, achado);
        if (vivo) setTitulo(achado);
      });
    return () => { vivo = false; };
  }, [chave, item.id, tarefa]);

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const altura = ref.current?.offsetHeight ?? 0;
    const p = posicaoDoMiniCard(alvo.rect, { largura: window.innerWidth, altura: window.innerHeight },
      { largura: LARGURA, altura }, alvo.ultimaColuna);
    setPos({ left: p.left, top: p.top });
  }, [alvo, titulo]);

  const copiar = async () => {
    if (!fone?.copiar) return;
    try {
      await navigator.clipboard.writeText(fone.copiar);
      toast.success('Telefone copiado.');
    } catch {
      toast.error('Não consegui copiar o telefone.');
    }
  };

  return (
    <div
      ref={ref}
      role="region"
      aria-label={`Resumo de ${nome ?? 'lead'}`}
      data-mini-card
      onPointerEnter={onEntrar}
      onPointerLeave={onSair}
      style={{ width: LARGURA, left: pos?.left ?? alvo.rect.right + 8, top: pos?.top ?? alvo.rect.top, visibility: pos ? 'visible' : 'hidden' }}
      className="fixed z-[150] grid gap-2.5 rounded-xl border border-border bg-popover p-3.5 text-sm text-popover-foreground shadow-lg animate-in fade-in-0 duration-150 motion-reduce:animate-none"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold lm-redact" title={nome ?? undefined}>{nome}</p>
        {nomeDaEtapa && <p className="truncate text-xs text-muted-foreground">{nomeDaEtapa}</p>}
      </div>

      {fone && (
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium tabular-nums lm-redact">{fone.texto}</span>
            {fone.copiar && (
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={copiar}>Copiar</Button>
            )}
          </div>
          {fone.mascarado && (
            <p className="text-xs text-muted-foreground">O telefone aparece quando você aceitar o lead.</p>
          )}
        </div>
      )}

      {etapa && (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{etapa}</span>
        </div>
      )}

      <div className="flex items-start gap-2">
        <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {!tarefa ? (
          <span className="text-muted-foreground">Sem tarefa marcada</span>
        ) : titulo === undefined ? (
          <Skeleton className="mt-0.5 h-4 w-44" />
        ) : (
          <span className={`min-w-0 ${tarefa.atrasada ? 'text-destructive' : ''}`}>
            {textoDaTarefa(titulo, tarefa.dueAt)}
            {tarefa.atrasada && (
              <span className="ml-1.5 rounded-md bg-destructive/10 px-1.5 py-px text-xs font-semibold text-destructive">Atrasada</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
