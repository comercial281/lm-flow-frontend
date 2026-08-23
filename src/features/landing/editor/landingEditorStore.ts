import { create } from 'zustand';
import {
  type BlockConfig,
  type BlockInstance,
  type BlockType,
  type BrandMode,
  type LandingTheme,
  createBlock,
} from '@/features/landing/blocks';

/**
 * Editor state for a landing page / property template.
 * Pure (no API) so it is unit-testable; persistence is wired by the page that
 * mounts the editor. Keeps an undo/redo history of block snapshots.
 */

const MAX_HISTORY = 50;

interface LandingEditorState {
  blocks: BlockInstance[];
  selectedId: string | null;
  dirty: boolean;
  past: BlockInstance[][];
  future: BlockInstance[][];
  theme: Partial<LandingTheme>;
  brandMode: BrandMode;

  load: (blocks: BlockInstance[], theme?: Partial<LandingTheme>, brandMode?: BrandMode) => void;
  setTheme: (patch: Partial<LandingTheme>) => void;
  setBrandMode: (mode: BrandMode) => void;
  select: (id: string | null) => void;
  addBlock: (type: BlockType) => void;
  removeBlock: (id: string) => void;
  toggleVisible: (id: string) => void;
  reorder: (blocks: BlockInstance[]) => void;
  updateConfig: <T extends BlockType>(id: string, patch: Partial<BlockConfig<T>>) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const clone = (blocks: BlockInstance[]): BlockInstance[] =>
  blocks.map((b) => ({ ...b, config: { ...b.config } }));

export const useLandingEditorStore = create<LandingEditorState>((set, get) => {
  /** Apply a mutation, pushing the previous state onto the undo stack. */
  const commit = (next: BlockInstance[]) =>
    set((s) => ({
      past: [...s.past, clone(s.blocks)].slice(-MAX_HISTORY),
      future: [],
      blocks: next,
      dirty: true,
    }));

  return {
    blocks: [],
    selectedId: null,
    dirty: false,
    past: [],
    future: [],
    theme: {},
    brandMode: 'client',

    load: (blocks, theme = {}, brandMode = 'client') =>
      set({
        blocks: clone(blocks),
        theme: { ...theme },
        brandMode,
        selectedId: null,
        dirty: false,
        past: [],
        future: [],
      }),

    setTheme: (patch) => set((s) => ({ theme: { ...s.theme, ...patch }, dirty: true })),
    setBrandMode: (mode) => set({ brandMode: mode, dirty: true }),

    select: (id) => set({ selectedId: id }),

    addBlock: (type) => {
      const block = createBlock(type);
      commit([...get().blocks, block]);
      set({ selectedId: block.id });
    },

    removeBlock: (id) => {
      commit(get().blocks.filter((b) => b.id !== id));
      if (get().selectedId === id) set({ selectedId: null });
    },

    toggleVisible: (id) =>
      commit(get().blocks.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b))),

    reorder: (blocks) => commit(clone(blocks)),

    updateConfig: (id, patch) =>
      commit(
        get().blocks.map((b) =>
          b.id === id ? { ...b, config: { ...b.config, ...patch } } : b,
        ),
      ),

    undo: () => {
      const { past, blocks, future } = get();
      if (!past.length) return;
      const previous = past[past.length - 1];
      set({
        past: past.slice(0, -1),
        future: [clone(blocks), ...future].slice(0, MAX_HISTORY),
        blocks: previous,
        dirty: true,
      });
    },

    redo: () => {
      const { future, blocks, past } = get();
      if (!future.length) return;
      const next = future[0];
      set({
        future: future.slice(1),
        past: [...past, clone(blocks)].slice(-MAX_HISTORY),
        blocks: next,
        dirty: true,
      });
    },

    markSaved: () => set({ dirty: false }),
    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
});
