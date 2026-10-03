import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  type Node, type Edge, type NodeChange, type Connection, BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Play, Loader2, Zap, Settings2, AlertTriangle } from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';
import Chave from '@/components/base/Chave';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation, FlowAutomationNode, TestRunResult } from '@/types/flowAutomations';
import {
  resolvedPositions, buildEdges, appendTarget, link, removeNode, moveNode, newTempId, TRIGGER_NODE_ID,
  normalizeLoadedNodes, buildSaveFlowPayload, handleLabel, type OutputHandle,
} from '@/lib/flowAutomationGraph';
import { flowNodeTypes, type FlowLookups, type FlowTriggerNodeData } from '@/components/flowAutomations/FlowNodeCard';
import { FlowNodePalette } from '@/components/flowAutomations/FlowNodePalette';
import { FlowNodeConfigModal } from '@/components/flowAutomations/FlowNodeConfigModal';
import { FlowTriggerDialog } from '@/components/flowAutomations/FlowTriggerDialog';
import { FlowSettingsDialog } from '@/components/flowAutomations/FlowSettingsDialog';
import {
  formatActionSummary,
  formatConditionSummary,
  useAutomationResources,
} from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
import {
  LEAD_CREATED_HINT, flowTriggerLabel, normalizeTrigger, serializeTrigger, triggerProblem, type FlowTrigger,
} from '@/features/flowAutomations/trigger';
import type { PaletteItem } from '@/features/flowAutomations/palette';
import { enableProblem, nodeProblem } from '@/features/flowAutomations/readiness';
import {
  reentryOf, reentrySummary, reentryWarning, serializeReentry, type ReentrySetting,
} from '@/features/flowAutomations/reentry';
import {
  useAlteracoesNaoSalvas, mesmoConteudo, limparPendentes, PEDIDO_SAIR_SEM_SALVAR,
} from '@/hooks/useAlteracoesNaoSalvas';
import { useConfirmacao } from '@/hooks/useConfirmacao';

// Canvas do construtor de fluxos. Fonte de verdade é o array `nodes` (árvore
// de ponteiros); os Node/Edge do React Flow são SEMPRE derivados dele, nunca
// editados diretamente — clique/arraste chamam as funções puras de
// flowAutomationGraph.ts, que devolvem uma nova árvore.

// O que conta como "alteração não salva": nome, gatilho, "pode rodar de novo" e
// blocos. A posição dos blocos fica de fora — ela já é gravada sozinha quando o
// arraste termina.
function snapshot(name: string, trigger: FlowTrigger, reentry: ReentrySetting, nodes: FlowAutomationNode[], initialNodeId: string | null) {
  return {
    name,
    trigger: serializeTrigger(trigger),
    reentry: serializeReentry(reentry),
    initialNodeId,
    nodes: nodes.map(({ pos_x: _x, pos_y: _y, ...rest }) => rest),
  };
}

