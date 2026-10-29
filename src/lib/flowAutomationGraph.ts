// Funções puras de árvore <-> grafo visual do FlowBuilder — mirror de
// `grafo.ts` do Hub. Nada aqui conhece React nem @xyflow/react: só o
// FlowAutomationCanvas traduz o resultado pra Node/Edge da lib.
import type { FlowAutomationNode, FlowNodeKind, SaveFlowPayload } from '@/types/flowAutomations';

export type OutputHandle = 'out' | 'yes' | 'no';
export type BranchHandle = 'yes' | 'no';

// Blocos com duas saídas. "Condição": Sim / Não. "Aguardar resposta"
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
// 100 px entre colunas: cabe o nome da linha ("Não respondeu") sem encostar no cartão.
export const STEP_X = 360;
const STEP_Y = 200;

export interface Point {
  x: number;
  y: number;
}

export type OutputSide = 'right' | 'bottom';
export type InputSide = 'left' | 'top';

/**
 * De que lado do cartão sai a linha (Organizar, 29/10/2026): o que segue o
 * caminho do lead sai pela direita; o desvio desce. Na condição o "Não" desce;
 * na espera com prazo, o "Respondeu" desce (o "Não respondeu" é a sequência).
 * Espera "Sem limite" só tem o Respondeu, e ele segue reto.
 */
export function outputSide(node: Pick<FlowAutomationNode, 'kind' | 'config'>, handle: OutputHandle): OutputSide {
  if (node.kind === 'condition' && handle === 'no') return 'bottom';
  if (node.kind === 'wait_for_reply' && handle === 'yes' && branchHandles(node).includes('no')) return 'bottom';
  return 'right';
}

/**
 * Por onde a linha entra no bloco, pela posição dos dois (vale também pro fluxo
 * arrumado à mão): descendo pro bloco logo embaixo, entra por cima; saindo pela
 * direita pra um bloco mais embaixo e mais à frente, desce e entra por cima (não
 * corre por trás da linha de baixo); o resto entra pela esquerda.
 */
export function targetSide(from: OutputSide, source: Point, target: Point): InputSide {
  const below = target.y > source.y + STEP_Y / 2;
  if (from === 'bottom') return below && Math.abs(target.x - source.x) < NODE_WIDTH / 2 ? 'top' : 'left';
  return below && target.x > source.x + NODE_WIDTH ? 'top' : 'left';
}

interface LayoutOut { target: string; side: OutputSide; down: boolean }

/**
 * O desenho do Organizar (29/10/2026), usado também pra bloco sem pos_x/pos_y
 * salvo (posição salva sempre manda). O caminho do lead corre reto da esquerda
 * pra direita; o desvio desce pra uma linha nova; o "Não" da condição desce
 * logo embaixo dela, então condições em cascata empilham numa coluna. A coluna
 * de cada bloco é a do caminho mais longo até ele: o bloco onde vários caminhos
 * chegam (o Recuperado do follow-up) fica depois do último.
 */
export function calculateLayout(nodes: FlowAutomationNode[], initialNodeId: string | null): Record<string, Point> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const outsOf = (n: FlowAutomationNode): LayoutOut[] => {
    const handles: OutputHandle[] = isBranching(n) ? branchHandles(n) : ['out'];
    return handles.flatMap(h => {
      const target = targetOf(n, h);
      if (!target || !byId.has(target)) return [];
      return [{ target, side: outputSide(n, h), down: n.kind === 'condition' && h === 'no' }];
    });
  };
  // Ordem do desenho: o que desce, o que segue reto, os desvios.
  const ordered = (n: FlowAutomationNode): LayoutOut[] => {
    const outs = outsOf(n);
    return [...outs.filter(o => o.down), ...outs.filter(o => !o.down && o.side === 'right'), ...outs.filter(o => !o.down && o.side !== 'right')];
  };

  const hasIncoming = new Set(nodes.flatMap(n => outsOf(n).map(o => o.target)));
  const roots = [
    ...(initialNodeId && byId.has(initialNodeId) ? [initialNodeId] : []),
    ...nodes.filter(n => n.id !== initialNodeId && !hasIncoming.has(n.id)).map(n => n.id),
    ...nodes.map(n => n.id), // o que sobrar (só laço) entra por último
  ];

  // Linha que volta pra trás (laço) não conta pra coluna, senão o desenho não
  // acaba. A ordem de passagem é a do fluxo do Início (o solto vem depois) e,
  // dentro dele, o que desce antes do que segue reto, e o desvio por último.
  const backEdges = new Set<string>();
  const onStack = new Set<string>();
  const seen = new Set<string>();
  const order: string[] = [];
  const walk = (id: string, postOrder: string[]) => {
    seen.add(id);
    onStack.add(id);
    [...ordered(byId.get(id)!)].reverse().forEach(o => {
      if (onStack.has(o.target)) backEdges.add(`${id}>${o.target}`);
      else if (!seen.has(o.target)) walk(o.target, postOrder);
    });
    onStack.delete(id);
    postOrder.push(id);
  };
  roots.forEach(id => {
    if (seen.has(id)) return;
    const postOrder: string[] = [];
    walk(id, postOrder);
    order.push(...postOrder.reverse());
  });
  const forward = (id: string) => ordered(byId.get(id)!).filter(o => !backEdges.has(`${id}>${o.target}`));
  const incoming = new Map<string, Array<LayoutOut & { from: string }>>();
  order.forEach(id => forward(id).forEach(o => incoming.set(o.target, [...(incoming.get(o.target) ?? []), { ...o, from: id }])));

  // Coluna = caminho mais longo até o bloco (o "Não" da condição fica na mesma coluna).
  const column: Record<string, number> = Object.fromEntries(nodes.map(n => [n.id, 0]));
  const pending = new Map(nodes.map(n => [n.id, (incoming.get(n.id) ?? []).length]));
  const ready = order.filter(id => pending.get(id) === 0);
  while (ready.length) {
    const id = ready.shift()!;
    forward(id).forEach(o => {
      column[o.target] = Math.max(column[o.target], column[id] + (o.down ? 0 : 1));
      pending.set(o.target, pending.get(o.target)! - 1);
      if (pending.get(o.target) === 0) ready.push(o.target);
    });
  }

  // Linha: o bloco segue quem chega mais perto dele (a coluna mais à direita).
  // Pela direita, na mesma linha; pelo "Não" da condição ou pelo desvio, na de
  // baixo. Linha ocupada naquela coluna: a próxima livre embaixo.
  const lane: Record<string, number> = {};
  const taken = new Set<string>();
  let lastLane = -1;
  const freeFrom = (id: string, from: number) => {
    let l = from;
    while (taken.has(`${column[id]}:${l}`)) l += 1;
    return l;
  };
  order.forEach(id => {
    const placed = (incoming.get(id) ?? []).filter(o => o.from in lane);
    const parent = placed.sort((a, b) => column[b.from] - column[a.from] || lane[b.from] - lane[a.from])[0];
    const wanted = !parent ? lastLane + 1 : parent.side === 'right' && !parent.down ? lane[parent.from] : lane[parent.from] + 1;
    lane[id] = freeFrom(id, wanted);
    taken.add(`${column[id]}:${lane[id]}`);
    lastLane = Math.max(lastLane, lane[id]);
  });

  return Object.fromEntries(nodes.map(n => [n.id, { x: column[n.id] * STEP_X, y: lane[n.id] * STEP_Y }]));
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

