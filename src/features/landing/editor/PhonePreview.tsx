import { useEffect, useRef } from 'react';
import { BlockRenderer, BLOCK_REGISTRY, type LandingProperty } from '@/features/landing/blocks';
import { useLandingEditorStore } from './landingEditorStore';

/**
 * Prévia ao vivo dentro de um aparelho. Seções ocultas aparecem esmaecidas.
 *
 * Clicar numa seção da prévia seleciona ela na árvore, e selecionar na árvore
 * rola a prévia até ela — sem isso, montar uma página longa virava caçada: a
 * lista à esquerda e a página no meio não se falavam.
 *
 * A landing é uma coluna estreita por natureza (é feita pra celular, e o
 * endereço público serve a mesma largura no computador), então não existe
 * alternar entre celular e computador: o que se vê aqui é o que o lead vê.
 */
export function PhonePreview({ property }: { property?: LandingProperty | null }) {
  const blocks = useLandingEditorStore((s) => s.blocks);
  const theme = useLandingEditorStore((s) => s.theme);
  const selection = useLandingEditorStore((s) => s.selection);
  const setSelection = useLandingEditorStore((s) => s.setSelection);

  const selectedId =
    selection?.kind === 'block' ? selection.id : selection?.kind === 'question' ? selection.blockId : null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(blocks.length);

  // Seção nova entra no fim: rola até ela pra o usuário ver que apareceu.
  useEffect(() => {
    if (blocks.length > prevCount.current) {
      const el = scrollRef.current;
      if (el) requestAnimationFrame(() => el.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' }));
    }
    prevCount.current = blocks.length;
  }, [blocks.length]);

  // Selecionou na árvore → traz a seção pra vista.
  useEffect(() => {
    if (!selectedId) return;
    const el = scrollRef.current?.querySelector(`[data-block-id="${selectedId}"]`);
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);

  const onPreviewClick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-block-id]') as HTMLElement | null;
    const id = el?.getAttribute('data-block-id');
    if (id) setSelection({ kind: 'block', id });
  };

  const selectedLabel = (() => {
    const block = blocks.find((b) => b.id === selectedId);
    return block ? BLOCK_REGISTRY[block.type].label : null;
  })();

  return (
    <div className="flex h-full items-start justify-center overflow-auto p-6">
      <div
        className="relative w-[380px] flex-none overflow-hidden rounded-[2.2rem] border-[10px] border-neutral-800 shadow-2xl"
        style={{ height: 760 }}
      >
        <div ref={scrollRef} className="h-full overflow-y-auto" onClickCapture={onPreviewClick}>
          {blocks.length === 0 ? (
            <div className="flex h-full items-center justify-center bg-white p-8 text-center text-sm text-neutral-500">
              Use “Adicionar seção” para montar a página.
            </div>
          ) : (
            <BlockRenderer
              blocks={blocks}
              property={property}
              theme={theme}
              showHidden
              selectedBlockId={selectedId}
              selectedLabel={selectedLabel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
