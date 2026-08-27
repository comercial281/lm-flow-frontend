import { create } from 'zustand';
import {
  type BlockConfig,
  type BlockInstance,
  type BlockLayout,
  type BlockType,
  type BrandMode,
  type LandingTheme,
  type LeadFormOption,
  type LeadFormStep,
  createBlock,
} from '@/features/landing/blocks';

/** O que está selecionado no editor — é isso que o painel da direita mostra.
 *  Uma PERGUNTA é selecionável por si só: era impossível saber qual pergunta se
 *  estava editando quando todas moravam empilhadas num painel só. */
export type EditorSelection =
  | { kind: 'block'; id: string }
  | { kind: 'question'; blockId: string; stepId: string }
  | { kind: 'appearance' }
  | null;

/** Destino do lead escolhido dentro da pergunta, indexado pelo id da opção.
 *  Mora em page.settings (privado) e NÃO no bloco: o conteúdo dos blocos é
 *  servido publicamente na landing. */
export interface AnswerDestination {
  pipeline_id?: string | null;
  stage_id?: string | null;
  label_id?: string | null;
}

/**
 * Editor state for a landing page / property template.
 * Pure (no API) so it is unit-testable; persistence is wired by the page that
 * mounts the editor. Keeps an undo/redo history of block snapshots.
 */

const MAX_HISTORY = 50;

interface LandingEditorState {
  blocks: BlockInstance[];
  selectedId: string | null;
  selection: EditorSelection;
  dirty: boolean;
  past: BlockInstance[][];
  future: BlockInstance[][];
  theme: Partial<LandingTheme>;
  brandMode: BrandMode;
  /** page.settings INTEIRO, como veio do servidor. Guardado inteiro de
   *  propósito: o update da página substitui a coluna toda, e mandar só a parte
   *  do editor apagaria o Pixel e o desvio do desqualificado, gravados pela
   *  janela "Destino do lead". */
  settings: Record<string, unknown>;

  load: (
    blocks: BlockInstance[],
    theme?: Partial<LandingTheme>,
    brandMode?: BrandMode,
    settings?: Record<string, unknown>,
  ) => void;
  setTheme: (patch: Partial<LandingTheme>) => void;
  setBrandMode: (mode: BrandMode) => void;
  select: (id: string | null) => void;
  setSelection: (selection: EditorSelection) => void;
  addBlock: (type: BlockType) => void;
  removeBlock: (id: string) => void;
  toggleVisible: (id: string) => void;
  reorder: (blocks: BlockInstance[]) => void;
  updateConfig: <T extends BlockType>(id: string, patch: Partial<BlockConfig<T>>) => void;
  /** Espaçamento da seção. Medida vazia = herda o padrão da página. */
  setLayout: (id: string, patch: Partial<BlockLayout>) => void;
  /* --- perguntas e opções do formulário de lead --- */
  addStep: (blockId: string) => void;
  updateStep: (blockId: string, stepId: string, patch: Partial<LeadFormStep>) => void;
  removeStep: (blockId: string, stepId: string) => void;
  moveStep: (blockId: string, stepId: string, dir: -1 | 1) => void;
  addOption: (blockId: string, stepId: string) => void;
  updateOption: (blockId: string, stepId: string, optionId: string, patch: Partial<LeadFormOption>) => void;
  removeOption: (blockId: string, stepId: string, optionId: string) => void;
  /* --- destino por resposta (vive em settings, não no bloco) --- */
  answerDestination: (optionId: string) => AnswerDestination;
  setAnswerDestination: (optionId: string, dest: AnswerDestination) => void;
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

  /** Aplica uma alteração nas perguntas do bloco de formulário. */
  const withSteps = (blockId: string, fn: (steps: LeadFormStep[]) => LeadFormStep[]) => {
    const next = get().blocks.map((b) => {
      if (b.id !== blockId || b.type !== 'lead_form') return b;
      const cfg = b.config as BlockConfig<'lead_form'>;
      return { ...b, config: { ...cfg, steps: fn(cfg.steps) } };
    });
    commit(next);
  };

