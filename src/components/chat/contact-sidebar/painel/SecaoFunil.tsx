import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@evoapi/design-system/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@evoapi/design-system/select';

import { useLanguage } from '@/hooks/useLanguage';
import { pipelinesService } from '@/services/pipelines';
import EditItemModal from '@/components/pipelines/EditItemModal';
import PipelineManagement from '../PipelineManagement';
import { TEXTOS_DO_PAINEL as T } from '@/features/conversas/painelDoLead';
import Secao from './Secao';

import type { Pipeline, PipelineItem, PipelineStage } from '@/types/analytics';

interface SecaoFunilProps {
  conversationId: string;
  /** Os funis em que esta conversa está, já carregados pelo painel (`getPipelinesByConversation`). */
  pipelines: Pipeline[];
  carregando: boolean;
  onAtualizado: () => void;
}

interface LinhaDoFunil {
  item: PipelineItem;
  pipeline: Pipeline;
  etapaId: string;
}

const porPosicao = (a: PipelineStage, b: PipelineStage) => a.position - b.position;

/**
 * O lead no funil, em uma linha por funil: "Funil de vendas · Etapa [▾]".
 * Trocar a etapa move o lead na hora (o mesmo serviço de arrastar no quadro).
 * O card completo (Histórico, Tarefas, Imóveis, Origem) abre no botão.
 */
export default function SecaoFunil({ conversationId, pipelines, carregando, onAtualizado }: SecaoFunilProps) {
  const { t } = useLanguage('pipelines');
  // Etapa escolhida enquanto o servidor não confirma (volta se der erro).
  const [escolhida, setEscolhida] = useState<Record<string, string>>({});
  const [movendo, setMovendo] = useState<string | null>(null);
  const [cardAberto, setCardAberto] = useState<LinhaDoFunil | null>(null);
  const [salvandoCard, setSalvandoCard] = useState(false);
  const [colocando, setColocando] = useState(false);

  const linhas = useMemo<LinhaDoFunil[]>(
    () =>
      pipelines.flatMap(pipeline =>
        (pipeline.stages ?? []).flatMap(stage =>
          (stage.items ?? []).map(item => ({ item, pipeline, etapaId: String(stage.id) })),
        ),
      ),
    [pipelines],
  );

  // Chegou a lista nova do servidor: ela passa a ser a verdade.
  useEffect(() => setEscolhida({}), [pipelines]);

  const mudarEtapa = async (linha: LinhaDoFunil, novaEtapaId: string) => {
    const atual = escolhida[linha.item.id] ?? linha.etapaId;
    if (novaEtapaId === atual) return;

    setEscolhida(e => ({ ...e, [linha.item.id]: novaEtapaId }));
    setMovendo(linha.item.id);
    try {
      await pipelinesService.moveItem({
        item_id: linha.item.id,
        pipeline_id: String(linha.pipeline.id),
        from_stage_id: atual,
        to_stage_id: novaEtapaId,
      });
      onAtualizado();
    } catch (error) {
      console.error('Error moving pipeline item:', error);
      toast.error(T.erroAoMudarEtapa);
      setEscolhida(e => ({ ...e, [linha.item.id]: atual }));
    } finally {
      setMovendo(null);
    }
  };

  // Salvar o card aberto daqui: o mesmo formato que a conversa já mandava (updateItemInPipeline).
  const salvarCard = async (data: {
    notes: string;
    stage_id: string;
    services: Array<{ name: string; value: string }>;
    currency: string;
    custom_attributes?: Record<string, unknown>;
  }) => {
    if (!cardAberto) return;
    setSalvandoCard(true);
    try {
      await pipelinesService.updateItemInPipeline(cardAberto.item.pipeline_id, cardAberto.item.id, {
        pipeline_stage_id: data.stage_id,
        notes: data.notes,
        custom_fields: {
          services: data.services,
          currency: data.currency,
          ...(data.custom_attributes || {}),
        },
      });
      toast.success(t('kanban.messages.itemUpdated'));
      setCardAberto(null);
      onAtualizado();
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error(t('kanban.messages.itemUpdateError'));
    } finally {
      setSalvandoCard(false);
    }
  };

  return (
    <Secao titulo={T.funil}>
      {carregando && linhas.length === 0 ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : linhas.length > 0 ? (
        <div className="space-y-3">
          {linhas.map(linha => (
            <div key={linha.item.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm min-w-0 truncate">
                  {linha.pipeline.name} · {T.etapa}
                </span>
                <Select
                  value={escolhida[linha.item.id] ?? linha.etapaId}
                  onValueChange={valor => mudarEtapa(linha, valor)}
                  disabled={movendo === linha.item.id}
                >
                  <SelectTrigger
                    className="h-8 w-40 flex-shrink-0 text-xs"
                    aria-label={`${T.etapa} em ${linha.pipeline.name}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...(linha.pipeline.stages ?? [])].sort(porPosicao).map(stage => (
                      <SelectItem key={stage.id} value={String(stage.id)}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCardAberto(linha)}>
                {T.abrirCard}
              </Button>
            </div>
          ))}
        </div>
      ) : colocando ? (
        <PipelineManagement conversationId={conversationId} pipelines={pipelines} onPipelineUpdated={onAtualizado} />
      ) : (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setColocando(true)}>
          {T.colocarNoFunil}
        </Button>
      )}

      {cardAberto && (
        <EditItemModal
          open
          onOpenChange={aberto => !aberto && setCardAberto(null)}
          item={cardAberto.item}
          pipeline={cardAberto.pipeline}
          stages={cardAberto.pipeline.stages ?? []}
          onSubmit={salvarCard}
          loading={salvandoCard}
        />
      )}
    </Secao>
  );
}
