import { BlockRenderer, type LandingProperty, type LandingTheme } from '@/features/landing/blocks';
import { useLandingEditorStore } from './landingEditorStore';

/** Live preview inside a phone mockup. Renders hidden blocks dimmed. */
export function PhonePreview({
  property,
  theme,
}: {
  property?: LandingProperty | null;
  theme?: Partial<LandingTheme>;
}) {
  const blocks = useLandingEditorStore((s) => s.blocks);
  return (
    <div className="flex h-full items-start justify-center overflow-auto p-6">
      <div
        className="relative w-[360px] flex-none overflow-hidden rounded-[2.2rem] border-[10px] border-neutral-900 shadow-2xl"
        style={{ height: 720 }}
      >
        <div className="h-full overflow-y-auto">
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