export default function FlowAutomationCanvas() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const resources = useAutomationResources(true);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const [automation, setAutomation] = useState<FlowAutomation | null>(null);
  const [trigger, setTrigger] = useState<FlowTrigger>({ event: '', conditions: [] });
  const [reentry, setReentry] = useState<ReentrySetting>(() => reentryOf(null));
  const [editingSettings, setEditingSettings] = useState(false);
  const [nodes, setNodes] = useState<FlowAutomationNode[]>([]);
  const [initialNodeId, setInitialNodeId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<ReturnType<typeof snapshot> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTrigger, setEditingTrigger] = useState(false);
  const [pendingSource, setPendingSource] = useState<{ id: string; handle: OutputHandle } | null>(null);
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [testing, setTesting] = useState(false);
  const dirtyPositions = useRef<Record<string, { x: number; y: number }>>({});
  const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await flowAutomationsService.get(id);
      const nextTrigger = normalizeTrigger(data.trigger);
      const nextNodes = normalizeLoadedNodes(data.nodes || []);
      const nextReentry = reentryOf(data);
      setAutomation(data);
      setTrigger(nextTrigger);
      setReentry(nextReentry);
      setNodes(nextNodes);
      setInitialNodeId(data.initial_node_id);
      setLoaded(snapshot(data.name, nextTrigger, nextReentry, nextNodes, data.initial_node_id));
    } catch {
      toast.error('Não deu pra carregar o fluxo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const hasChanges = !!automation && !!loaded && !mesmoConteudo(snapshot(automation.name, trigger, reentry, nodes, initialNodeId), loaded);
  useAlteracoesNaoSalvas(hasChanges);

  // Voltar pra lista pergunta antes de perder o que não foi salvo (a guarda da
  // casa cobre o menu e fechar a aba; a seta do canvas é um navigate direto).
  const goBack = async () => {
    if (hasChanges) {
      if (!(await confirmar(PEDIDO_SAIR_SEM_SALVAR))) return;
      limparPendentes();
    }
    navigate('/automations/flow-builder');
  };

  // O que falta em cada bloco (modelo cria com campo em branco) e por que o
  // fluxo ainda não liga. O cartão mostra; a chave recusa.
  const problems = useMemo(
    () => Object.fromEntries(nodes.map(n => [n.id, nodeProblem(n)])) as Record<string, string | null>,
    [nodes],
  );
  const blockingProblem = useMemo(() => enableProblem(trigger, nodes), [trigger, nodes]);

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

  const editingNode = editingId ? nodes.find(n => n.id === editingId) || null : null;

  const insertNode = useCallback((item: PaletteItem, from: { id: string; handle: OutputHandle } | null) => {
    // Sem alvo explícito, pendura no fim do caminho principal (a paleta nunca
    // pergunta "onde"). Sem NENHUM bloco ainda, o novo vira o início do fluxo.
    const target = from || (initialNodeId ? appendTarget(nodes, initialNodeId) : null);
    const newId = newTempId();
    const newNode: FlowAutomationNode = {
      id: newId, kind: item.kind, label: null, config: { ...item.config },
      next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
      pos_x: null, pos_y: null, steps: [],
    };
    setNodes(prev => {
      let next = [...prev, newNode];
      if (target?.id) next = link(next, target.id, target.handle, newId);
      return next;
    });
    if (!initialNodeId) setInitialNodeId(newId);
    setPendingSource(null);
    setEditingId(newId);
  }, [nodes, initialNodeId]);

  const handleRemove = useCallback((nodeId: string) => {
    setNodes(prev => removeNode(prev, nodeId));
    if (initialNodeId === nodeId) setInitialNodeId(null);
  }, [initialNodeId]);

  const handleDuplicate = useCallback((nodeId: string) => {
    const original = nodes.find(n => n.id === nodeId);
    if (!original) return;
    const copyId = newTempId();
    setNodes(prev => [...prev, { ...original, id: copyId, next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: (original.pos_x || 0) + 40, pos_y: (original.pos_y || 0) + 40 }]);
  }, [nodes]);

  const handleSaveNodeConfig = useCallback((nodeId: string, patch: { label: string; config: Record<string, unknown> }) => {
    setNodes(prev => prev.map(n => (n.id === nodeId ? { ...n, label: patch.label || null, config: patch.config } : n)));
    setEditingId(null);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === TRIGGER_NODE_ID) {
      setInitialNodeId(connection.target);
      return;
    }
    const handle = (connection.sourceHandle as OutputHandle) || 'out';
    setNodes(prev => link(prev, connection.source!, handle, connection.target!));
  }, []);

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
  }, [scheduleSavePositions]);

  const triggerData: FlowTriggerNodeData = useMemo(() => ({
    title: flowTriggerLabel(trigger.event),
    details: trigger.event ? trigger.conditions.map(c => formatConditionSummary(trigger.event, c, resources)) : [],
    hint: trigger.event === 'lead.created' ? LEAD_CREATED_HINT : null,
    onEdit: () => setEditingTrigger(true),
  }), [trigger, resources]);

  const reactFlowNodes: Node[] = useMemo(() => {
    const triggerNode: Node = {
      id: TRIGGER_NODE_ID, type: 'flowTrigger', position: { x: -320, y: 0 }, draggable: false, selectable: false,
      data: triggerData as unknown as Record<string, unknown>,
    };
    const rest: Node[] = nodes.map(n => ({
      id: n.id,
      type: 'flowNode',
      position: positions[n.id] || { x: 0, y: 0 },
      data: { node: n, lookups, problem: problems[n.id] ?? null, onEdit: setEditingId, onDuplicate: handleDuplicate, onRemove: handleRemove, onAddFrom: (sid: string, h: OutputHandle) => setPendingSource({ id: sid, handle: h }) },
    }));
    return [triggerNode, ...rest];
  }, [nodes, positions, triggerData, lookups, problems, handleDuplicate, handleRemove]);

  const reactFlowEdges: Edge[] = useMemo(
    () => graphEdges.map(e => ({
      id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, deletable: e.deletable,
      label: e.label || undefined,
      labelStyle: { fontSize: 10, fill: e.color },
      style: { stroke: e.color },
    })),
    [graphEdges]
  );

  const pendingLabel = useMemo(() => {
    if (!pendingSource) return '';
    const source = nodes.find(n => n.id === pendingSource.id);
    return source ? handleLabel(source.kind, pendingSource.handle) : '';
  }, [pendingSource, nodes]);

  const save = async () => {
    if (!id || !automation) return;
    const issue = triggerProblem(trigger);
    if (issue) {
      toast.error(issue);
      setEditingTrigger(true);
      return;
    }
    setSaving(true);
    try {
      await flowAutomationsService.update(id, { name: automation.name, trigger: serializeTrigger(trigger), ...serializeReentry(reentry) });
      // Manda o id ATUAL de cada bloco, definitivo (uuid) ou temporário (tmp_xxx,
      // bloco novo desta sessão): o servidor decide "é novo?" batendo contra os
      // blocos que já existem no fluxo. `initial_node_id` pode ser temporário
      // também: o servidor resolve os dois pelo MESMO mapa.
      await flowAutomationsService.saveFlow(id, buildSaveFlowPayload(nodes, initialNodeId));
      toast.success('Fluxo salvo');
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      toast.error(msg || 'Não deu pra salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
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

  if (loading || !automation) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Button size="sm" variant="ghost" onClick={goBack} aria-label="Voltar" title="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          className="max-w-xs h-8"
          value={automation.name}
          onChange={e => setAutomation(a => (a ? { ...a, name: e.target.value } : a))}
          aria-label="Nome do fluxo"
        />
        <Button size="sm" variant="outline" className="h-8 max-w-xs" onClick={() => setEditingTrigger(true)}>
          <Zap className="h-3.5 w-3.5 mr-1 shrink-0" />
          <span className="truncate">{flowTriggerLabel(trigger.event)}</span>
        </Button>
        <Chave
          rotulo="Ligar o fluxo"
          semRotuloVisivel
          className="ml-2"
          ligada={automation.is_enabled}
          aoMudar={async () => {
            // Ligar: o fluxo liga como está SALVO, então pede o Salvar antes e
            // recusa enquanto faltar algo num bloco (modelo com campo em branco).
            if (!automation.is_enabled) {
              if (hasChanges) {
                toast.error('Salve as alterações antes de ligar: o fluxo liga como está salvo.');
                return;
              }
              if (blockingProblem) {
                toast.error(blockingProblem);
                return;
              }
            }
            const updated = await flowAutomationsService.toggle(automation.id);
            // Só a chave: recarregar o fluxo apagaria o que ainda não foi salvo.
            setAutomation(a => (a ? { ...a, is_enabled: updated.is_enabled } : a));
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={() => setEditingSettings(true)}
          title={reentrySummary(reentry)}
        >
          <Settings2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Configurações
        </Button>
        <div className="flex-1" />
        {hasChanges && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
        <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Testar
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>

      {!automation.is_enabled && blockingProblem && nodes.length > 0 && (
        <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-300" role="status">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{blockingProblem}</span>
        </div>
      )}
      {reentryWarning(reentry, trigger.event) && (
        <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-300" role="status">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{reentryWarning(reentry, trigger.event)}</span>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <FlowNodePalette onPick={item => insertNode(item, pendingSource)} />

        <div className="flex-1 relative">
          <ReactFlowProvider>
            <ReactFlow
              nodes={reactFlowNodes}
              edges={reactFlowEdges}
              nodeTypes={flowNodeTypes}
              onNodesChange={onNodesChange}
              onConnect={onConnect}
              minZoom={0.2}
              maxZoom={1.5}
              zoomOnDoubleClick={false}
              fitView
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </ReactFlowProvider>

          {pendingSource && (
            <div className="absolute top-2 left-2 rounded-md bg-primary/10 border border-primary text-primary text-xs px-2 py-1">
              Clique num bloco da paleta pra ligar na saída "{pendingLabel}"
              <button className="ml-2 underline" onClick={() => setPendingSource(null)}>cancelar</button>
            </div>
          )}
        </div>

        {testResult && (
          <div className="w-80 shrink-0 border-l border-border overflow-auto p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Resultado do teste</h3>
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
      </div>

      <FlowNodeConfigModal node={editingNode} resources={resources} onClose={() => setEditingId(null)} onSave={handleSaveNodeConfig} />
      <FlowSettingsDialog
        open={editingSettings}
        reentry={reentry}
        triggerEvent={trigger.event}
        onClose={() => setEditingSettings(false)}
        onSave={next => {
          setReentry(next);
          setEditingSettings(false);
        }}
      />
      <FlowTriggerDialog
        open={editingTrigger}
        trigger={trigger}
        resources={resources}
        onClose={() => setEditingTrigger(false)}
        onSave={next => {
          setTrigger(next);
          setEditingTrigger(false);
        }}
      />
      {dialogoDeConfirmacao}
    </div>
  );
}
