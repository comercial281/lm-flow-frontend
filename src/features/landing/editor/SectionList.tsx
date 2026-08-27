import { useEffect, useRef } from 'react';
import { Reorder } from 'framer-motion';
import { ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, Plus, Trash2 } from 'lucide-react';
import { BLOCK_REGISTRY, type BlockConfig, type BlockInstance } from '@/features/landing/blocks';
import { useLandingEditorStore } from './landingEditorStore';

/**
 * Árvore das seções da página: arrasta pra reordenar, mostra/oculta, exclui e
 * seleciona. A seção do formulário ABRE em filhos — uma linha por pergunta —
 * porque era impossível saber qual pergunta se estava editando quando todas
 * viviam empilhadas dentro de um painel só.
 */
export function SectionList() {
  const blocks = useLandingEditorStore((s) => s.blocks);
  const selection = useLandingEditorStore((s) => s.selection);
  const reorder = useLandingEditorStore((s) => s.reorder);
  const toggleVisible = useLandingEditorStore((s) => s.toggleVisible);
  const removeBlock = useLandingEditorStore((s) => s.removeBlock);
  const setSelection = useLandingEditorStore((s) => s.setSelection);

  // Ao adicionar uma seção (a lista cresce), rola a seção nova — que já vem
  // selecionada — pra dentro da vista, pra ficar claro que foi adicionada.
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const prevCount = useRef(blocks.length);
  useEffect(() => {
    const selectedId = selection?.kind === 'block' ? selection.id : null;
    if (blocks.length > prevCount.current && selectedId) {
      itemRefs.current[selectedId]?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }
    prevCount.current = blocks.length;
  }, [blocks.length, selection]);

  if (!blocks.length) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">Nenhuma seção ainda.</p>;
  }

  return (
    <Reorder.Group axis="y" values={blocks} onReorder={reorder} className="space-y-1">
      {blocks.map((block) => {
        const meta = BLOCK_REGISTRY[block.type];
        const active = selection?.kind === 'block' && selection.id === block.id;
        const open =
          block.type === 'lead_form' &&
          ((selection?.kind === 'block' && selection.id === block.id) ||
            (selection?.kind === 'question' && selection.blockId === block.id));
        return (
          <Reorder.Item
            key={block.id}
            value={block}
            ref={(el: HTMLElement | null) => {
              itemRefs.current[block.id] = el;
            }}
            className="list-none"
          >
            <div
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${
                active ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'
              }`}
            >
              <GripVertical className="h-3.5 w-3.5 flex-none cursor-grab text-muted-foreground/60" />
              <button
                type="button"
                onClick={() => setSelection({ kind: 'block', id: block.id })}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm text-foreground"
              >
                {block.type === 'lead_form' &&
                  (open ? (
                    <ChevronDown className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                  ))}
                <span className="truncate">{meta.label}</span>
              </button>
              <button
                type="button"
                aria-label={block.visible ? 'Ocultar' : 'Mostrar'}
                onClick={() => toggleVisible(block.id)}
                className="flex-none text-muted-foreground hover:text-foreground"
              >
                {block.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                aria-label="Excluir"
                onClick={() => removeBlock(block.id)}
                className="flex-none text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {open && <QuestionBranch block={block} />}
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
}

/** As perguntas do formulário, como filhas da seção. */
function QuestionBranch({ block }: { block: BlockInstance }) {
  const selection = useLandingEditorStore((s) => s.selection);
  const setSelection = useLandingEditorStore((s) => s.setSelection);
  const addStep = useLandingEditorStore((s) => s.addStep);
  const removeStep = useLandingEditorStore((s) => s.removeStep);
  const config = block.config as BlockConfig<'lead_form'>;

  return (
    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
      {config.steps.map((step, i) => {
        const active = selection?.kind === 'question' && selection.stepId === step.id;
        return (
          <div
            key={step.id}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${
              active ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
            }`}
          >
            <button
              type="button"
              onClick={() => setSelection({ kind: 'question', blockId: block.id, stepId: step.id })}
              className="min-w-0 flex-1 truncate text-left text-xs"
              title={step.question}
            >
              <span className="text-muted-foreground">{i + 1}.</span>{' '}
              {step.question || 'Pergunta sem texto'}
            </button>
            <button
              type="button"
              aria-label={`Excluir pergunta ${i + 1}`}
              onClick={() => removeStep(block.id, step.id)}
              className="flex-none text-muted-foreground hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => addStep(block.id)}
        className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-primary"
      >
        <Plus className="h-3 w-3" /> Adicionar pergunta
      </button>
      <div className="px-2 py-1 text-xs text-muted-foreground">Depois: dados de contato</div>
    </div>
  );
}
