import { useEffect } from 'react';
import { ArrowLeft, Redo2, Save, Undo2 } from 'lucide-react';
import type {
  BlockInstance,
  BrandMode,
  LandingProperty,
  LandingTheme,
} from '@/features/landing/blocks';
import { useLandingEditorStore } from './landingEditorStore';
import { PhonePreview } from './PhonePreview';
import { SectionList } from './SectionList';
import { BlockLibrary } from './BlockLibrary';
import { BlockConfigPanel } from './BlockConfigPanel';
import { AppearancePanel } from './AppearancePanel';

export interface LandingEditorProps {
  title?: string;
  initialBlocks: BlockInstance[];
  property?: LandingProperty | null;
  initialTheme?: Partial<LandingTheme>;
  initialBrandMode?: BrandMode;
  saving?: boolean;
  onSave: (blocks: BlockInstance[]) => void;
  onBack?: () => void;
}

/** Two-column landing editor: live phone preview + config panel.
 *  Used both for the portal property template ("modo Template") and for ad
 *  landing pages ("modo LP"). */
export function LandingEditor({
  title = 'Editar Página',
  initialBlocks,
  property,
  initialTheme,
  initialBrandMode,
  saving = false,
  onSave,
  onBack,
}: LandingEditorProps) {
  const load = useLandingEditorStore((s) => s.load);
  const blocks = useLandingEditorStore((s) => s.blocks);
  const dirty = useLandingEditorStore((s) => s.dirty);
  const undo = useLandingEditorStore((s) => s.undo);
  const redo = useLandingEditorStore((s) => s.redo);
  const canUndo = useLandingEditorStore((s) => s.past.length > 0);
  const canRedo = useLandingEditorStore((s) => s.future.length > 0);
  const markSaved = useLandingEditorStore((s) => s.markSaved);

  useEffect(() => {
    load(initialBlocks, initialTheme, initialBrandMode);
  }, [initialBlocks, initialTheme, initialBrandMode, load]);

  const handleSave = () => {
    onSave(blocks);
    markSaved();
  };

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-100">
      {/* toolbar */}
      <header className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              aria-label="Voltar"
              onClick={onBack}
              className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-base font-semibold">{title}</h1>
            <p className="text-xs text-neutral-500">Visualize as alterações em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Desfazer"
            disabled={!canUndo}
            onClick={undo}
            className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            aria-label="Refazer"
            disabled={!canRedo}
            onClick={redo}
            className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
          >
            <Redo2 size={18} />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            <Save size={16} /> {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </header>

      {/* body */}
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 bg-neutral-900/40">
          <PhonePreview property={property} />
        </main>
        <aside className="flex w-[340px] flex-none flex-col overflow-y-auto border-l border-neutral-800 p-4">
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-neutral-200">Seções da página</h3>
            <SectionList />
          </section>
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-neutral-200">Configurações</h3>
            <BlockConfigPanel />
          </section>
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-neutral-200">Aparência</h3>
            <AppearancePanel />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-neutral-200">Adicionar seção</h3>
            <BlockLibrary />
          </section>
        </aside>
      </div>
    </div>
  );
}
