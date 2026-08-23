import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  BLOCK_CATEGORY_LABELS,
  BLOCK_LIBRARY,
  type BlockCategory,
} from '@/features/landing/blocks';
import { useLandingEditorStore } from './landingEditorStore';

const CATEGORY_ORDER: BlockCategory[] = ['destaque', 'imovel', 'conversao', 'midia', 'prova'];

/** Library of blocks the user can add, grouped by category. */
export function BlockLibrary() {
  const addBlock = useLandingEditorStore((s) => s.addBlock);

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.map((cat) => {
        const items = BLOCK_LIBRARY.filter((b) => b.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {BLOCK_CATEGORY_LABELS[cat]}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {items.map((meta) => (
                <button
                  key={meta.type}
                  type="button"
                  onClick={() => {
                    addBlock(meta.type);
                    toast.success(`Seção "${meta.label}" adicionada`);
                  }}
                  title={meta.description}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-left text-xs text-neutral-100 hover:border-violet-500"
                >
                  <Plus size={14} className="flex-none text-violet-400" />
                  <span className="truncate">{meta.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
