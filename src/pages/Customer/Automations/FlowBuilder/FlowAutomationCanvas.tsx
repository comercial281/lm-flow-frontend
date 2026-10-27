import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  type Node, type Edge, type EdgeChange, type NodeChange, type Connection, type ReactFlowInstance, BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Play, Loader2, Settings2, LayoutGrid, Copy, Users } from 'lucide-react';
import { Badge, Button, Input } from '@/components/ui/ds';
import Chave from '@/components/base/Chave';
import Faixa from '@/components/base/Faixa';
import ResolverPausasDialog from '@/components/flowAutomations/ResolverPausasDialog';
import { textoDePausados } from '@/features/flowAutomations/pausas';
import { toCondition, willConvert } from '@/features/flowAutomations/filterToCondition';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation, FlowAutomationNode, TestRunResult } from '@/types/flowAutomations';
import {
  resolvedPositions, buildEdges, cutEdge, insertAt, link, removeNode, moveNode, newTempId, TRIGGER_NODE_ID,
  normalizeLoadedNodes, buildSaveFlowPayload, handleLabel, NODE_WIDTH, type OutputHandle,
} from '@/lib/flowAutomationGraph';
import { flowNodeTypes, type FlowLookups, type FlowStartNodeData } from '@/components/flowAutomations/FlowNodeCard';
import { flowEdgeTypes, type FlowEdgeData } from '@/components/flowAutomations/FlowEdge';
import { BLOCK_DRAG_TYPE, FlowBlocksMenu } from '@/components/flowAutomations/FlowBlocksMenu';
import { FlowNodePanel } from '@/components/flowAutomations/FlowNodePanel';
import { FlowTriggerPanel } from '@/components/flowAutomations/FlowTriggerPanel';
import { FlowSettingsDialog } from '@/components/flowAutomations/FlowSettingsDialog';
import { MOBILE_QUERY } from '@/components/flowAutomations/FlowBlockDialog';
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
} from '@/features/flowAutomations/editores/LeadAutomationsEditors';
import {
  FLOW_TRIGGER_GROUPS, LEAD_CREATED_HINT, normalizeTrigger, serializeTrigger, triggerEvents, triggerOneLine, triggerProblem,
  type FlowTrigger,
} from '@/features/flowAutomations/trigger';
import { businessHoursOnlyOf } from '@/features/flowAutomations/businessHours';
import { FLOW_KIND_COPY, kindOf } from '@/features/flowAutomations/kind';
import { avisoLeadsSaindo, leadsDentro, pedidoDesligarFollowup } from '@/features/flowAutomations/desligarFollowup';
import { freshBlockConfig, paletteItems, podeSoltarBloco, type PaletteItem } from '@/features/flowAutomations/palette';
import {
  modoPessoal, numeroFixoNaEquipe, personalAvailabilityState, personalBlockState, personalTriggerGroups,
  presaNaEquipe, tirarDaEquipe, useEhCorretorDeAutomacao,
} from '@/features/flowAutomations/personal';
import { usePersonalCapabilities } from '@/features/flowAutomations/usePersonalCapabilities';
import { enableProblem, nodeProblem } from '@/features/flowAutomations/readiness';
import {
  reentryOf, reentrySummary, reentryWarning, serializeReentry, type ReentrySetting,
} from '@/features/flowAutomations/reentry';
import {
  useAlteracoesNaoSalvas, mesmoConteudo, limparPendentes, PEDIDO_SAIR_SEM_SALVAR,
} from '@/hooks/useAlteracoesNaoSalvas';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import {
  flowNumberOf, flowNumberStartLine, serializeFlowNumber, withFlowSendFrom, type FlowNumberSetting, type FlowNumberView,
} from '@/features/flowAutomations/flowNumber';
import { finalDoNumero } from '@/features/numbers/numberTexts';
import { numberWarnings, WARN_NO_AI } from '@/features/flowAutomations/numberWarnings';
import { salesAgentsService } from '@/services/salesAgents/salesAgentsService';
import { useSendNumbers } from '@/features/numbers/useSendNumbers';
import { useAuthStore } from '@/store/authStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ehCelular } from '@/hooks/useCelular';
import FlowCanvasCelular from './FlowCanvasCelular';
import { cn } from '@/lib/utils';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';

