import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Pencil, Copy, Trash2, Zap, AlertTriangle } from 'lucide-react';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import {
  nodeColor, looseOutputs, NODE_WIDTH, TRIGGER_NODE_ID, branchHandles, handleColor, handleLabel, isBranching,
  type OutputHandle,
} from '@/lib/flowAutomationGraph';
import { HIDDEN_BLOCK_NOTICE, blockGroup, blockLabel, isVisibleNode } from '@/features/flowAutomations/palette';
import { leadActionOf } from '@/features/flowAutomations/leadAction';
import type { LeadAutomationAction } from '@/services/leadAutomation/leadAutomationService';
import { conditionSentence, type ConditionLookups } from '@/features/flowAutomations/conditions';
import { WAIT_FOR_REPLY_HELP, describeWait, describeWaitForReply } from '@/features/flowAutomations/waitTime';
import { sendFromOf } from '@/features/numbers/sendFrom';
import { progressLine } from '@/features/flowAutomations/progress';
import { RECOVERED_SUMMARY } from '@/features/flowAutomations/recovered';
import { moveStageModeOf, stageNameOf } from '@/features/flowAutomations/moveStage';
import { cn } from '@/lib/utils';

/** O que o cartão precisa pra montar a frase do bloco. */
export interface FlowLookups extends ConditionLookups {
  /** A frase da ação (bloco `lead_action`): a mesma da lista de regras. */
  actionSummary?: (action: LeadAutomationAction) => string;
}

export interface FlowNodeCardData {
  node: FlowAutomationNode;
  lookups: FlowLookups;
  /** O que falta preencher no bloco (readiness.ts), ou null. */
  problem?: string | null;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAddFrom: (sourceId: string, handle: OutputHandle) => void;
}

export interface FlowTriggerNodeData {
  title: string;
  details: string[];
  hint: string | null;
  onEdit: () => void;
}

function sendFromLine(config: Record<string, unknown>): string | null {
  const envio = sendFromOf(config);
  if (envio.send_from === 'owner') return 'Pelo número do responsável pelo lead';
  if (envio.send_from === 'number') return 'Por um número específico';
  return null;
}

export function summaryLine(node: FlowAutomationNode, lookups: FlowLookups = {}): string {
  const cfg = node.config || {};
  if (!isVisibleNode(node)) return HIDDEN_BLOCK_NOTICE;
  switch (node.kind) {
    case 'send_whatsapp':
      return (cfg.text as string) || '(mensagem vazia)';
    case 'wait':
      return describeWait(cfg);
    case 'wait_for_reply':
      return describeWaitForReply(cfg);
    case 'condition':
    case 'filter_label':
      return conditionSentence(cfg, lookups);
    case 'add_label':
    case 'remove_label': {
      const labels = Array.isArray(cfg.labels) ? (cfg.labels as string[]) : [];
      return labels.length ? labels.join(', ') : '(nenhuma etiqueta)';
    }
    case 'move_stage': {
      if (moveStageModeOf(cfg) === 'name') {
        const name = stageNameOf(cfg).trim();
        return name ? `Para a coluna "${name}" do funil do card` : '(escreva o nome da coluna)';
      }
      const id = String(cfg.stage_id ?? '');
      return id ? `Para a etapa "${lookups.stageName?.(id) ?? id}"` : '(escolha a etapa)';
    }
    case 'followup_recovered':
      return RECOVERED_SUMMARY;
    case 'lead_action':
      return lookups.actionSummary?.(leadActionOf(cfg)) ?? '';
    default:
      return node.label || '';
  }
}

export function FlowTriggerNode({ data }: NodeProps) {
  const { title, details, hint, onEdit } = data as unknown as FlowTriggerNodeData;
  return (
    <div className="rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-sm" style={{ width: NODE_WIDTH }}>
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        <Zap className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1">{title}</span>
        <button onClick={onEdit} className="rounded p-0.5 hover:bg-emerald-500/20" aria-label="Editar gatilho" title="Editar gatilho">
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      {(details.length > 0 || hint) && (
        <div className="px-3 pb-2 space-y-0.5 text-xs text-emerald-800/80 dark:text-emerald-200/80">
          {details.map((d, i) => <div key={`${i}-${d}`} className="truncate">{d}</div>)}
          {hint && <div className="line-clamp-3">{hint}</div>}
        </div>
      )}
      <Handle type="source" position={Position.Right} id="out" className="!bg-emerald-500 !w-3 !h-3" />
    </div>
  );
}

