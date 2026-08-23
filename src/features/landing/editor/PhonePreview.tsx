import { useEffect, useRef } from 'react';
import { BlockRenderer, type LandingProperty } from '@/features/landing/blocks';
import { useLandingEditorStore } from './landingEditorStore';

/** Live preview inside a phone mockup. Renders hidden blocks dimmed. */
export function PhonePreview({ property }: { property?: LandingProperty | null }) {
  const blocks = useLandingEditorStore((s) => s.blocks);
  const theme = useLandingEditorStore((s) => s.theme);

  // Ao adicionar uma seção (a lista cresce), o bloco novo entra no fim. Rola o
  // preview até ele pra o usuário ver na hora que a seção apareceu.
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(blocks.length);
  useEffect(() => {
    if (blocks.length > prevCount.current) {
      const el = scrollRef.current;
      if (el) requestAnimationFrame(() => el.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' }));
    }
    prevCount.current = blocks.length;
  }, [blocks.length]);

  return (
    <div className="flex h-full items-start justify-center overflow-auto p-6">
      <div
        className="relative w-[360px] flex-none overflow-hidden rounded-[2.2rem] border-[10px] border-neutral-900 shadow-2xl"
        style={{ height: 720 }}
      >
        <div ref={scrollRef} className="h-full overflow-y-auto">
          {blocks.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-neutral-400">
              Adicione seções pela biblioteca para montar a página.
            </div>
          ) : (
            <BlockRenderer blocks={blocks} property={property} theme={theme} showHidden />
          )}
        </div>
      </div>
    </div>
  );
}