// Canvas do construtor de fluxos. Fonte de verdade é o array `nodes` (árvore
// de ponteiros); os Node/Edge do React Flow são SEMPRE derivados dele, nunca
// editados diretamente — clique/arraste chamam as funções puras de
// flowAutomationGraph.ts, que devolvem uma nova árvore.
//
// Layout da sprint 4 (spec 04/10/2026, seção A): o gatilho é o bloco "Início"
// dentro do canvas (a barra do topo saiu); "Blocos" e "Simular" no canto
// superior esquerdo; o bloco (e o Início) abrem numa janela no meio da tela
// (FlowBlockDialog, 16/10/2026), que não empurra o mapa nem o minimapa. Blocos
// abre uma lista que desce embaixo do botão (FlowBlocksMenu, 16/10/2026); pelo
// "+" de uma saída, a própria lista mostra em qual saída o bloco vai ligar.

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
// rodar de novo", horário comercial, a regra de número do fluxo) e blocos. A
// posição dos blocos fica de fora — ela já é gravada sozinha quando o arraste
// termina. `numberRule` null = fluxo sem a regra (antigo e intocado, ou fora
// da equipe): nada de número vai pro servidor.
function snapshot(
  name: string, trigger: FlowTrigger, reentry: ReentrySetting, businessHoursOnly: boolean,
  numberRule: FlowNumberSetting | null, nodes: FlowAutomationNode[], initialNodeId: string | null,
) {
  return {
    name,
    trigger: serializeTrigger(trigger),
    reentry: serializeReentry(reentry),
    businessHoursOnly,
    numberRule: numberRule ? serializeFlowNumber(numberRule) : null,
    initialNodeId,
    nodes: nodes.map(({ pos_x: _x, pos_y: _y, ...rest }) => rest),
  };
}