export function FlowNodeCard({ id, data, selected }: NodeProps) {
  const { node, lookups, problem, onEdit, onDuplicate, onRemove, onAddFrom } = data as unknown as FlowNodeCardData;
  const hidden = !isVisibleNode(node);
  const color = hidden ? '#94a3b8' : nodeColor(node.kind, blockGroup(node));
  const loose = looseOutputs(node);
  const branching = isBranching(node);
  const branches = branchHandles(node);
  const title = node.label || blockLabel(node);
  const envio = node.kind === 'send_whatsapp' ? sendFromLine(node.config || {}) : null;
  const progresso = node.kind === 'send_whatsapp' ? progressLine(node.config) : null;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card shadow-sm transition-shadow',
        selected ? 'ring-2 ring-primary' : problem ? 'border-amber-500' : 'border-border',
        hidden && 'opacity-80'
      )}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-3 !h-3" />

      <div className="flex items-center justify-between gap-1 rounded-t-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: color }}>
        <span className="truncate">{title}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(id)} className="rounded p-0.5 hover:bg-white/20" aria-label={`Editar ${title}`} title="Editar">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={() => onDuplicate(id)} className="rounded p-0.5 hover:bg-white/20" aria-label={`Duplicar ${title}`} title="Duplicar">
            <Copy className="h-3 w-3" />
          </button>
          <button onClick={() => onRemove(id)} className="rounded p-0.5 hover:bg-white/20" aria-label={`Excluir ${title}`} title="Excluir">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className={cn('px-3 py-2 text-xs text-muted-foreground min-h-[2.5rem]', node.kind === 'condition' || node.kind === 'filter_label' ? 'line-clamp-4' : 'line-clamp-2')}>
        {summaryLine(node, lookups)}
      </div>
      {envio && <div className="px-3 -mt-1 pb-2 text-[11px] text-muted-foreground/80">{envio}</div>}
      {progresso && <div className="px-3 -mt-1 pb-2 text-[11px] text-violet-600 dark:text-violet-300">{progresso}</div>}
      {problem && (
        <div className="mx-3 mb-2 flex items-start gap-1 rounded bg-amber-500/10 px-1.5 py-1 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3 mt-px shrink-0" aria-hidden="true" />
          <span>{problem}</span>
        </div>
      )}
      {node.kind === 'wait_for_reply' && (
        <div className="px-3 -mt-1 pb-2 text-[11px] text-muted-foreground/80">{WAIT_FOR_REPLY_HELP}</div>
      )}

      {!branching && (
        <Handle type="source" position={Position.Right} id="out" className="!bg-slate-400 !w-3 !h-3" />
      )}
      {branching && branches.map((h, i) => (
        <Handle
          key={h}
          type="source"
          position={Position.Right}
          id={h}
          style={{ top: branches.length === 1 ? '50%' : i === 0 ? '35%' : '65%', backgroundColor: handleColor(node.kind, h) }}
          className="!w-3 !h-3"
        />
      ))}

      {(branching || loose.length > 0) && (
        <div className="border-t border-border px-2 py-1.5 flex flex-wrap gap-1">
          {(branching ? branches : loose).map(handle => {
            const name = handleLabel(node.kind, handle);
            const dot = <span className="inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle" style={{ backgroundColor: handleColor(node.kind, handle) }} />;
            return loose.includes(handle) ? (
              <button
                key={handle}
                onClick={() => onAddFrom(id, handle)}
                className="text-[10px] rounded border border-dashed border-border px-1.5 py-0.5 text-muted-foreground hover:border-primary hover:text-primary"
              >
                {dot}+ {name}
              </button>
            ) : (
              <span key={handle} className="text-[10px] px-1.5 py-0.5 text-muted-foreground">{dot}{name}</span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const flowNodeTypes = {
  flowNode: FlowNodeCard,
  flowTrigger: FlowTriggerNode,
};

export { TRIGGER_NODE_ID };
