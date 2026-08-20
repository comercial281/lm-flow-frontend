import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Pencil, Copy, Trash2, Zap } from 'lucide-react';
import { FLOW_NODE_DEF_BY_KIND, type FlowAutomationNode } from '@/types/flowAutomations';
import { nodeColor, looseOutputs, NODE_WIDTH, TRIGGER_NODE_ID } from '@/lib/flowAutomationGraph';
import { cn } from '@/lib/utils';

export interface FlowNodeCardData {
  node: FlowAutomationNode;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAddFrom: (sourceId: string, handle: 'out' | 'yes' | 'no') => void;
}

function summaryLine(node: FlowAutomationNode): string {
  const cfg = node.config || {};
  switch (node.kind) {
    case 'send_whatsapp':
    case 'notify_group':
      return (cfg.text as string) || '(vazio)';
    case 'send_email':
      return (cfg.subject as string) || '(sem assunto)';
    case 'wait': {
      const minutes = Number(cfg.minutes || 0);
      if (minutes >= 1440) return `Espera ${Math.round(minutes / 1440)} dia(s)`;
      if (minutes >= 60) return `Espera ${Math.round(minutes / 60)}h`;
      return `Espera ${minutes}min`;
    }
    case 'condition':
      return `Critério: ${cfg.criterion || '(nenhum)'}`;
    case 'add_label':
    case 'remove_label':
      return Array.isArray(cfg.labels) ? (cfg.labels as string[]).join(', ') || '(nenhuma etiqueta)' : '(nenhuma etiqueta)';
    case 'funnel':
      return cfg.funnel_id ? 'Funil escolhido' : '(nenhum funil escolhido)';
    case 'call_flow':
      return cfg.flow_automation_id ? 'Fluxo escolhido' : '(nenhum fluxo escolhido)';
    case 'http_call':
    case 'webhook':
      return (cfg.url as string) || (cfg.event_name as string) || '(não configurado)';
    default:
      return node.label || '';
  }
}

export function FlowTriggerNode({ data }: NodeProps) {
  const { trigger } = data as { trigger: string };
  return (
    <div className="rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-sm" style={{ width: NODE_WIDTH }}>
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        <Zap className="h-4 w-4 shrink-0" />
        <span className="truncate">{trigger || 'Escolha o gatilho'}</span>
      </div>
      <Handle type="source" position={Position.Right} id="out" className="!bg-emerald-500 !w-3 !h-3" />
    </div>
  );
}

export function FlowNodeCard({ id, data, selected }: NodeProps) {
  const { node, onEdit, onDuplicate, onRemove, onAddFrom } = data as unknown as FlowNodeCardData;
  const def = FLOW_NODE_DEF_BY_KIND[node.kind];
  const color = nodeColor(node.kind, def?.group || 'control');
  const outputs = looseOutputs(node);
  const isCondition = node.kind === 'condition';

  return (
    <div
      className={cn(
        'rounded-lg border bg-card shadow-sm transition-shadow',
        selected ? 'ring-2 ring-primary' : 'border-border'
      )}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-3 !h-3" />

      <div className="flex items-center justify-between gap-1 rounded-t-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: color }}>
        <span className="truncate">{node.label || def?.label || node.kind}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(id)} className="rounded p-0.5 hover:bg-white/20" title="Editar">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={() => onDuplicate(id)} className="rounded p-0.5 hover:bg-white/20" title="Duplicar">
            <Copy className="h-3 w-3" />
          </button>
          <button onClick={() => onRemove(id)} className="rounded p-0.5 hover:bg-white/20" title="Excluir">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
        {summaryLine(node)}
      </div>

      {!isCondition && (
        <Handle type="source" position={Position.Right} id="out" className="!bg-slate-400 !w-3 !h-3" />
      )}
      {isCondition && (
        <>
          <Handle type="source" position={Position.Right} id="yes" style={{ top: '35%' }} className="!bg-emerald-500 !w-3 !h-3" />
          <Handle type="source" position={Position.Right} id="no" style={{ top: '65%' }} className="!bg-red-500 !w-3 !h-3" />
        </>
      )}

      {outputs.length > 0 && (
        <div className="border-t border-border px-2 py-1.5 flex flex-wrap gap-1">
          {outputs.map(handle => (
            <button
              key={handle}
              onClick={() => onAddFrom(id, handle)}
              className="text-[10px] rounded border border-dashed border-border px-1.5 py-0.5 text-muted-foreground hover:border-primary hover:text-primary"
            >
              + {handle === 'yes' ? 'sim' : handle === 'no' ? 'não' : 'continuar'}
            </button>
          ))}
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
