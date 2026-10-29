import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, type Edge, type EdgeProps } from '@xyflow/react';
import { Scissors } from 'lucide-react';
import { NODE_WIDTH, STEP_X } from '@/lib/flowAutomationGraph';

export type FlowEdgeData = { onCut?: (edgeId: string) => void };

/**
 * Linha entre dois blocos do construtor. Clicou nela, ela engrossa e aparece
 * "Cortar conexão" no meio (Delete/Backspace também cortam). A linha do Início
 * e o fluxo só de leitura vêm com deletable=false e não oferecem o corte.
 * Em ângulo reto com canto arredondado desde o Organizar (29/10/2026): a curva
 * cruzava o desenho e escondia pra onde cada saída ia.
 */
export function FlowEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius,
  style, markerEnd, interactionWidth, selected, deletable, data,
}: EdgeProps<Edge<FlowEdgeData>>) {
  // Indo pra um bloco de outra linha mais à frente, a curva fica no vão logo
  // antes dele: no meio do caminho ela passaria por trás de outro cartão.
  const forward = sourcePosition === Position.Right && targetPosition === Position.Left && targetX > sourceX;
  const centerX = forward ? targetX - (STEP_X - NODE_WIDTH) / 2 : undefined;
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 10, centerX });
  const canCut = !!selected && deletable !== false && !!data?.onCut;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        style={selected ? { ...style, strokeWidth: 3 } : style}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth}
      />
      {canCut && (
        <EdgeLabelRenderer>
          <button
            type="button"
            onClick={() => data?.onCut?.(id)}
            aria-label="Cortar conexão"
            title="Cortar conexão"
            // Com rótulo ("Sim", "Não respondeu"…) o botão desce um pouco pra não cobrir o nome.
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + (label ? 20 : 0)}px)` }}
            className="nodrag nopan pointer-events-auto absolute flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:border-destructive hover:text-destructive"
          >
            <Scissors className="h-3.5 w-3.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const flowEdgeTypes = { flowEdge: FlowEdge };
