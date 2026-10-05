import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Pencil, Copy, Trash2, Zap, AlertTriangle } from 'lucide-react';
import type { MouseEvent } from 'react';
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
import { blockDescription } from '@/features/flowAutomations/blockInfo';
import { RECOVERED_SUMMARY } from '@/features/flowAutomations/recovered';
import { BOOK_SOURCE, BOOK_SUMMARY } from '@/features/flowAutomations/book';
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
  /** O bloco está aberto no painel lateral. */
  editing?: boolean;
  /**
   * Ponto de encaixe do guia de construção (sprint 4, parte B): o bloco do passo
   * atual pisca com borda destacada. Ninguém liga ainda.
   */
  highlighted?: boolean;
  /**
   * Sprint 4 (construção guiada): o passo do guia deste bloco — feito (✓), o
   * atual ou um que ainda falta. Ausente = bloco sem passo.
   */
  guideMark?: { step: number; state: 'done' | 'current' | 'pending' } | null;
  /**
   * O que o cartão oferece (sprint 4). Modo guiado: sem duplicar, sem "+ saída"
   * e "Excluir" só em mensagem. Só ver (funil da equipe): nada, nem abrir.
   * Ausente = tudo.
   */
  allow?: { edit: boolean; duplicate: boolean; remove: boolean; add: boolean };
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAddFrom: (sourceId: string, handle: OutputHandle) => void;
}

/** O bloco Início (sprint 4): o gatilho, desenhado como o primeiro bloco. */
export interface FlowStartNodeData {
  /** "Etapa alterada (Etapa: Follow-up) · ou Etiqueta adicionada" (triggerOneLine). */
  summary: string;
  hint: string | null;
  /** O que falta no gatilho (triggerProblem), ou null. */
  problem?: string | null;
  editing?: boolean;
  /** Ponto de encaixe do guia (ver FlowNodeCardData.highlighted). */
  highlighted?: boolean;
  /**
   * Gatilho fixo (funil de conversa, sprint 4): o Início só mostra o "Quando",
   * não abre painel.
   */
  fixed?: boolean;
  onEdit: () => void;
}

/** Botão dentro do cartão: não deixa o clique chegar no cartão (que abre o painel). */
const own = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn();
};

const HIGHLIGHT_CLASS = 'ring-4 ring-amber-400/80 animate-pulse';

function sendFromLine(config: Record<string, unknown>): string | null {
  const envio = sendFromOf(config);
  if (envio.send_from === 'owner') return 'Pelo número do responsável pelo lead';
  if (envio.send_from === 'number') return 'Por um número específico';
  return null;
}

const MEDIA_LINE: Record<string, string> = {
  image: 'Foto', video: 'Vídeo', document: 'Documento', audio: 'Áudio', sticker: 'Figurinha',
};

/** A linha da mensagem (sprint 4: mídia e contato do funil de conversa). */
export function messageLine(cfg: Record<string, unknown>): string {
  const text = String(cfg.text ?? '').trim();
  if (cfg.media_source === BOOK_SOURCE) return BOOK_SUMMARY;
  const media = String(cfg.media_kind ?? '').trim();
  if (MEDIA_LINE[media]) {
    if (!String(cfg.media_url ?? '').trim()) return `${MEDIA_LINE[media]} (escolha o arquivo)`;
    return text ? `${MEDIA_LINE[media]}: ${text}` : MEDIA_LINE[media];
  }
  const contact = String(cfg.contact_name ?? '').trim() || String(cfg.contact_phone ?? '').trim();
  if (contact) return `Contato: ${contact}`;
  return text || '(mensagem vazia)';
}

export function summaryLine(node: FlowAutomationNode, lookups: FlowLookups = {}): string {
  const cfg = node.config || {};
  if (!isVisibleNode(node)) return HIDDEN_BLOCK_NOTICE;
  switch (node.kind) {
    case 'send_whatsapp':
      return messageLine(cfg);
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
    case 'hand_to_ai':
    case 'disable_ai':
      return blockDescription(node);
    case 'lead_action':
      return lookups.actionSummary?.(leadActionOf(cfg)) ?? '';
    default:
      return node.label || '';
  }
}