export default function FlowAutomationCanvas({ banner, highlightedNodeId }: FlowAutomationCanvasProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const resources = useAutomationResources(true, id);
  const messageVariables = useTenantMessageVariables();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const sidePanel = useSidePanel(confirmar);
  const meId = String(useAuthStore(s => s.currentUser?.id) ?? '');
  const isMobile = useMediaQuery(MOBILE_QUERY);
  // Raio-X do celular (10/10/2026): a tela do celular (sem o desenho) é decidida
  // SÓ na abertura. Seguir o redimensionamento trocaria o canvas no meio da
  // edição ao girar o celular, desmontando o painel do bloco e perdendo o texto.
  const [modoCelular] = useState(ehCelular);
  // A lista Blocos começa sempre fechada e não lembra como ficou (16/10/2026).
  const [blocksOpen, setBlocksOpen] = useState(false);
  const flowInstance = useRef<ReactFlowInstance | null>(null);
  const canvasArea = useRef<HTMLDivElement | null>(null);

  const [automation, setAutomation] = useState<FlowAutomation | null>(null);
  const [trigger, setTrigger] = useState<FlowTrigger>({ event: '', conditions: [] });
  const [reentry, setReentry] = useState<ReentrySetting>(() => reentryOf(null));
  const [businessHoursOnly, setBusinessHoursOnly] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  // Entrega 4: a regra de número do fluxo. `numberSaved` = o servidor já tem a
  // regra; `numberTouched` = a pessoa mexeu no grupo das Configurações nesta
  // visita. Sem nenhum dos dois (fluxo antigo), o Salvar não manda número e
  // não toca as Mensagens.
  const [numberSetting, setNumberSetting] = useState<FlowNumberSetting>({ mode: '', inboxId: '', onConflict: 'follow_conversation' });
  const [numberSaved, setNumberSaved] = useState(false);
  const [numberDivergent, setNumberDivergent] = useState(false);
  const [numberTouched, setNumberTouched] = useState(false);
  const [nodes, setNodes] = useState<FlowAutomationNode[]>([]);
  const [initialNodeId, setInitialNodeId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<ReturnType<typeof snapshot> | null>(null);
  const [loading, setLoading] = useState(true);
  const [erroAoCarregar, setErroAoCarregar] = useState(false);
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
    const nextNumber = flowNumberOf(data, nextNodes);
    setAutomation(data);
    setTrigger(nextTrigger);
    setReentry(nextReentry);
    setBusinessHoursOnly(nextBusinessHours);
    setNumberSetting(nextNumber.setting);
    setNumberSaved(nextNumber.saved);
    setNumberDivergent(nextNumber.divergent);
    setNumberTouched(false);
    setNodes(nextNodes);
    setInitialNodeId(data.initial_node_id);
    setLoaded(snapshot(
      data.name, nextTrigger, nextReentry, nextBusinessHours, nextNumber.saved ? nextNumber.setting : null,
      nextNodes, data.initial_node_id,
    ));
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      applyFlow(await flowAutomationsService.get(id));
      setErroAoCarregar(false);
    } catch (e) {
      setErroAoCarregar(true);
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
  const [resolvendoPausas, setResolvendoPausas] = useState(false);
  // Automação PESSOAL: o corretor monta com os gatilhos e blocos do cargo; o
  // gestor na pessoal DELE tem tudo, mas a mensagem sai pelo número dele
  // ("Indisponível" sem número ou sem IA); na pessoal de outra pessoa, o bloco
  // de mensagem só avisa por qual WhatsApp sai (o servidor força o do dono).
  const ehCorretor = useEhCorretorDeAutomacao();
  // Só automação: o follow-up pessoal (Fase 3) sai sempre pelo número do
  // responsável pelo lead (o servidor manda) e o corretor edita no modo guiado.
  const modo = kind === 'automation' ? modoPessoal(automation, { ehCorretor, meId }) : null;
  const pessoal = modo === 'corretor';
  const peloMeuNumero = modo === 'corretor' || modo === 'dono';
  // '' = de outra pessoa sem nome conhecido; null = não é o caso.
  const donoDoEnvio = modo === 'de_outro' ? automation?.owner_name ?? '' : null;
  const capacidades = usePersonalCapabilities(peloMeuNumero);
  const estadoDoBloco = useMemo(() => {
    const ctx = { temNumero: capacidades.temNumero, temIA: capacidades.temIA };
    if (modo === 'corretor') return (item: PaletteItem) => personalBlockState(item, ctx);
    if (modo === 'dono') return (item: PaletteItem) => personalAvailabilityState(item, ctx);
    return undefined;
  }, [modo, capacidades.temNumero, capacidades.temIA]);
  // Número do fluxo (Entrega 4): só na automação da equipe. Follow-up, funil
  // de conversa e automação pessoal seguem como estão.
  const numeroDoFluxoVale = kind === 'automation' && modo === null;
  const numeroAtivo = numeroDoFluxoVale && (numberSaved || numberTouched);
  const sendNumbers = useSendNumbers(
    'lead_automation_rules',
    numeroDoFluxoVale && (editingSettings || (numeroAtivo && numberSetting.mode === 'number')),
  );
  const numberView: FlowNumberView | null = useMemo(() => {
    if (!numeroAtivo) return null;
    const phone = numberSetting.mode === 'number'
      ? sendNumbers.numbers.find(n => n.inbox_id === numberSetting.inboxId)?.phone ?? null
      : null;
    return { mode: numberSetting.mode, final: finalDoNumero(phone) };
  }, [numeroAtivo, numberSetting, sendNumbers.numbers]);
  // Avisos de número (Entrega 4): sem bloquear. Os agentes de IA carregam uma
  // vez, só se houver "Passar para a IA"; se a lista falhar, o aviso "sem IA" some.
  const temPassarParaIA = nodes.some(n => n.kind === 'hand_to_ai');
  const [inboxesWithAi, setInboxesWithAi] = useState<Set<string> | null>(null);
  const agentesPedidos = useRef(false);
  useEffect(() => {
    if (!numeroAtivo || !temPassarParaIA || agentesPedidos.current) return;
    agentesPedidos.current = true;
    salesAgentsService.list()
      .then(list => setInboxesWithAi(new Set(list.filter(a => a.enabled && a.inbox_id).map(a => a.inbox_id as string))))
      .catch(() => setInboxesWithAi(null));
  }, [numeroAtivo, temPassarParaIA]);
  const avisosDeNumero = useMemo(() => {
    if (!numeroAtivo) return [];
    const list = numberWarnings({
      trigger, nodes, initialNodeId, setting: numberSetting, inboxesWithAi: inboxesWithAi ?? new Set<string>(),
    });
    // Lista de IA que não veio: não adivinhar "não tem IA".
    return inboxesWithAi === null ? list.filter(w => w !== WARN_NO_AI) : list;
  }, [numeroAtivo, trigger, nodes, initialNodeId, numberSetting, inboxesWithAi]);
  const gatilhosDoCargo = useMemo(() => (pessoal ? personalTriggerGroups(FLOW_TRIGGER_GROUPS) : undefined), [pessoal]);
  const guided = isGuided(automation);
  const builderTools = !readOnly && !guided;

  const hasChanges = !readOnly && !!automation && !!loaded
    && !mesmoConteudo(snapshot(
      automation.name, trigger, reentry, businessHoursOnly, numberSaved || numberTouched ? numberSetting : null,
      nodes, initialNodeId,
    ), loaded);
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
  const problems = useMemo(
    () => Object.fromEntries(nodes.map(n => [n.id, nodeProblem(n)])) as Record<string, string | null>,
    [nodes],
  );
  const blockingProblem = useMemo(
    () => enableProblem(trigger, nodes, kind),
    [trigger, nodes, kind],
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
    // Pelo "+" de uma saída, entra nela (encaixando no meio se ela já estava
    // ligada). Pelo botão Blocos, entra solto e quem monta liga (20/10/2026).
    // Sem NENHUM bloco ainda, o novo vira o primeiro, logo depois do Início.
    // Arrastado pro canvas, fica onde foi solto.
    const newId = newTempId();
    const newNode: FlowAutomationNode = {
      // Cópia própria do bloco: o mesmo botão escolhido duas vezes não divide a sequência.
      id: newId, kind: item.kind, label: null, config: freshBlockConfig(item.config),
      next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
      pos_x: position?.x ?? null, pos_y: position?.y ?? null, steps: [],
    };
    setNodes(prev => (from ? insertAt(prev, from, newNode) : [...prev, newNode]));
    if (!initialNodeId && nodes.length === 0) setInitialNodeId(newId);
    setPendingSource(null);
    // Escolher (ou soltar) um bloco fecha a lista.
    setBlocksOpen(false);
    requestPanel({ type: 'node', id: newId });
  }, [nodes, initialNodeId, requestPanel]);

  // Grava no servidor: o cabeçalho (nome, gatilho, configurações) e os blocos.
  // No modo guiado vai só o nome (o servidor recusa o resto) e o fluxo do
  // funil de conversa não manda gatilho (é fixo). Devolve se gravou.
  // Número do fluxo: só vai (e só espelha nas Mensagens) quando a regra já
  // está salva ou a pessoa mexeu nas Configurações. Fluxo antigo intocado
  // salva igual a hoje.
  const persist = useCallback(async (nextNodes: FlowAutomationNode[], nextInitial: string | null): Promise<boolean> => {
    if (!id || !automation) return false;
    const sendNumber = numeroAtivo && !guided;
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
          ...(sendNumber ? serializeFlowNumber(numberSetting) : {}),
        });
      }
      // O número escolhido vai espelhado em cada Mensagem: é o que mantém o
      // fluxo falando pelo mesmo número se o servidor voltar de versão.
      const nodesToSave = sendNumber ? withFlowSendFrom(nextNodes, numberSetting) : nextNodes;
      // Manda o id ATUAL de cada bloco, definitivo (uuid) ou temporário (tmp_xxx,
      // bloco novo desta sessão): o servidor decide "é novo?" batendo contra os
      // blocos que já existem no fluxo. `initial_node_id` pode ser temporário
      // também: o servidor resolve os dois pelo MESMO mapa.
      const saved = await flowAutomationsService.saveFlow(id, buildSaveFlowPayload(nodesToSave, nextInitial));
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
  }, [id, automation, guided, loaded, isConversation, trigger, reentry, businessHoursOnly, numeroAtivo, numberSetting, applyFlow, load]);

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
    // Config funda e com id novo em cada item da sequência: a cópia não divide
    // nada com o original (o modo guiado do servidor casa itens por id).
    setNodes(prev => [...prev, { ...original, id: copyId, config: freshBlockConfig(original.config ?? {}), next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: (original.pos_x || 0) + 40, pos_y: (original.pos_y || 0) + 40 }]);
  }, [nodes]);

  const handleRename = useCallback((id: string, label: string | null) => {
    setNodes(ns => ns.map(n => (n.id === id ? { ...n, label } : n)));
  }, []);

  const handleSaveNodeConfig = useCallback(async (nodeId: string, patch: { label: string; config: Record<string, unknown> }) => {
    const target = nodes.find(n => n.id === nodeId);
    // Bloco com passo do guia: Salvar no painel confirma o passo (`guide_done`).
    const confirmsStep = !!target?.guide;
    const next = nodes.map(n => {
      if (n.id !== nodeId) return n;
      const saved = { ...n, label: guided ? n.label : patch.label || null, config: patch.config, ...(confirmsStep ? { guide_done: true } : {}) };
      // "Só continuar se" com critério vira Condição ao salvar (o caminho vai pro Sim).
      return willConvert(saved, guided) ? toCondition(saved) : saved;
    });
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
  }, []);

  // Fechar a lista sem escolher (Esc, clique fora, o próprio botão) desfaz o
  // "+" da saída: senão o próximo bloco ia pra saída antiga. Escolher um bloco
  // não passa por aqui (o insertNode fecha e limpa).
  const closeOrOpenBlocks = useCallback((next: boolean) => {
    setBlocksOpen(next);
    if (!next) setPendingSource(null);
  }, []);

  // Bloco solto (botão Blocos, sem "+"): aparece no meio do que está na tela,
  // não lá na coluna dos órfãos, fora de vista.
  const visibleCenter = useCallback((): { x: number; y: number } | null => {
    const box = canvasArea.current?.getBoundingClientRect();
    const flow = flowInstance.current;
    if (!box || !flow || !box.width) return null;
    const center = flow.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
    return { x: center.x - NODE_WIDTH / 2, y: center.y };
  }, []);

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
    if (!item || !podeSoltarBloco(item, estadoDoBloco)) return;
    const position = flowInstance.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY }) ?? null;
    insertNode(item, pendingSource, position);
  }, [insertNode, pendingSource, estadoDoBloco]);

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
      numberLine: numberView ? flowNumberStartLine(numberView) : null,
      editing: openPanel?.type === 'trigger',
      highlighted: highlighted === TRIGGER_NODE_ID,
      fixed: readOnly,
      onEdit: () => {
        if (!readOnly) requestPanel({ type: 'trigger' });
      },
    };
  }, [isConversation, trigger, resources, numberView, openPanel, highlighted, readOnly, requestPanel]);

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
        ? { edit: false, duplicate: false, remove: false, add: false, rename: false }
        : guided
          ? { edit: true, duplicate: false, remove: isMessageNode(n), add: false, rename: false }
          : undefined;
      return {
        id: n.id,
        type: 'flowNode',
        position: positions[n.id] || { x: 0, y: 0 },
        draggable: builderTools,
        connectable: builderTools,
        data: {
          node: n, lookups, pessoal: peloMeuNumero, donoDoEnvio,
          problem: problems[n.id] ?? null,
          editing: openPanel?.type === 'node' && openPanel.id === n.id,
          highlighted: highlighted === n.id,
          guideMark: st ? { step: st.step, state: st.done ? 'done' : step?.nodeId === n.id ? 'current' : 'pending' } : null,
          allow,
          onEdit: openNode, onDuplicate: handleDuplicate, onRemove: handleRemove, onAddFrom: addFrom, onRename: handleRename,
        },
      };
    });
    return [startNode, ...rest];
  }, [nodes, positions, startPosition, startData, lookups, problems, openPanel, highlighted, steps, step, readOnly, guided, builderTools, openNode, handleDuplicate, handleRemove, handleRename, addFrom, peloMeuNumero, donoDoEnvio]);

  // As linhas são derivadas de `nodes`: selecionar e cortar passam por aqui, senão
  // o React Flow descarta o clique e o Delete (era só apagando o bloco).
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const handleCutEdge = useCallback((edgeId: string) => {
    setNodes(prev => cutEdge(prev, edgeId));
    setSelectedEdgeId(null);
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (!builderTools) return;
    changes.forEach(c => {
      if (c.type === 'select') setSelectedEdgeId(cur => (c.selected ? c.id : cur === c.id ? null : cur));
      if (c.type === 'remove') handleCutEdge(c.id);
    });
  }, [builderTools, handleCutEdge]);

  const reactFlowEdges: Edge[] = useMemo(
    () => graphEdges.map(e => ({
      id: e.id, type: 'flowEdge', source: e.source, target: e.target, sourceHandle: e.sourceHandle,
      deletable: e.deletable && builderTools, selected: e.id === selectedEdgeId,
      label: e.label || undefined,
      labelStyle: { fontSize: 10, fill: e.color },
      style: { stroke: e.color },
      data: { onCut: handleCutEdge } satisfies FlowEdgeData,
    })),
    [graphEdges, builderTools, selectedEdgeId, handleCutEdge]
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
      toast.success(kind === 'followup' ? 'Pronto: este é o seu follow-up. Ajuste e salve.' : 'Pronto: este é o seu funil. Ajuste e salve.');
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

  if (!loading && !automation && erroAoCarregar) {
    return <EmptyState tipo="erro" className="h-full" aoTentarDeNovo={() => void load()} />;
  }
  if (loading || !automation) {
    return <Carregando variante="texto" linhas={6} className="p-6" />;
  }

  // "Da equipe" na automação: sem dono também é da equipe, então vale o que o
  // servidor diz (`personal`), não só a marca. Follow-up (Fase 3): sem dono
  // também é da equipe. Funil segue a marca.
  const ehAutomacao = kind === 'automation';
  const daEquipe = ehAutomacao && automation.permissions && 'personal' in automation.permissions
    ? automation.permissions.personal !== true
    : kind === 'followup'
      ? automation.team === true || automation.owner_user_id == null || automation.owner_user_id === ''
      : !!automation.team;
  // O gestor marca e desmarca "Da equipe" no cabeçalho também (a mesma pergunta da lista).
  const podeMarcarEquipe = ehAutomacao && !readOnly && automation.permissions?.can_mark_team === true;
  // Bloco preso a número específico: "Da equipe" não sai (o servidor recusa).
  const presa = ehAutomacao && presaNaEquipe(automation);

  async function marcarEquipe(next: boolean): Promise<boolean> {
    if (!automation) return false;
    if (!next && !(await confirmar(tirarDaEquipe(automation, meId)))) return false;
    try {
      const atualizada = await flowAutomationsService.update(automation.id, { team: next });
      // Só dono e equipe: o resto da tela pode ter edição ainda não salva.
      setAutomation(a => (a ? {
        ...a, team: atualizada.team, owner_user_id: atualizada.owner_user_id,
        owner_name: atualizada.owner_name, permissions: atualizada.permissions,
      } : a));
      return true;
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra mudar agora. Tente de novo.'));
      return false;
    }
  }

  // A chave de ligar: a mesma no canvas e na tela do celular.
  async function alternarLigado(): Promise<boolean> {
    if (!automation) return false;
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
    // Follow-up desligado com lead dentro: pergunta antes, com a contagem.
    const dentro = kind === 'followup' && automation.is_enabled ? leadsDentro(automation) : 0;
    if (dentro > 0 && !(await confirmar(pedidoDesligarFollowup(automation.name, dentro)))) return false;
    try {
      const updated = await flowAutomationsService.toggle(automation.id);
      // Só a chave (e a contagem de quem sobrou): recarregar o fluxo apagaria o que ainda não foi salvo.
      setAutomation(a => (a ? { ...a, is_enabled: updated.is_enabled, ...(updated.is_enabled ? {} : { live_count: updated.remaining ?? 0 }) } : a));
      const aviso = kind === 'followup' && !updated.is_enabled ? avisoLeadsSaindo(updated.remaining) : null;
      if (aviso) toast.success(aviso);
      return true;
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra ligar agora. Tente de novo.'));
      return false;
    }
  }

  // Celular (Raio-X do celular, 10/10/2026): sem o desenho, sem Salvar, Blocos
  // nem Simular. Fica o nome, a chave (a mesma ação do canvas) e o voltar.
  if (modoCelular) {
    return (
      <>
        <FlowCanvasCelular
          kind={kind}
          nome={automation.name}
          ligado={automation.is_enabled}
          soVer={readOnly}
          naoSalvo={unsaved}
          aoMudarLigado={alternarLigado}
          aoVoltar={goBack}
        />
        {dialogoDeConfirmacao}
      </>
    );
  }

  return (
    <MessageVariablesContext.Provider value={messageVariables}>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2 sm:px-6">
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
          {podeMarcarEquipe ? (
            <Chave
              rotulo="Da equipe"
              className={presa ? 'ml-2 max-w-xs' : 'ml-2 shrink-0'}
              ligada={daEquipe}
              aoMudar={marcarEquipe}
              desabilitada={presa}
              descricao={presa ? numeroFixoNaEquipe(automation) : undefined}
            />
          ) : daEquipe && (
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
              aoMudar={alternarLigado}
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
          <Faixa tom="neutro" icone={Users}>
            <span data-testid="faixa-so-ver">
              {kind === 'followup'
                ? daEquipe
                  ? 'Este follow-up é da equipe: só o gestor edita. Duplique pra ter a sua cópia.'
                  : 'Você só pode ver este follow-up. Duplique pra ter a sua cópia.'
                : automation.team
                  ? 'Este funil é da equipe: só o gestor edita. Você pode disparar ele nas conversas ou duplicar pra ter a sua cópia.'
                  : 'Você só pode ver este funil. Duplique pra ter a sua cópia.'}
            </span>
          </Faixa>
        )}

        {!readOnly && !step && !automation.is_enabled && blockingProblem && nodes.length > 0 && (
          <Faixa tom="atencao">{blockingProblem}</Faixa>
        )}
        {reentryAlert && (
          <Faixa tom="atencao">{reentryAlert}</Faixa>
        )}
        {(automation.paused_other_number_count ?? 0) > 0 && (
          <Faixa
            tom="atencao"
            acao={readOnly ? undefined : <Button size="sm" variant="outline" className="text-xs" onClick={() => setResolvendoPausas(true)}>Resolver</Button>}
          >
            <span data-testid="faixa-pausados">{textoDePausados(automation.paused_other_number_count ?? 0)}</span>
          </Faixa>
        )}
        {avisosDeNumero.map(w => (
          <Faixa key={w} tom="atencao">{w}</Faixa>
        ))}
        {banner !== undefined ? (
          banner && <div data-testid="faixa-do-canvas">{banner}</div>
        ) : (
          steps.length > 0 && (
            <FlowGuideBanner steps={steps} kind={kind} showFinished={sawPendingStep} onOpenStep={openStep} />
          )
        )}

        <div className="flex-1 flex min-h-0">
          <div ref={canvasArea} className="flex-1 relative min-w-0" onDragOver={onDragOver} onDrop={onDrop}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={reactFlowNodes}
                edges={reactFlowEdges}
                nodeTypes={flowNodeTypes}
                edgeTypes={flowEdgeTypes}
                onInit={instance => {
                  flowInstance.current = instance;
                }}
                onNodesChange={onNodesChange}
                onNodeClick={(_, node) => {
                  if (node.type === 'flowNode') openNode(node.id);
                }}
                onConnect={onConnect}
                onEdgesChange={onEdgesChange}
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
              <FlowBlocksMenu
                open={blocksOpen}
                onOpenChange={closeOrOpenBlocks}
                onPick={item => insertNode(item, pendingSource, pendingSource || nodes.length === 0 ? null : visibleCenter())}
                pendingLabel={pendingSource ? pendingLabel : null}
                onCancelPending={() => setPendingSource(null)}
                estadoDoBloco={estadoDoBloco}
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn('h-8 bg-background shadow-sm', blocksOpen && 'border-primary text-primary')}
                    title="Escolher um bloco pra colocar no fluxo"
                  >
                    <LayoutGrid className="h-4 w-4 mr-1" aria-hidden="true" /> Blocos
                  </Button>
                }
              />
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
              {avisosDeNumero.length > 0 && (
                <div className="mb-3 space-y-2">
                  {avisosDeNumero.map(w => (
                    <Faixa key={w} tom="atencao">{w}</Faixa>
                  ))}
                </div>
              )}
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
              pessoal={peloMeuNumero}
              numeroPessoal={capacidades.principalPhone}
              numeroPessoalCarregando={capacidades.loading}
              donoDoEnvio={donoDoEnvio}
              numeroDoFluxo={numberView}
              numerosDiferentes={numeroDoFluxoVale && !numeroAtivo && numberDivergent}
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
              soGatilhos={gatilhosDoCargo}
              semFiltroDeQuemAceitou={pessoal}
            />
          )}
        </div>

        <FlowSettingsDialog
          open={editingSettings}
          settings={{ reentry, businessHoursOnly, ...(numeroDoFluxoVale ? { number: numberSetting } : {}) }}
          numberDivergent={numberDivergent && !numberTouched}
          numbers={sendNumbers.numbers}
          numberOwnerRule={sendNumbers.ownerRule}
          numbersState={sendNumbers.state}
          triggerEvent={messageEvent}
          onClose={() => setEditingSettings(false)}
          onSave={next => {
            setReentry(next.reentry);
            setBusinessHoursOnly(next.businessHoursOnly);
            // Só vem quando a pessoa mexeu no grupo do número.
            if (next.number) {
              setNumberSetting(next.number);
              setNumberTouched(true);
            }
            setEditingSettings(false);
          }}
        />
        {resolvendoPausas && (
          <ResolverPausasDialog
            open
            flowId={automation.id}
            flowName={automation.name}
            count={automation.paused_other_number_count ?? 0}
            flowFinal={numberView?.final ?? null}
            canAlways={!readOnly}
            onClose={() => setResolvendoPausas(false)}
            onResolved={() => {
              // Só a contagem: recarregar o fluxo apagaria o que ainda não foi salvo.
              void flowAutomationsService.get(automation.id)
                .then(f => setAutomation(a => (a ? { ...a, paused_other_number_count: f.paused_other_number_count ?? 0 } : a)))
                .catch(() => undefined);
            }}
          />
        )}
        {dialogoDeConfirmacao}
      </div>
    </MessageVariablesContext.Provider>
  );
}
