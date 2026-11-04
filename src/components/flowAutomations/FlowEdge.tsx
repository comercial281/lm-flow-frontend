import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from '@xyflow/react';
import { Scissors } from 'lucide-react';

export type FlowEdgeData = {
  onCut?: (edgeId: string) => void;
  /** Nome encostado na entrada do bloco: as linhas dos caminhos do Randomizador se cruzam no meio. */
  labelAtEnd?: boolean;
};

// Entre o ponto de entrada do bloco e o meio do vão (100 px), por onde descem as
// linhas que vão pros blocos de baixo: o nome ("A · 25%") cabe sem encostar em nada.
const LABEL_END_GAP = 30;

export function edgeLabelPoint(
  { midX, midY, targetX, targetY }: { midX: number; midY: number; targetX: number; targetY: number },
  atEnd: boolean,
): { x: number; y: number } {
  return atEnd ? { x: targetX - LABEL_END_GAP, y: targetY } : { x: midX, y: midY };
}

/**
 * Linha entre dois blocos do construtor. Clicou nela, ela engrossa e aparece
 * "Cortar conexão" no meio (Delete/Backspace também cortam). A linha do Início
 * e o fluxo só de leitura vêm com deletable=false e não oferecem o corte.
 * Curva: o Organizar (29/10/2026) chegou a trocar por ângulo reto e o dono
 * pediu a curva de volta no mesmo dia, mantendo o desenho organizado.
 */
export function FlowEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius,
  style, markerEnd, interactionWidth, selected, deletable, data,
}: EdgeProps<Edge<FlowEdgeData>>) {
  const [path, midX, midY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const atEnd = !!data?.labelAtEnd;
  const { x: labelX, y: labelY } = edgeLabelPoint({ midX, midY, targetX, targetY }, atEnd);
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
            style={{ transform: `translate(-50%, -50%) translate(${midX}px, ${midY + (label && !atEnd ? 20 : 0)}px)` }}
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