// O primeiro bloco do fluxo. Não tem entrada (nada vem antes dele), não se
// apaga e não se arrasta; clicar abre o painel do gatilho. Não existe no banco:
// a linha que sai dele é o `initial_node_id`.
export function FlowStartNode({ data }: NodeProps) {
  const { summary, hint, problem, editing, highlighted, fixed, onEdit } = data as unknown as FlowStartNodeData;
  const body = (
    <>
      <div className="flex items-center gap-2 rounded-t-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white">
        <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1">Início</span>
        {!fixed && <Pencil className="h-3 w-3 opacity-80" aria-hidden="true" />}
      </div>
      <div className="px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
        <span className="font-semibold">Quando: </span>
        <span className="line-clamp-3">{summary}</span>
      </div>
      {hint && <div className="px-3 pb-2 text-[11px] text-emerald-800/80 dark:text-emerald-200/80 line-clamp-3">{hint}</div>}
      {problem && (
        <div className="mx-3 mb-2 flex items-start gap-1 rounded bg-amber-500/10 px-1.5 py-1 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3 mt-px shrink-0" aria-hidden="true" />
          <span>{problem}</span>
        </div>
      )}
    </>
  );
  return (
    <div
      data-testid="bloco-inicio"
      data-highlighted={highlighted ? 'true' : undefined}
      className={cn(
        'rounded-lg border-2 bg-emerald-50 dark:bg-emerald-950/40 shadow-sm',
        problem ? 'border-amber-500' : 'border-emerald-500',
        editing && 'ring-2 ring-primary',
        highlighted && HIGHLIGHT_CLASS,
      )}
      style={{ width: NODE_WIDTH }}
    >
      {fixed ? (
        <div className="rounded-lg" role="group" aria-label={`Início. Quando: ${summary}`}>{body}</div>
      ) : (
        <button
          type="button"
          onClick={own(onEdit)}
          className="block w-full text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Início. Quando: ${summary}. Abrir o gatilho`}
        >
          {body}
        </button>
      )}
      <Handle type="source" position={Position.Right} id="out" className="!bg-emerald-500 !w-3 !h-3" />
    </div>
  );
}

export function FlowNodeCard({ id, data, selected }: NodeProps) {
  const { node, lookups, problem, editing, highlighted, guideMark, allow, onEdit, onDuplicate, onRemove, onAddFrom } = data as unknown as FlowNodeCardData;
  const can = allow ?? { edit: true, duplicate: true, remove: true, add: true };
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
      data-highlighted={highlighted ? 'true' : undefined}
      data-guide={guideMark?.state}
      className={cn(
        'relative rounded-lg border bg-card shadow-sm transition-shadow',
        can.edit && 'cursor-pointer',
        selected || editing ? 'ring-2 ring-primary' : problem ? 'border-amber-500' : 'border-border',
        hidden && 'opacity-80',
        highlighted && HIGHLIGHT_CLASS,
      )}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-3 !h-3" />
      {guideMark && (
        <span
          className={cn(
            'absolute -top-2.5 -right-2.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background px-1 text-[11px] font-bold shadow',
            guideMark.state === 'done' && 'bg-emerald-500 text-white',
            guideMark.state === 'current' && 'bg-amber-400 text-amber-950',
            guideMark.state === 'pending' && 'bg-muted text-muted-foreground',
          )}
          aria-label={guideMark.state === 'done' ? `Passo ${guideMark.step} feito` : `Passo ${guideMark.step}`}
          title={guideMark.state === 'done' ? `Passo ${guideMark.step} feito` : `Passo ${guideMark.step}`}
        >
          {guideMark.state === 'done' ? '✓' : guideMark.step}
        </span>
      )}

      <div className="flex items-center justify-between gap-1 rounded-t-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: color }}>
        <span className="truncate">{title}</span>
        <div className="flex items-center gap-1 shrink-0">
          {can.edit && (
            <button onClick={own(() => onEdit(id))} className="rounded p-0.5 hover:bg-white/20" aria-label={`Editar ${title}`} title="Editar">
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {can.duplicate && (
            <button onClick={own(() => onDuplicate(id))} className="rounded p-0.5 hover:bg-white/20" aria-label={`Duplicar ${title}`} title="Duplicar">
              <Copy className="h-3 w-3" />
            </button>
          )}
          {can.remove && (
            <button onClick={own(() => onRemove(id))} className="rounded p-0.5 hover:bg-white/20" aria-label={`Excluir ${title}`} title="Excluir">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
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

      {(branching || (loose.length > 0 && can.add)) && (
        <div className="border-t border-border px-2 py-1.5 flex flex-wrap gap-1">
          {(branching ? branches : loose).map(handle => {
            const name = handleLabel(node.kind, handle);
            const dot = <span className="inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle" style={{ backgroundColor: handleColor(node.kind, handle) }} />;
            return loose.includes(handle) && can.add ? (
              <button
                key={handle}
                onClick={own(() => onAddFrom(id, handle))}
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
  flowStart: FlowStartNode,
};

export { TRIGGER_NODE_ID };
