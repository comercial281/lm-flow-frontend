import { Reorder } from 'framer-motion';
import { Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { BLOCK_REGISTRY } from '@/features/landing/blocks';
import { useLandingEditorStore } from './landingEditorStore';

/** Ordered list of the page sections: drag to reorder, toggle, delete, select. */
export function SectionList() {
  const blocks = useLandingEditorStore((s) => s.blocks);
  const selectedId = useLandingEditorStore((s) => s.selectedId);
  const reorder = useLandingEditorStore((s) => s.reorder);
  const toggleVisible = useLandingEditorStore((s) => s.toggleVisible);
  const removeBlock = useLandingEditorStore((s) => s.removeBlock);
  const select = useLandingEditorStore((s) => s.select);

  if (!blocks.length) {
    return <p className="px-3 py-4 text-sm text-neutral-400">Nenhuma seção ainda.</p>;
  }

  return (
    <Reorder.Group axis="y" values={blocks} onReorder={reorder} className="space-y-2">
      {blocks.map((block) => {
        const meta = BLOCK_REGISTRY[block.type];
        const active = block.id === selectedId;
        return (
          <Reorder.Item
            key={block.id}
            value={block}
            className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${
              active ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-700 bg-neutral-800'
            }`}
          >
            <GripVertical size={16} className="cursor-grab text-neutral-500" />
            <button
              type="button"
              onClick={() => select(block.id)}
              className="flex-1 truncate text-left text-sm text-neutral-100"
            >
              {meta.label}
            </button>
            <button
              type="button"
              aria-label={block.visible ? 'Ocultar' : 'Mostrar'}
              onClick={() => toggleVisible(block.id)}
              className="text-neutral-400 hover:text-neutral-100"
            >
              {block.visible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button
              type="button"
              aria-label="Excluir"
              onClick={() => removeBlock(block.id)}
              className="text-neutral-400 hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
}