/** Corta uma linha do canvas: a saída de origem fica vazia (volta a ser "+"). A linha do Início não se corta. */
export function cutEdge(nodes: FlowAutomationNode[], edgeId: string): FlowAutomationNode[] {
  const edge = buildEdges(nodes, null).find(e => e.id === edgeId);
  if (!edge || !edge.deletable) return nodes;
  return link(nodes, edge.source, edge.sourceHandle, null);
}

/** O bloco que uma saída aponta hoje (null = saída vazia). */
function targetOf(node: FlowAutomationNode, handle: OutputHandle): string | null {
  if (handle === 'yes') return node.next_yes_node_id;
  if (handle === 'no') return node.next_no_node_id;
  return node.next_node_id;
}

/**
 * Em qual saída do bloco encaixado no meio fica o que vinha depois: a de mesmo
 * nome, se ele tiver; senão o "Não respondeu" do Aguardar resposta (é ali que
 * o follow-up mora); senão a primeira (Sim / Respondeu). Bloco simples: a única.
 */
function continuationHandle(node: FlowAutomationNode, from: OutputHandle): OutputHandle {
  if (!isBranching(node)) return 'out';
  const handles = branchHandles(node);
  if ((handles as OutputHandle[]).includes(from)) return from;
  if (node.kind === 'wait_for_reply' && handles.includes('no')) return 'no';
  return handles[0];
}

/**
 * O "+" de uma saída (20/10/2026): o bloco novo entra nela. Saída vazia, só
 * liga; saída já ligada, encaixa no meio (o que vinha depois passa a vir depois
 * do novo). Sem "+", o bloco novo entra solto: quem liga é quem monta o fluxo
 * (antes a paleta pendurava no primeiro Aguardar resposta do caminho, e todo
 * bloco caía no "Respondeu" dele).
 */
export function insertAt(
  nodes: FlowAutomationNode[],
  from: { id: string; handle: OutputHandle },
  newNode: FlowAutomationNode,
): FlowAutomationNode[] {
  const source = nodes.find(n => n.id === from.id);
  if (!source) return [...nodes, newNode];
  const after = targetOf(source, from.handle);
  const placed = after ? link([newNode], newNode.id, continuationHandle(newNode, from.handle), after)[0] : newNode;
  return link([...nodes, placed], from.id, from.handle, newNode.id);
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
    nodes: nodes.map(node => {
      // Sprint 4: o passo do guia (`guide`) é só leitura e não volta; o
      // `guide_done` vai só quando a pessoa confirmou o bloco no painel.
      const { guide: _guide, guide_done: guideDone, ...n } = node;
      const confirmed = guideDone ? { guide_done: true } : {};
      if (!isBranching(n)) return { ...n, ...confirmed, next_yes_node_id: null, next_no_node_id: null };
      const handles = branchHandles(n);
      return {
        ...n,
        ...confirmed,
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

// Grupo visual por kind — mirror de cores.ts do Hub (6 grupos, não por tipo,
// senão 22 tipos viram confete).
export const GROUP_COLORS: Record<string, string> = {
  message: '#7C3AED',
  contact: '#0891B2',
  ai: '#4F46E5',
  distribution: '#EA580C',
  control: '#475569',
  notify: '#DB2777',
};

export function nodeColor(kind: FlowNodeKind, group: string): string {
  if (kind === 'call_flow') return '#059669';
  return GROUP_COLORS[group] || '#64748B';
}
