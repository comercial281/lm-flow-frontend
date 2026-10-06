import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  type Node, type Edge, type NodeChange, type Connection, type ReactFlowInstance, BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Play, Loader2, Settings2, AlertTriangle, LayoutGrid, Copy, Users } from 'lucide-react';
import { Badge, Button, Input } from '@/components/ui/ds';
import Chave from '@/components/base/Chave';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation, FlowAutomationNode, TestRunResult } from '@/types/flowAutomations';
import {
  resolvedPositions, buildEdges, appendTarget, link, removeNode, moveNode, newTempId, TRIGGER_NODE_ID,
  normalizeLoadedNodes, buildSaveFlowPayload, handleLabel, type OutputHandle,
} from '@/lib/flowAutomationGraph';
import { flowNodeTypes, type FlowLookups, type FlowStartNodeData } from '@/components/flowAutomations/FlowNodeCard';
import { BLOCK_DRAG_TYPE, FlowBlocksPanel } from '@/components/flowAutomations/FlowBlocksPanel';
import { FlowNodePanel } from '@/components/flowAutomations/FlowNodePanel';
import { FlowTriggerPanel } from '@/components/flowAutomations/FlowTriggerPanel';
import { FlowSettingsDialog } from '@/components/flowAutomations/FlowSettingsDialog';
import { MOBILE_QUERY } from '@/components/flowAutomations/FlowSidePanel';
import { MessageVariablesContext, useTenantMessageVariables } from '@/components/flowAutomations/VariableChipBar';
import { useSidePanel } from '@/components/flowAutomations/useSidePanel';
import { FlowGuideBanner, FlowGuideChecklist } from '@/components/flowAutomations/FlowGuide';
import {
  currentStep, guidePendingText, guideSteps, isGuided, isMessageNode, isReadOnly, messageCount, removeAndRewire,
  serverMessage,
} from '@/features/flowAutomations/guide';
import {
  formatActionSummary,
  formatConditionSummary,
  useAutomationResources,
} from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
import {
  LEAD_CREATED_HINT, normalizeTrigger, serializeTrigger, triggerEvents, triggerOneLine, triggerProblem,
  type FlowTrigger,
} from '@/features/flowAutomations/trigger';
import { businessHoursOnlyOf } from '@/features/flowAutomations/businessHours';
import { FLOW_KIND_COPY, kindOf } from '@/features/flowAutomations/kind';
import { paletteItems, type PaletteItem } from '@/features/flowAutomations/palette';
import { readBlocksOpen, saveBlocksOpen } from '@/features/flowAutomations/blocksPanelState';
import { enableProblem, nodeProblem } from '@/features/flowAutomations/readiness';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import {
  reentryOf, reentrySummary, reentryWarning, serializeReentry, type ReentrySetting,
} from '@/features/flowAutomations/reentry';
import {
  useAlteracoesNaoSalvas, mesmoConteudo, limparPendentes, PEDIDO_SAIR_SEM_SALVAR,
} from '@/hooks/useAlteracoesNaoSalvas';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

// Canvas do construtor de fluxos. Fonte de verdade é o array `nodes` (árvore
// de ponteiros); os Node/Edge do React Flow são SEMPRE derivados dele, nunca
// editados diretamente — clique/arraste chamam as funções puras de
// flowAutomationGraph.ts, que devolvem uma nova árvore.
//
// Layout da sprint 4 (spec 04/10/2026, seção A): o gatilho é o bloco "Início"
// dentro do canvas (a barra do topo saiu); "Blocos" e "Simular" no canto
// superior esquerdo; o bloco (e o Início) abrem num painel à direita, não numa
// janela. No celular os painéis viram tela cheia.

export interface FlowAutomationCanvasProps {
  /**
   * Faixa acima do canvas. Sem ela, o canvas mostra a faixa do guia de
   * construção quando o fluxo tem passos (sprint 4, parte B).
   */
  banner?: ReactNode;
  /**
   * O bloco que pisca com borda destacada. Sem ele, é o passo atual do guia.
   * `TRIGGER_NODE_ID` destaca o Início.
   */
  highlightedNodeId?: string | null;
}

