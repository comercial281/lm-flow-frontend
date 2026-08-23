// Funções puras de árvore <-> grafo visual do FlowBuilder — mirror de
// `grafo.ts` do Hub. Nada aqui conhece React nem @xyflow/react: só o
// FlowAutomationCanvas traduz o resultado pra Node/Edge da lib.
import type { FlowAutomationNode, FlowNodeKind } from '@/types/flowAutomations';

export const NODE_WIDTH = 260;
const STEP_X = 320;
const STEP_Y = 200;

export interface Point {
  x: number;
  y: number;
}

// Layout automático por profundidade/ordem na árvore — só usado pra nó sem
// pos_x/pos_y salvo (mesma regra do Hub: posição salva sempre manda).
export function calculateLayout(nodes: FlowAutomationNode[], initialNodeId: string | null): Record<string, Point> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const positions: Record<string, Point> = {};
  const visited = new Set<string>();
  let nextRow = 0;

  function place(id: string | null, depth: number): number {
    if (!id || visited.has(id) || !byId.has(id)) return nextRow;
    visited.add(id);
    const node = byId.get(id)!;

    if (node.kind === 'condition') {
      place(node.next_yes_node_id, depth + 1);
      const row = nextRow;
      positions[id] = { x: depth * STEP_X, y: row * STEP_Y };
      place(node.next_no_node_id, depth + 1);
      return row;
    }

    const row = nextRow;
    positions[id] = { x: depth * STEP_X, y: row * STEP_Y };
    nextRow += 1;
    place(node.next_node_id, depth + 1);
    return row;
  }

  place(initialNodeId, 1);
  // Nós órfãos (sem caminho a partir do gatilho) — empilha à parte, senão somem do canvas.
  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      positions[n.id] = { x: -STEP_X, y: nextRow * STEP_Y };
      nextRow += 1;
    }
  });
  return positions;
}

export function resolvedPositions(nodes: FlowAutomationNode[], initialNodeId: string | null): Record<string, Point> {
  const calculated = calculateLayout(nodes, initialNodeId);
  const out: Record<string, Point> = {};
  nodes.forEach(n => {
    out[n.id] = n.pos_x != null && n.pos_y != null ? { x: n.pos_x, y: n.pos_y } : calculated[n.id] || { x: 0, y: 0 };
  });
  return out;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: 'out' | 'yes' | 'no';
  deletable: boolean;
}

// O gatilho é sintético (não existe como nó no banco) — id fixo reconhecível.
export const TRIGGER_NODE_ID = '__trigger__';

export function buildEdges(nodes: FlowAutomationNode[], initialNodeId: string | null): GraphEdge[] {
  const edges: GraphEdge[] = [];
  if (initialNodeId) {
    edges.push({ id: 'trigger:out', source: TRIGGER_NODE_ID, target: initialNodeId, sourceHandle: 'out', deletable: false });
  }
  nodes.forEach(n => {
    if (n.kind === 'condition') {
      if (n.next_yes_node_id) edges.push({ id: `${n.id}:yes`, source: n.id, target: n.next_yes_node_id, sourceHandle: 'yes', deletable: true });
      if (n.next_no_node_id) edges.push({ id: `${n.id}:no`, source: n.id, target: n.next_no_node_id, sourceHandle: 'no', deletable: true });
    } else if (n.next_node_id) {
      edges.push({ id: `${n.id}:out`, source: n.id, target: n.next_node_id, sourceHandle: 'out', deletable: true });
    }
  });
  return edges;
}

// Ao inserir um bloco novo, pendura no fim do caminho principal (último nó
// não-ramificado a partir do gatilho) — mesma regra do Hub: a paleta nunca
// pergunta "onde", ela sempre continua a linha principal.
export function findChainEnd(nodes: FlowAutomationNode[], initialNodeId: string | null): string | null {
  const byId = new Map(nodes.map(n => [n.id, n]));
  let current = initialNodeId;
  let last: string | null = null;
  const seen = new Set<string>();
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    last = current;
    const node = byId.get(current)!;
    current = node.kind === 'condition' ? null : node.next_node_id; // condição é fim de cadeia principal — a inserção liga nela manualmente
  }
  return last;
}

export function link(nodes: FlowAutomationNode[], sourceId: string, handle: 'out' | 'yes' | 'no', targetId: string | null): FlowAutomationNode[] {
  return nodes.map(n => {
    if (n.id !== sourceId) return n;
    if (handle === 'yes') return { ...n, next_yes_node_id: targetId };
    if (handle === 'no') return { ...n, next_no_node_id: targetId };
    return { ...n, next_node_id: targetId };
  });
}

// Remover um nó NÃO costura o buraco (mesma decisão de produto do Hub,
// 15/08): quem apontava pra ele fica com a saída vazia.
export function removeNode(nodes: FlowAutomationNode[], id: string): FlowAutomationNode[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => ({
      ...n,
      next_node_id: n.next_node_id === id ? null : n.next_node_id,
      next_yes_node_id: n.next_yes_node_id === id ? null : n.next_yes_node_id,
      next_no_node_id: n.next_no_node_id === id ? null : n.next_no_node_id,
    }));
}

export function moveNode(nodes: FlowAutomationNode[], id: string, x: number, y: number): FlowAutomationNode[] {
  return nodes.map(n => (n.id === id ? { ...n, pos_x: x, pos_y: y } : n));
}

// Uma saída "solta" (ponteiro nulo) do tipo certo pro bloco — usado pra
// mostrar o botão "+" no rodapé do cartão.
export function looseOutputs(node: FlowAutomationNode): Array<'out' | 'yes' | 'no'> {
  if (node.kind === 'condition') {
    const out: Array<'yes' | 'no'> = [];
    if (!node.next_yes_node_id) out.push('yes');
    if (!node.next_no_node_id) out.push('no');
    return out;
  }
  return node.next_node_id ? [] : ['out'];
}

export function newTempId(): string {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
}

// Grupo visual por kind — mirror de cores.ts do Hub (5 grupos, não por tipo,
// senão 22 tipos viram confete).
export const GROUP_COLORS: Record<string, string> = {
  message: '#7C3AED',
  contact: '#0891B2',
  control: '#D97706',
  notify: '#DB2777',
};

export function nodeColor(kind: FlowNodeKind, group: string): string {
  if (kind === 'call_flow') return '#059669';
  return GROUP_COLORS[group] || '#64748B';
}
