import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  type Node, type Edge, type NodeChange, type Connection, BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Play, Loader2 } from 'lucide-react';
import { Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Switch, Label } from '@/components/ui/ds';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation, FlowAutomationNode, FlowNodeKind, FlowTriggerEvent, TestRunResult } from '@/types/flowAutomations';
import { FLOW_TRIGGER_LABELS } from '@/types/flowAutomations';
import {
  resolvedPositions, buildEdges, findChainEnd, link, removeNode, moveNode, newTempId, TRIGGER_NODE_ID,
} from '@/lib/flowAutomationGraph';
import { flowNodeTypes } from '@/components/flowAutomations/FlowNodeCard';
import { FlowNodePalette } from '@/components/flowAutomations/FlowNodePalette';
import { FlowNodeConfigModal } from '@/components/flowAutomations/FlowNodeConfigModal';

// Canvas do FlowBuilder — mirror do CanvasDoFluxo do Hub. Fonte de verdade é
// o array `nodes` (árvore de ponteiros); os Node/Edge do React Flow são
// SEMPRE derivados dele, nunca editados diretamente — clique/arraste chamam
// as funções puras de flowAutomationGraph.ts, que devolvem uma nova árvore.
export default function FlowAutomationCanvas() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [automation, setAutomation] = useState<FlowAutomation | null>(null);
  const [nodes, setNodes] = useState<FlowAutomationNode[]>([]);
  const [initialNodeId, setInitialNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingSource, setPendingSource] = useState<{ id: string; handle: 'out' | 'yes' | 'no' } | null>(null);
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [testing, setTesting] = useState(false);
  const dirtyPositions = useRef<Record<string, { x: number; y: number }>>({});
  const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await flowAutomationsService.get(id);
      setAutomation(data);
      setNodes(data.nodes || []);
      setInitialNodeId(data.initial_node_id);
    } catch {
      toast.error('Erro ao carregar fluxo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const positions = useMemo(() => resolvedPositions(nodes, initialNodeId), [nodes, initialNodeId]);
  const graphEdges = useMemo(() => buildEdges(nodes, initialNodeId), [nodes, initialNodeId]);

  const editingNode = editingId ? nodes.find(n => n.id === editingId) || null : null;

  const insertNode = useCallback((kind: FlowNodeKind, from: { id: string; handle: 'out' | 'yes' | 'no' } | null) => {
    // Sem alvo explícito, pendura no fim do caminho principal (mesma regra
    // do Hub: a paleta nunca pergunta "onde"). Sem NENHUM nó ainda, o bloco
    // novo vira o próprio início do fluxo.
    const target = from || (initialNodeId ? { id: findChainEnd(nodes, initialNodeId), handle: 'out' as const } : null);
    const newId = newTempId();
    const newNode: FlowAutomationNode = {
      id: newId, kind, label: null, config: {},
      next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
      pos_x: null, pos_y: null, steps: [],
    };
    setNodes(prev => {
      let next = [...prev, newNode];
      if (target?.id) next = link(next, target.id, target.handle, newId);
      return next;
    });
    if (!target?.id) setInitialNodeId(newId);
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
    const handle = (connection.sourceHandle as 'out' | 'yes' | 'no') || 'out';
    setNodes(prev => link(prev, connection.source!, handle, connection.target!));
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // Aplica a posição localmente a cada frame do arraste; só agenda o save
    // (debounced) quando o usuário solta o mouse (`dragging === false`) —
    // mesma regra do Hub: autosave de posição não pode reprocessar o fluxo
    // inteiro a cada pixel arrastado.
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
  }, []);

  const scheduleSavePositions = () => {
    if (positionTimer.current) clearTimeout(positionTimer.current);
    positionTimer.current = setTimeout(async () => {
      if (!id || Object.keys(dirtyPositions.current).length === 0) return;
      const positionsPayload = Object.entries(dirtyPositions.current).map(([nid, p]) => ({ id: nid, pos_x: p.x, pos_y: p.y }));
      dirtyPositions.current = {};
      try {
        await flowAutomationsService.movePositions(id, positionsPayload);
      } catch {
        // silencioso — próximo save_flow completo cobre qualquer perda
      }
    }, 600);
  };

  const reactFlowNodes: Node[] = useMemo(() => {
    const triggerNode: Node = {
      id: TRIGGER_NODE_ID, type: 'flowTrigger', position: { x: -320, y: 0 }, draggable: false, selectable: false,
      data: { trigger: FLOW_TRIGGER_LABELS[automation?.trigger?.event as keyof typeof FLOW_TRIGGER_LABELS] || 'Escolha o gatilho' },
    };
    const rest: Node[] = nodes.map(n => ({
      id: n.id,
      type: 'flowNode',
      position: positions[n.id] || { x: 0, y: 0 },
      data: { node: n, onEdit: setEditingId, onDuplicate: handleDuplicate, onRemove: handleRemove, onAddFrom: (sid: string, h: 'out' | 'yes' | 'no') => setPendingSource({ id: sid, handle: h }) },
    }));
    return [triggerNode, ...rest];
  }, [nodes, positions, automation?.trigger, handleDuplicate, handleRemove]);

  const reactFlowEdges: Edge[] = useMemo(
    () => graphEdges.map(e => ({
      id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, deletable: e.deletable,
      style: { stroke: e.sourceHandle === 'no' ? '#dc2626' : e.sourceHandle === 'yes' ? '#059669' : '#94a3b8' },
    })),
    [graphEdges]
  );

  const save = async () => {
    if (!id || !automation) return;
    setSaving(true);
    try {
      await flowAutomationsService.update(id, { name: automation.name, trigger: automation.trigger });
      // Manda o id ATUAL de cada nó, seja ele definitivo (uuid) ou temporário
      // (tmp_xxx, nó novo desta sessão) — o backend decide "é novo?" batendo
      // contra os nós que já existem no fluxo, não pela presença do campo id.
      // `initial_node_id` pode ser um id temporário também: o backend resolve
      // os dois pelo MESMO mapa (ver save_flow no controller).
      await flowAutomationsService.saveFlow(id, { nodes, initial_node_id: initialNodeId });
      toast.success('Fluxo salvo');
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0];
      toast.error(msg || 'Erro ao salvar');
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
      toast.error('Erro ao testar — salve o fluxo primeiro');
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
        <Button size="sm" variant="ghost" onClick={() => navigate('/automations/flow-builder')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          className="max-w-xs h-8"
          value={automation.name}
          onChange={e => setAutomation(a => (a ? { ...a, name: e.target.value } : a))}
        />
        <Select
          value={automation.trigger?.event || ''}
          onValueChange={v => setAutomation(a => (a ? { ...a, trigger: { ...a.trigger, event: v as FlowTriggerEvent } } : a))}
        >
          <SelectTrigger className="w-64 h-8 text-xs"><SelectValue placeholder="Escolha o gatilho" /></SelectTrigger>
          <SelectContent>
            {Object.entries(FLOW_TRIGGER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-2">
          <Switch checked={automation.is_enabled} onCheckedChange={() => flowAutomationsService.toggle(automation.id).then(load)} />
          <Label className="text-xs">{automation.is_enabled ? 'Ligado' : 'Desligado'}</Label>
        </div>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Testar
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Salvar
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        <FlowNodePalette onPick={kind => insertNode(kind, pendingSource)} />

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
              Clique num bloco da paleta pra ligar na saída "{pendingSource.handle}"
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

      <FlowNodeConfigModal node={editingNode} onClose={() => setEditingId(null)} onSave={handleSaveNodeConfig} />
    </div>
  );
}