/** O Início do funil de conversa: o gatilho é fixo (sprint 4). */
const CONVERSATION_TRIGGER_LINE = 'Você dispara o funil numa conversa, pelo botão de funil do campo de mensagem';

const PEDIDO_TIRAR_MENSAGEM = {
  titulo: 'Tirar esta mensagem do funil?',
  descricao: 'A mensagem sai do funil e a anterior passa a seguir direto pra próxima. Isso já fica salvo.',
  rotuloDaAcao: 'Tirar',
  destrutivo: true,
};

/** Distância entre o Início e o primeiro bloco (a mesma entre colunas do layout). */
const START_GAP_X = 320;

// O que conta como "alteração não salva": nome, gatilho, configurações ("pode
// rodar de novo", horário comercial) e blocos. A posição dos blocos fica de
// fora — ela já é gravada sozinha quando o arraste termina.
function snapshot(name: string, trigger: FlowTrigger, reentry: ReentrySetting, businessHoursOnly: boolean, nodes: FlowAutomationNode[], initialNodeId: string | null) {
  return {
    name,
    trigger: serializeTrigger(trigger),
    reentry: serializeReentry(reentry),
    businessHoursOnly,
    initialNodeId,
    nodes: nodes.map(({ pos_x: _x, pos_y: _y, ...rest }) => rest),
  };
}