  return {
    blocks: [],
    selectedId: null,
    selection: null,
    dirty: false,
    past: [],
    future: [],
    theme: {},
    brandMode: 'client',
    settings: {},

    load: (blocks, theme = {}, brandMode = 'client', settings = {}) =>
      set({
        blocks: clone(blocks),
        theme: { ...theme },
        brandMode,
        settings: { ...settings },
        selectedId: null,
        selection: null,
        dirty: false,
        past: [],
        future: [],
      }),

    setTheme: (patch) => set((s) => ({ theme: { ...s.theme, ...patch }, dirty: true })),
    setBrandMode: (mode) => set({ brandMode: mode, dirty: true }),

    select: (id) => set({ selectedId: id, selection: id ? { kind: 'block', id } : null }),
    setSelection: (selection) =>
      set({
        selection,
        selectedId:
          selection?.kind === 'block'
            ? selection.id
            : selection?.kind === 'question'
              ? selection.blockId
              : null,
      }),

    addBlock: (type) => {
      const block = createBlock(type);
      commit([...get().blocks, block]);
      set({ selectedId: block.id, selection: { kind: 'block', id: block.id } });
    },

    removeBlock: (id) => {
      commit(get().blocks.filter((b) => b.id !== id));
      if (get().selectedId === id) set({ selectedId: null, selection: null });
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

    setLayout: (id, patch) =>
      commit(
        get().blocks.map((b) => {
          if (b.id !== id) return b;
          const layout = { ...b.layout, ...patch };
          // Campo apagado sai do objeto, e objeto vazio some: ausência é o que
          // significa "usa o espaçamento padrão da página", e um zero gravado
          // por engano colaria a seção na de cima.
          for (const key of Object.keys(layout) as (keyof typeof layout)[]) {
            if (layout[key] == null) delete layout[key];
          }
          return Object.keys(layout).length ? { ...b, layout } : { ...b, layout: undefined };
        }),
      ),

    addStep: (blockId) =>
      withSteps(blockId, (steps) => {
        // Id com carimbo de tempo: o id da PERGUNTA é o alvo dos desvios, então
        // reaproveitar "q3" depois de apagar a terceira faria um desvio antigo
        // apontar pra pergunta nova, calado.
        const stamp = Date.now().toString(36);
        return [
          ...steps,
          {
            id: `q-${stamp}`,
            question: 'Nova pergunta',
            options: [
              { id: `o-${stamp}-1`, text: 'Opção 1' },
              { id: `o-${stamp}-2`, text: 'Opção 2' },
            ],
          },
        ];
      }),

    updateStep: (blockId, stepId, patch) =>
      withSteps(blockId, (steps) => steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s))),

    removeStep: (blockId, stepId) => {
      withSteps(blockId, (steps) =>
        steps
          .filter((s) => s.id !== stepId)
          // Desvio que apontava pra pergunta apagada volta pro "próxima": manter
          // o salto quebrado faria o formulário pular pro contato sem motivo.
          .map((s) => ({
            ...s,
            options: s.options.map((o) =>
              o.next?.kind === 'question' && o.next.id === stepId ? { ...o, next: undefined } : o,
            ),
          })),
      );
      const sel = get().selection;
      if (sel?.kind === 'question' && sel.stepId === stepId) {
        set({ selection: { kind: 'block', id: blockId } });
      }
    },

    moveStep: (blockId, stepId, dir) =>
      withSteps(blockId, (steps) => {
        const i = steps.findIndex((s) => s.id === stepId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= steps.length) return steps;
        const next = [...steps];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      }),

    addOption: (blockId, stepId) =>
      withSteps(blockId, (steps) =>
        steps.map((s) =>
          s.id === stepId
            ? { ...s, options: [...s.options, { id: `o-${Date.now().toString(36)}-${s.options.length + 1}`, text: '' }] }
            : s,
        ),
      ),

    updateOption: (blockId, stepId, optionId, patch) =>
      withSteps(blockId, (steps) =>
        steps.map((s) =>
          s.id === stepId
            ? { ...s, options: s.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
            : s,
        ),
      ),

    removeOption: (blockId, stepId, optionId) =>
      withSteps(blockId, (steps) =>
        steps.map((s) =>
          s.id === stepId ? { ...s, options: s.options.filter((o) => o.id !== optionId) } : s,
        ),
      ),

    answerDestination: (optionId) => {
      const routing = get().settings.routing as { by_answer?: Record<string, AnswerDestination> } | undefined;
      return routing?.by_answer?.[optionId] ?? {};
    },

    setAnswerDestination: (optionId, dest) =>
      set((s) => {
        const routing = (s.settings.routing ?? {}) as Record<string, unknown>;
        const byAnswer = { ...((routing.by_answer ?? {}) as Record<string, AnswerDestination>) };
        const clean: AnswerDestination = {};
        if (dest.pipeline_id) clean.pipeline_id = dest.pipeline_id;
        if (dest.stage_id) clean.stage_id = dest.stage_id;
        if (dest.label_id) clean.label_id = dest.label_id;
        // Destino vazio SAI do mapa em vez de virar um objeto vazio: entrada
        // vazia é indistinguível de "escolhi e depois limpei" na hora de ler.
        if (Object.keys(clean).length) byAnswer[optionId] = clean;
        else delete byAnswer[optionId];
        return {
          settings: { ...s.settings, routing: { ...routing, by_answer: byAnswer } },
          dirty: true,
        };
      }),

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
