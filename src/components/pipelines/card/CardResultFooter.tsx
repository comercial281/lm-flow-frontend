// Rodapé fixo da coluna do card: Ganho | Perdido. A etapa final vem da regra do
// servidor (tipo da etapa, com o nome de fallback) — etapaFinal.ts.
import { Trophy, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { etapaDeGanho, etapaDePerda } from '@/features/pipelines/etapaFinal';
import type { PipelineStage } from '@/types/analytics';

interface CardResultFooterProps {
  stages: PipelineStage[];
  etapaAtualId: string | null;
  movendo: boolean;
  onMover: (stageId: string) => void;
}

export default function CardResultFooter({ stages, etapaAtualId, movendo, onMover }: CardResultFooterProps) {
  const ganho = etapaDeGanho(stages);
  const perda = etapaDePerda(stages);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        size="sm"
        className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={() => ganho && onMover(ganho.id.toString())}
        disabled={movendo || !ganho || ganho.id.toString() === etapaAtualId}
        title={ganho ? `Mover para "${ganho.name}"` : 'Nenhuma etapa de venda neste funil'}
      >
        <Trophy className="h-3.5 w-3.5" />
        Ganho
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
        onClick={() => perda && onMover(perda.id.toString())}
        disabled={movendo || !perda || perda.id.toString() === etapaAtualId}
        title={perda ? `Mover para "${perda.name}"` : 'Nenhuma etapa de perda neste funil'}
      >
        <XCircle className="h-3.5 w-3.5" />
        Perdido
      </Button>
    </div>
  );
}