export default function FlowAutomationCanvas({ banner, highlightedNodeId }: FlowAutomationCanvasProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const resources = useAutomationResources(true);
  const messageVariables = useTenantMessageVariables();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const sidePanel = useSidePanel(confirmar);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  // No celular o painel Blocos cobre a tela: começa sempre fechado.
  const [blocksOpen, setBlocksOpenState] = useState(
    () => readBlocksOpen() && !(typeof window !== 'undefined' && window.matchMedia?.(MOBILE_QUERY).matches),
  );
  const flowInstance = useRef<ReactFlowInstance | null>(null);

  const [automation, setAutomation] = useState<FlowAutomation | null>(null);
  const [trigger, setTrigger] = useState<FlowTrigger>({ event: '', conditions: [] });
  const [reentry, setReentry] = useState<ReentrySetting>(() => reentryOf(null));
  const [businessHoursOnly, setBusinessHoursOnly] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [nodes, setNodes] = useState<FlowAutomationNode[]>([]);
  const [initialNodeId, setInitialNodeId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<ReturnType<typeof snapshot> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingSource, setPendingSource] = useState<{ id: string; handle: OutputHandle } | null>(null);
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [testing, setTesting] = useState(false);
  const dirtyPositions = useRef<Record<string, { x: number; y: number }>>({});
  const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // O fluxo como o servidor devolveu (no carregar e depois de salvar).
  const applyFlow = useCallback((data: FlowAutomation) => {
    const nextTrigger = normalizeTrigger(data.trigger);
    const nextNodes = normalizeLoadedNodes(data.nodes || []);
    const nextReentry = reentryOf(data);
    const nextBusinessHours = businessHoursOnlyOf(data);
    setAutomation(data);
    setTrigger(nextTrigger);
    setReentry(nextReentry);
    setBusinessHoursOnly(nextBusinessHours);
    setNodes(nextNodes);
    setInitialNodeId(data.initial_node_id);
    setLoaded(snapshot(data.name, nextTrigger, nextReentry, nextBusinessHours, nextNodes, data.initial_node_id));
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      applyFlow(await flowAutomationsService.get(id));
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra carregar o fluxo'));
    } finally {
      setLoading(false);
    }
  }, [id, applyFlow]);

  useEffect(() => {
    load();
  }, [load]);

  // Sprint 4: tipo do fluxo e o que quem abriu pode fazer. Funil de conversa:
  // o corretor edita no MODO GUIADO (só conteúdo e tirar mensagem) e só VÊ os
  // funis da equipe. O servidor garante; a tela esconde o que ele recusaria.
  const kind = kindOf(automation);
  const isConversation = kind === 'conversation';
  const readOnly = isReadOnly(automation);
  const guided = isGuided(automation);
  const builderTools = !readOnly && !guided;

  const hasChanges = !readOnly && !!automation && !!loaded
    && !mesmoConteudo(snapshot(automation.name, trigger, reentry, businessHoursOnly, nodes, initialNodeId), loaded);
  // O rascunho do painel lateral também é alteração não salva: sair pelo menu
  // ou fechar a aba com ele mexido pergunta antes.
  const unsaved = hasChanges || sidePanel.dirty;
  // Follow-up (sprint 3) e funil de conversa (sprint 4) usam este mesmo canvas; a seta volta pra lista dele.
  const listPath = FLOW_KIND_COPY[kind].listPath;
  useAlteracoesNaoSalvas(unsaved);

  // Construção guiada (sprint 4): os passos, o atual e o "Pronto!" quando o
  // último fica feito nesta visita.
  const steps = useMemo(() => (readOnly ? [] : guideSteps(nodes)), [nodes, readOnly]);
  const step = currentStep(steps);
  const [sawPendingStep, setSawPendingStep] = useState(false);
  useEffect(() => {
    if (step) setSawPendingStep(true);
  }, [step]);
  const highlighted = highlightedNodeId !== undefined ? highlightedNodeId : step?.nodeId ?? null;

  const setBlocksOpen = useCallback((open: boolean) => {
    setBlocksOpenState(open);
    if (!isMobile) saveBlocksOpen(open);
  }, [isMobile]);

  // Voltar pra lista pergunta antes de perder o que não foi salvo (a guarda da
  // casa cobre o menu e fechar a aba; a seta do canvas é um navigate direto).
  const goBack = async () => {
    if (unsaved) {
      if (!(await confirmar(PEDIDO_SAIR_SEM_SALVAR))) return;
      limparPendentes();
    }
    navigate(listPath);
  };

  // O que falta em cada bloco (modelo cria com campo em branco) e por que o
  // fluxo ainda não liga. O cartão mostra; a chave recusa.
  // Roleta nova: "Distribuir pela roleta" sem roleta escolhida é bloco incompleto.
  const roletaObrigatoria = useClientToggle('roleta_nova');
  const problems = useMemo(
    () => Object.fromEntries(nodes.map(n => [n.id, nodeProblem(n, { roletaObrigatoria })])) as Record<string, string | null>,
    [nodes, roletaObrigatoria],
  );
  const blockingProblem = useMemo(
    () => enableProblem(trigger, nodes, kind, { roletaObrigatoria }),
    [trigger, nodes, kind, roletaObrigatoria],
  );

  const positions = useMemo(() => resolvedPositions(nodes, initialNodeId), [nodes, initialNodeId]);
  const graphEdges = useMemo(() => buildEdges(nodes, initialNodeId), [nodes, initialNodeId]);

  const lookups: FlowLookups = useMemo(() => {
    const stages = Object.values(resources.stagesByPipeline).flat();
    return {
      stageName: (stageId: string) => stages.find(s => s.id === stageId)?.name,
      // A frase da ação é a mesma da lista de regras.
      actionSummary: action => formatActionSummary(action, resources),
    };
  }, [resources]);

  const openPanel = sidePanel.panel;
  const editingNode = openPanel?.type === 'node' ? nodes.find(n => n.id === openPanel.id) || null : null;
  const requestPanel = sidePanel.request;
  const replacePanel = sidePanel.replace;

  const insertNode = useCallback((
    item: PaletteItem,
    from: { id: string; handle: OutputHandle } | null,
    position: { x: number; y: number } | null = null,
  ) => {
    // Sem alvo explícito, pendura no fim do caminho principal (a paleta nunca
    // pergunta "onde"). Sem NENHUM bloco ainda, o novo vira o primeiro, logo
    // depois do Início. Arrastado pro canvas, fica onde foi solto.
    const target = from || (initialNodeId ? appendTarget(nodes, initialNodeId) : null);
    const newId = newTempId();
    const newNode: FlowAutomationNode = {
      id: newId, kind: item.kind, label: null, config: { ...item.config },
      next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
      pos_x: position?.x ?? null, pos_y: position?.y ?? null, steps: [],
    };
    setNodes(prev => {
      let next = [...prev, newNode];
      if (target?.id) next = link(next, target.id, target.handle, newId);
      return next;
    });
    if (!initialNodeId) setInitialNodeId(newId);
    setPendingSource(null);
    // No celular os dois painéis são tela cheia: fecha o Blocos pra mostrar o do bloco.
    if (isMobile) setBlocksOpenState(false);
    requestPanel({ type: 'node', id: newId });
  }, [nodes, initialNodeId, isMobile, requestPanel]);

  // Grava no servidor: o cabeçalho (nome, gatilho, configurações) e os blocos.
  // No modo guiado vai só o nome (o servidor recusa o resto) e o fluxo do
  // funil de conversa não manda gatilho (é fixo). Devolve se gravou.
  const persist = useCallback(async (nextNodes: FlowAutomationNode[], nextInitial: string | null): Promise<boolean> => {
    if (!id || !automation) return false;
    setSaving(true);
    try {
      if (guided) {
        if (automation.name !== loaded?.name) await flowAutomationsService.update(id, { name: automation.name });
      } else {
        await flowAutomationsService.update(id, {
          name: automation.name,
          ...(isConversation ? {} : { trigger: serializeTrigger(trigger) }),
          ...serializeReentry(reentry),
          business_hours_only: businessHoursOnly,
        });
      }
      // Manda o id ATUAL de cada bloco, definitivo (uuid) ou temporário (tmp_xxx,
      // bloco novo desta sessão): o servidor decide "é novo?" batendo contra os
      // blocos que já existem no fluxo. `initial_node_id` pode ser temporário
      // também: o servidor resolve os dois pelo MESMO mapa.
      const saved = await flowAutomationsService.saveFlow(id, buildSaveFlowPayload(nextNodes, nextInitial));
      // A resposta já é o fluxo salvo (com o guia atualizado e, no funil de
      // conversa, ligado se o último passo ficou pronto): sem recarregar a tela.
      if (saved && Array.isArray(saved.nodes)) applyFlow(saved);
      else await load();
      toast.success(isConversation ? 'Funil salvo' : 'Fluxo salvo');
      return true;
    } catch (e: unknown) {
      toast.error(serverMessage(e, 'Não deu pra salvar. Tente de novo.'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [id, automation, guided, loaded, isConversation, trigger, reentry, businessHoursOnly, applyFlow, load]);

  const handleRemove = useCallback(async (nodeId: string) => {
    if (guided) {
      // Modo guiado: só mensagem sai, religando as pontas, e já grava.
      const target = nodes.find(n => n.id === nodeId);
      if (!target || !isMessageNode(target)) return;
      if (messageCount(nodes) <= 1) {
        toast.error('O funil precisa de pelo menos uma mensagem.');
        return;
      }
      if (!(await confirmar(PEDIDO_TIRAR_MENSAGEM))) return;
      const next = removeAndRewire(nodes, initialNodeId, nodeId);
      if (openPanel?.type === 'node' && openPanel.id === nodeId) replacePanel(null);
      await persist(next.nodes, next.initialNodeId);
      return;
    }
    setNodes(prev => removeNode(prev, nodeId));
    if (initialNodeId === nodeId) setInitialNodeId(null);
    if (openPanel?.type === 'node' && openPanel.id === nodeId) replacePanel(null);
  }, [guided, nodes, initialNodeId, openPanel, replacePanel, confirmar, persist]);

  const handleDuplicate = useCallback((nodeId: string) => {
    const original = nodes.find(n => n.id === nodeId);
    if (!original) return;
    const copyId = newTempId();
    setNodes(prev => [...prev, { ...original, id: copyId, next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: (original.pos_x || 0) + 40, pos_y: (original.pos_y || 0) + 40 }]);
  }, [nodes]);

  const handleSaveNodeConfig = useCallback(async (nodeId: string, patch: { label: string; config: Record<string, unknown> }) => {
    const target = nodes.find(n => n.id === nodeId);
    // Bloco com passo do guia: Salvar no painel confirma o passo (`guide_done`).
    const confirmsStep = !!target?.guide;
    const next = nodes.map(n => (n.id === nodeId
      ? { ...n, label: guided ? n.label : patch.label || null, config: patch.config, ...(confirmsStep ? { guide_done: true } : {}) }
      : n));
    setNodes(next);
    // O passo do guia que ainda falta (e tudo no modo guiado) grava NA HORA: o
    // guia avança sozinho, e quem é leigo não precisa achar o Salvar do topo.
    if (guided || (confirmsStep && !target?.guide?.done)) {
      if (await persist(next, initialNodeId)) replacePanel(null);
      return;
    }
    replacePanel(null);
  }, [nodes, guided, initialNodeId, persist, replacePanel]);

  const openNode = useCallback((nodeId: string) => {
    if (readOnly) return;
    requestPanel({ type: 'node', id: nodeId });
  }, [readOnly, requestPanel]);

  const addFrom = useCallback((sourceId: string, handle: OutputHandle) => {
    setPendingSource({ id: sourceId, handle });
    setBlocksOpen(true);
  }, [setBlocksOpen]);

  // Arrastar um bloco do painel Blocos pro canvas (A.2).
  const onDragOver = useCallback((e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes(BLOCK_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  const onDrop = useCallback((e: DragEvent) => {
    const key = e.dataTransfer.getData(BLOCK_DRAG_TYPE);
    if (!key) return;
    e.preventDefault();
    const item = paletteItems().find(i => i.key === key);
    if (!item) return;
    const position = flowInstance.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY }) ?? null;
    insertNode(item, pendingSource, position);
  }, [insertNode, pendingSource]);

  const onConnect = useCallback((connection: Connection) => {
    if (!builderTools) return;
    if (!connection.source || !connection.target) return;
    if (connection.source === TRIGGER_NODE_ID) {
      setInitialNodeId(connection.target);
      return;
    }
    const handle = (connection.sourceHandle as OutputHandle) || 'out';
    setNodes(prev => link(prev, connection.source!, handle, connection.target!));
  }, [builderTools]);

  const scheduleSavePositions = useCallback(() => {
    if (positionTimer.current) clearTimeout(positionTimer.current);
    positionTimer.current = setTimeout(async () => {
      if (!id || Object.keys(dirtyPositions.current).length === 0) return;
      // Bloco novo (id temporário) ainda não existe no servidor: a posição dele
      // vai junto no próximo Salvar.
      const positionsPayload = Object.entries(dirtyPositions.current)
        .filter(([nid]) => !nid.startsWith('tmp_'))
        .map(([nid, p]) => ({ id: nid, pos_x: p.x, pos_y: p.y }));
      dirtyPositions.current = {};
      if (positionsPayload.length === 0) return;
      try {
        await flowAutomationsService.movePositions(id, positionsPayload);
      } catch {
        // silencioso — o próximo Salvar completo cobre qualquer perda
      }
    }, 600);
  }, [id]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (!builderTools) return;
    // Aplica a posição localmente a cada frame do arraste; só agenda a
    // gravação quando o mouse solta (`dragging === false`).
    const posChanges = changes.filter((c): c is Extract<NodeChange, { type: 'position' }> => c.type === 'position' && !!c.position);
    if (posChanges.length === 0) return;
    setNodes(prev => {
      let next = prev;
      posChanges.forEach(c => {
        if (c.id === TRIGGER_NODE_ID || !c.position) return;
        next = moveNode(next, c.id, c.position.x, c.position.y);
        dirtyPositions.current[c.id] = { x: c.position.x, y: c.position.y };
      });
      return next;
    });
    if (posChanges.some(c => c.dragging === false)) scheduleSavePositions();
  }, [scheduleSavePositions, builderTools]);

  // O bloco Início: o gatilho principal e cada "Ou quando", com os filtros, numa linha.
  const startData: FlowStartNodeData = useMemo(() => {
    // Funil de conversa (sprint 4): gatilho fixo, o Início só informa.
    if (isConversation) {
      return {
        summary: CONVERSATION_TRIGGER_LINE, hint: null, problem: null, editing: false,
        highlighted: highlighted === TRIGGER_NODE_ID, fixed: true, onEdit: () => {},
      };
    }
    return {
      summary: triggerOneLine(trigger, (event, c) => formatConditionSummary(event, c, resources)),
      hint: triggerEvents(trigger).includes('lead.created') ? LEAD_CREATED_HINT : null,
      problem: triggerProblem(trigger),
      editing: openPanel?.type === 'trigger',
      highlighted: highlighted === TRIGGER_NODE_ID,
      fixed: readOnly,
      onEdit: () => {
        if (!readOnly) requestPanel({ type: 'trigger' });
      },
    };
  }, [isConversation, trigger, resources, openPanel, highlighted, readOnly, requestPanel]);

  // O Início fica sempre uma coluna antes do primeiro bloco, na mesma altura.
  const startPosition = useMemo(() => {
    const first = initialNodeId ? positions[initialNodeId] : null;
    return first ? { x: first.x - START_GAP_X, y: first.y } : { x: 0, y: 0 };
  }, [initialNodeId, positions]);

  const reactFlowNodes: Node[] = useMemo(() => {
    const startNode: Node = {
      id: TRIGGER_NODE_ID, type: 'flowStart', position: startPosition,
      draggable: false, selectable: false, deletable: false, connectable: builderTools,
      data: startData as unknown as Record<string, unknown>,
    };
    const stepByNode = new Map(steps.map(st => [st.nodeId, st]));
    const rest: Node[] = nodes.map(n => {
      const st = stepByNode.get(n.id);
      const allow = readOnly
        ? { edit: false, duplicate: false, remove: false, add: false }
        : guided
          ? { edit: true, duplicate: false, remove: isMessageNode(n), add: false }
          : undefined;
      return {
        id: n.id,
        type: 'flowNode',
        position: positions[n.id] || { x: 0, y: 0 },
        draggable: builderTools,
        connectable: builderTools,
        data: {
          node: n, lookups, problem: problems[n.id] ?? null,
          editing: openPanel?.type === 'node' && openPanel.id === n.id,
          highlighted: highlighted === n.id,
          guideMark: st ? { step: st.step, state: st.done ? 'done' : step?.nodeId === n.id ? 'current' : 'pending' } : null,
          allow,
          onEdit: openNode, onDuplicate: handleDuplicate, onRemove: handleRemove, onAddFrom: addFrom,
        },
      };
    });
    return [startNode, ...rest];
  }, [nodes, positions, startPosition, startData, lookups, problems, openPanel, highlighted, steps, step, readOnly, guided, builderTools, openNode, handleDuplicate, handleRemove, addFrom]);

  const reactFlowEdges: Edge[] = useMemo(
    () => graphEdges.map(e => ({
      id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, deletable: e.deletable && builderTools,
      label: e.label || undefined,
      labelStyle: { fontSize: 10, fill: e.color },
      style: { stroke: e.color },
    })),
    [graphEdges, builderTools]
  );

  const pendingLabel = useMemo(() => {
    if (!pendingSource) return '';
    const source = nodes.find(n => n.id === pendingSource.id);
    return source ? handleLabel(source.kind, pendingSource.handle) : '';
  }, [pendingSource, nodes]);

  const save = async () => {
    if (!id || !automation || readOnly) return;
    const issue = isConversation ? null : triggerProblem(trigger);
    if (issue) {
      toast.error(issue);
      requestPanel({ type: 'trigger' });
      return;
    }
    await persist(nodes, initialNodeId);
  };

  // Funil da equipe que a pessoa não edita: a cópia dela, e o canvas abre nela.
  const duplicateForMe = async () => {
    if (!automation) return;
    try {
      const copy = await flowAutomationsService.duplicate(automation.id);
      toast.success('Pronto: este é o seu funil. Ajuste e salve.');
      navigate(`${listPath}/${copy.id}`);
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra duplicar agora. Tente de novo.'));
    }
  };

  const openStep = (nodeId: string) => {
    requestPanel({ type: 'node', id: nodeId });
  };

  const runTest = async () => {
    if (!id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await flowAutomationsService.testRun(id, {});
      setTestResult(result);
    } catch {
      toast.error('Não deu pra testar. Salve o fluxo e tente de novo.');
    } finally {
      setTesting(false);
    }
  };

  // O aviso de "Mensagem recebida" vale se ela for o gatilho principal ou um "Ou quando".
  const messageEvent = triggerEvents(trigger).includes('lead.message_received') ? 'lead.message_received' : trigger.event;
  const reentryAlert = reentryWarning(reentry, messageEvent);

  if (loading || !automation) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <MessageVariablesContext.Provider value={messageVariables}>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          <Button size="sm" variant="ghost" onClick={goBack} aria-label="Voltar" title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            className="max-w-xs h-8"
            value={automation.name}
            onChange={e => setAutomation(a => (a ? { ...a, name: e.target.value } : a))}
            aria-label={isConversation ? 'Nome do funil' : 'Nome do fluxo'}
            disabled={readOnly}
          />
          {automation.team && (
            <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
              <Users className="h-3 w-3" aria-hidden="true" /> Da equipe
            </Badge>
          )}
          {!readOnly && (
            <Chave
              rotulo={isConversation ? 'Ligar o funil' : 'Ligar o fluxo'}
              semRotuloVisivel
              className="ml-2"
              ligada={automation.is_enabled}
              aoMudar={async () => {
                // Ligar: o fluxo liga como está SALVO, então pede o Salvar antes e
                // recusa enquanto faltar algo num bloco (modelo com campo em branco)
                // ou um passo do guia (sprint 4).
                if (!automation.is_enabled) {
                  if (hasChanges) {
                    toast.error('Salve as alterações antes de ligar: o fluxo liga como está salvo.');
                    return false;
                  }
                  const pendingGuide = guidePendingText(steps);
                  if (pendingGuide) {
                    toast.error(pendingGuide);
                    return false;
                  }
                  if (blockingProblem) {
                    toast.error(blockingProblem);
                    return false;
                  }
                }
                try {
                  const updated = await flowAutomationsService.toggle(automation.id);
                  // Só a chave: recarregar o fluxo apagaria o que ainda não foi salvo.
                  setAutomation(a => (a ? { ...a, is_enabled: updated.is_enabled } : a));
                  return true;
                } catch (e) {
                  toast.error(serverMessage(e, 'Não deu pra ligar agora. Tente de novo.'));
                  return false;
                }
              }}
            />
          )}
          {builderTools && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => setEditingSettings(true)}
              title={businessHoursOnly ? `${reentrySummary(reentry)} · só em horário comercial` : reentrySummary(reentry)}
            >
              <Settings2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> <span className="hidden sm:inline">Configurações</span>
            </Button>
          )}
          <div className="flex-1" />
          {unsaved && <span className="hidden sm:inline text-xs text-muted-foreground">Alterações não salvas</span>}
          {readOnly ? (
            <Button size="sm" variant="outline" onClick={duplicateForMe}>
              <Copy className="h-4 w-4 mr-1" aria-hidden="true" /> Duplicar pra ter a sua cópia
            </Button>
          ) : (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          )}
        </div>
        {readOnly && (
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground" role="status" data-testid="faixa-so-ver">
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {automation.team
                ? 'Este funil é da equipe: só o gestor edita. Você pode disparar ele nas conversas ou duplicar pra ter a sua cópia.'
                : 'Você só pode ver este funil. Duplique pra ter a sua cópia.'}
            </span>
          </div>
        )}

        {!readOnly && !step && !automation.is_enabled && blockingProblem && nodes.length > 0 && (
          <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-300" role="status">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{blockingProblem}</span>
          </div>
        )}
        {reentryAlert && (
          <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-300" role="status">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{reentryAlert}</span>
          </div>
        )}
        {banner !== undefined ? (
          banner && <div data-testid="faixa-do-canvas">{banner}</div>
        ) : (
          steps.length > 0 && (
            <FlowGuideBanner steps={steps} kind={kind} showFinished={sawPendingStep} onOpenStep={openStep} />
          )
        )}

        <div className="flex-1 flex min-h-0">
          {blocksOpen && builderTools && (
            <FlowBlocksPanel
              onPick={item => insertNode(item, pendingSource)}
              onClose={() => setBlocksOpen(false)}
            />
          )}

          <div className="flex-1 relative min-w-0" onDragOver={onDragOver} onDrop={onDrop}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={reactFlowNodes}
                edges={reactFlowEdges}
                nodeTypes={flowNodeTypes}
                onInit={instance => {
                  flowInstance.current = instance;
                }}
                onNodesChange={onNodesChange}
                onNodeClick={(_, node) => {
                  if (node.type === 'flowNode') openNode(node.id);
                }}
                onConnect={onConnect}
                nodesConnectable={builderTools}
                edgesFocusable={builderTools}
                minZoom={0.2}
                maxZoom={1.5}
                zoomOnDoubleClick={false}
                fitView
              >
                <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} />
                <Controls />
                {!isMobile && <MiniMap pannable zoomable />}
              </ReactFlow>
            </ReactFlowProvider>

            {steps.length > 0 && step && (
              <FlowGuideChecklist steps={steps} onOpenStep={openStep} className="absolute right-2 top-2 z-10" />
            )}

            {builderTools && (
            <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className={cn('h-8 bg-background shadow-sm', blocksOpen && 'border-primary text-primary')}
                onClick={() => setBlocksOpen(!blocksOpen)}
                aria-pressed={blocksOpen}
                title={blocksOpen ? 'Fechar o painel de blocos' : 'Abrir o painel de blocos'}
              >
                <LayoutGrid className="h-4 w-4 mr-1" aria-hidden="true" /> Blocos
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-background shadow-sm"
                onClick={runTest}
                disabled={testing}
                title="Roda o fluxo salvo com um lead de teste e mostra cada passo"
              >
                {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Simular
              </Button>
            </div>
            )}

            {pendingSource && (
              <div className="absolute top-12 left-2 z-10 rounded-md bg-primary/10 border border-primary text-primary text-xs px-2 py-1">
                Escolha um bloco em Blocos pra ligar na saída "{pendingLabel}"
                <button className="ml-2 underline" onClick={() => setPendingSource(null)}>cancelar</button>
              </div>
            )}

            {nodes.length === 0 && builderTools && (
              <p className="pointer-events-none absolute inset-x-0 bottom-16 z-10 mx-auto max-w-sm px-4 text-center text-sm text-muted-foreground">
                Escolha o primeiro bloco em Blocos (ou arraste ele pra cá). Ele entra logo depois do Início.
              </p>
            )}
          </div>

          {testResult && (
            <div className="w-80 shrink-0 border-l border-border overflow-auto p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Resultado da simulação</h3>
                <button className="text-xs text-muted-foreground" onClick={() => setTestResult(null)}>fechar</button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Estado final: <strong>{testResult.state}</strong>{testResult.stop_reason ? ` — ${testResult.stop_reason}` : ''}</p>
              <ol className="space-y-2">
                {testResult.steps.map((s, i) => (
                  <li key={i} className="text-xs border border-border rounded p-2">
                    <div className="font-medium">{s.action}</div>
                    {s.detail && <div className="text-muted-foreground">{s.detail}</div>}
                    {s.error && <div className="text-destructive">{s.error}</div>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {editingNode && (
            <FlowNodePanel
              key={editingNode.id}
              node={editingNode}
              resources={resources}
              onClose={() => requestPanel(null)}
              onSave={(nodeId, patch) => void handleSaveNodeConfig(nodeId, patch)}
              onDirtyChange={sidePanel.setDirty}
              flowKind={kind}
              guided={guided}
              saving={saving}
            />
          )}
          {openPanel?.type === 'trigger' && !isConversation && (
            <FlowTriggerPanel
              trigger={trigger}
              resources={resources}
              onClose={() => requestPanel(null)}
              onSave={next => {
                setTrigger(next);
                replacePanel(null);
              }}
              onDirtyChange={sidePanel.setDirty}
            />
          )}
        </div>

        <FlowSettingsDialog
          open={editingSettings}
          settings={{ reentry, businessHoursOnly }}
          triggerEvent={messageEvent}
          onClose={() => setEditingSettings(false)}
          onSave={next => {
            setReentry(next.reentry);
            setBusinessHoursOnly(next.businessHoursOnly);
            setEditingSettings(false);
          }}
        />
        {dialogoDeConfirmacao}
      </div>
    </MessageVariablesContext.Provider>
  );
}
