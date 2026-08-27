import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Palette, Plus, Redo2, Save, Undo2, X } from 'lucide-react';
import type {
  BlockInstance,
  BrandMode,
  LandingProperty,
  LandingTheme,
} from '@/features/landing/blocks';
import { BLOCK_REGISTRY } from '@/features/landing/blocks';
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
  /** page.settings como veio do servidor — o editor grava dentro dele o destino
   *  por resposta, e precisa devolver o objeto INTEIRO ao salvar. */
  initialSettings?: Record<string, unknown>;
  saving?: boolean;
  onSave: (blocks: BlockInstance[]) => void;
  onBack?: () => void;
  /** Ações extras na barra de cima, à esquerda do Salvar (ex: Publicar). */
  headerActions?: ReactNode;
}

/**
 * Editor de landing em TRÊS colunas: a árvore de seções à esquerda, a prévia no
 * meio e, à direita, só as configurações do que está selecionado.
 *
 * O formato anterior era de duas colunas, com a lista de seções, as
 * configurações, a aparência e a biblioteca empilhadas numa faixa de 340px —
 * apertado, sem hierarquia, e impossível de saber o que se estava editando.
 * A interface segue os tokens do tema do LM Flow; a prévia mantém as cores da
 * landing, que são a página sendo editada.
 */
export function LandingEditor({
  title = 'Editar Página',
  initialBlocks,
  property,
  initialTheme,
  initialBrandMode,
  initialSettings,
  saving = false,
  onSave,
  onBack,
  headerActions,
}: LandingEditorProps) {
  const load = useLandingEditorStore((s) => s.load);
  const blocks = useLandingEditorStore((s) => s.blocks);
  const dirty = useLandingEditorStore((s) => s.dirty);
  const undo = useLandingEditorStore((s) => s.undo);
  const redo = useLandingEditorStore((s) => s.redo);
  const canUndo = useLandingEditorStore((s) => s.past.length > 0);
  const canRedo = useLandingEditorStore((s) => s.future.length > 0);
  const markSaved = useLandingEditorStore((s) => s.markSaved);
  const selection = useLandingEditorStore((s) => s.selection);
  const setSelection = useLandingEditorStore((s) => s.setSelection);
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    load(initialBlocks, initialTheme, initialBrandMode, initialSettings);
  }, [initialBlocks, initialTheme, initialBrandMode, initialSettings, load]);

  const handleSave = () => {
    onSave(blocks);
    markSaved();
  };

  const selectedBlock =
    selection && selection.kind !== 'appearance'
      ? blocks.find((b) => b.id === (selection.kind === 'block' ? selection.id : selection.blockId))
      : undefined;
  const panelTitle =
    selection?.kind === 'appearance'
      ? 'Aparência da página'
      : selection?.kind === 'question'
        ? 'Pergunta'
        : selectedBlock
          ? BLOCK_REGISTRY[selectedBlock.type].label
          : 'Configurações';

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* barra de cima */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              aria-label="Voltar"
              onClick={onBack}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="text-sm font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground">Visualize as alterações em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Aparência"
            title="Aparência da página"
            onClick={() => setSelection({ kind: 'appearance' })}
            className={`rounded-md p-2 hover:bg-muted ${
              selection?.kind === 'appearance' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Palette className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Desfazer"
            disabled={!canUndo}
            onClick={undo}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Refazer"
            disabled={!canRedo}
            onClick={redo}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          {headerActions}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* coluna 1: as seções da página */}
        <aside className="flex w-[264px] flex-none flex-col overflow-y-auto border-r border-border p-3">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Seções da página
          </h3>
          <SectionList />
          <button
            type="button"
            onClick={() => setLibraryOpen((v) => !v)}
            className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Adicionar seção
          </button>
          {libraryOpen && (
            <div className="mt-2 rounded-lg border border-border bg-card p-2">
              <BlockLibrary onAdded={() => setLibraryOpen(false)} />
            </div>
          )}
        </aside>

        {/* coluna 2: a prévia */}
        <main className="min-w-0 flex-1 bg-muted/40">
          <PhonePreview property={property} />
        </main>

        {/* coluna 3: só o que está selecionado */}
        <aside className="flex w-[336px] flex-none flex-col overflow-y-auto border-l border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <h3 className="truncate text-sm font-semibold">{panelTitle}</h3>
            {selection && (
              <button
                type="button"
                aria-label="Fechar painel"
                onClick={() => setSelection(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex-1 p-3">
            {selection?.kind === 'appearance' ? <AppearancePanel /> : <BlockConfigPanel />}
          </div>
        </aside>
      </div>
    </div>
  );
}
