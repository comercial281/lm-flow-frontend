// Funções puras de árvore <-> grafo visual do FlowBuilder — mirror de
// `grafo.ts` do Hub. Nada aqui conhece React nem @xyflow/react: só o
// FlowAutomationCanvas traduz o resultado pra Node/Edge da lib.
import type { FlowAutomationNode, FlowNodeKind, SaveFlowPayload } from '@/types/flowAutomations';

export type OutputHandle = 'out' | 'yes' | 'no';
export type BranchHandle = 'yes' | 'no';

// Blocos com duas saídas. "Se / senão": Sim / Não. "Aguardar resposta"
// (sprint 1 das Automações, 02/10/2026): Respondeu / Não respondeu, gravados
// em next_yes_node_id / next_no_node_id. Com "Sem limite" o bloco só sai
// quando o lead responde, então só existe "Respondeu".
export function branchHandles(node: Pick<FlowAutomationNode, 'kind' | 'config'>): BranchHandle[] {
  if (node.kind === 'condition') return ['yes', 'no'];
  if (node.kind === 'wait_for_reply') return node.config?.indefinite === true ? ['yes'] : ['yes', 'no'];
  return [];
}

export function isBranching(node: Pick<FlowAutomationNode, 'kind'>): boolean {
  return node.kind === 'condition' || node.kind === 'wait_for_reply';
}

/** O nome da saída na tela. */
export function handleLabel(kind: FlowNodeKind, handle: OutputHandle): string {
  if (kind === 'wait_for_reply') return handle === 'no' ? 'Não respondeu' : 'Respondeu';
  if (handle === 'yes') return 'Sim';
  if (handle === 'no') return 'Não';
  return 'Continuar';
}

/** Cor da saída e da linha: sim/respondeu verde, não vermelho, não respondeu cinza. */
export function handleColor(kind: FlowNodeKind, handle: OutputHandle): string {
  if (handle === 'yes') return '#059669';
  if (handle === 'no') return kind === 'wait_for_reply' ? '#64748b' : '#dc2626';
  return '#94a3b8';
}

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

    if (isBranching(node)) {
      const handles = branchHandles(node);
      place(node.next_yes_node_id, depth + 1);
      const row = nextRow;
      positions[id] = { x: depth * STEP_X, y: row * STEP_Y };
      if (handles.includes('no')) place(node.next_no_node_id, depth + 1);
      if (!node.next_yes_node_id && !(handles.includes('no') && node.next_no_node_id)) nextRow += 1;
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
  sourceHandle: OutputHandle;
  deletable: boolean;
  /** Nome da saída quando o bloco tem duas ("Respondeu", "Não"…); vazio na saída única. */
  label: string;
  color: string;
}

// O gatilho é sintético (não existe como nó no banco) — id fixo reconhecível.
export const TRIGGER_NODE_ID = '__trigger__';

export function buildEdges(nodes: FlowAutomationNode[], initialNodeId: string | null): GraphEdge[] {
  const edges: GraphEdge[] = [];
  if (initialNodeId) {
    edges.push({ id: 'trigger:out', source: TRIGGER_NODE_ID, target: initialNodeId, sourceHandle: 'out', deletable: false, label: '', color: handleColor('wait', 'out') });
  }
  nodes.forEach(n => {
    if (isBranching(n)) {
      branchHandles(n).forEach(h => {
        const target = h === 'yes' ? n.next_yes_node_id : n.next_no_node_id;
        if (target) edges.push({ id: `${n.id}:${h}`, source: n.id, target, sourceHandle: h, deletable: true, label: handleLabel(n.kind, h), color: handleColor(n.kind, h) });
      });
    } else if (n.next_node_id) {
      edges.push({ id: `${n.id}:out`, source: n.id, target: n.next_node_id, sourceHandle: 'out', deletable: true, label: '', color: handleColor(n.kind, 'out') });
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
    current = isBranching(node) ? null : node.next_node_id; // bloco de duas saídas é fim de cadeia principal
  }
  return last;
}

/**
 * Onde a paleta pendura o bloco novo: no fim do caminho principal. Se o fim é
 * um bloco de duas saídas, na primeira saída livre dele (Sim / Respondeu antes
 * de Não / Não respondeu). Sem saída livre, o bloco entra solto (null) — antes
 * ele ia pra uma saída "continuar" que esses blocos não desenham, e sumia.
 */
export function appendTarget(nodes: FlowAutomationNode[], initialNodeId: string | null): { id: string; handle: OutputHandle } | null {
  const end = findChainEnd(nodes, initialNodeId);
  if (!end) return null;
  const node = nodes.find(n => n.id === end);
  if (!node) return null;
  const free = looseOutputs(node);
  return free.length ? { id: end, handle: free[0] } : null;
}

export function link(nodes: FlowAutomationNode[], sourceId: string, handle: OutputHandle, targetId: string | null): FlowAutomationNode[] {
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
export function looseOutputs(node: FlowAutomationNode): OutputHandle[] {
  if (isBranching(node)) {
    return branchHandles(node).filter(h => !(h === 'yes' ? node.next_yes_node_id : node.next_no_node_id));
  }
  return node.next_node_id ? [] : ['out'];
}

/**
 * Fluxo salvo antes da sprint 1: o "Aguardar resposta" só tinha a saída única
 * (o modelo não aceitava sim/não nele). Ela vira "Respondeu" pra o caminho não
 * sumir do desenho.
 */
export function normalizeLoadedNodes(nodes: FlowAutomationNode[]): FlowAutomationNode[] {
  return nodes.map(n => {
    if (n.kind !== 'wait_for_reply' || !n.next_node_id) return n;
    return { ...n, next_yes_node_id: n.next_yes_node_id || n.next_node_id, next_node_id: null };
  });
}

/**
 * O corpo do save_flow. Cada bloco leva só os ponteiros que ele tem: saída
 * única → next_node_id; duas saídas → next_yes/next_no. "Aguardar resposta"
 * com "Sem limite" vai sem "Não respondeu" (contrato: nulo quando indefinite).
 */
export function buildSaveFlowPayload(nodes: FlowAutomationNode[], initialNodeId: string | null): SaveFlowPayload {
  return {
    initial_node_id: initialNodeId,
    nodes: nodes.map(n => {
      if (!isBranching(n)) return { ...n, next_yes_node_id: null, next_no_node_id: null };
      const handles = branchHandles(n);
      return {
        ...n,
        next_node_id: null,
        next_yes_node_id: n.next_yes_node_id,
        next_no_node_id: handles.includes('no') ? n.next_no_node_id : null,
      };
    }),
  };
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
