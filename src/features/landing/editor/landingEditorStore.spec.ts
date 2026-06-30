import { beforeEach, describe, expect, it } from 'vitest';
import { useLandingEditorStore } from './landingEditorStore';

const s = () => useLandingEditorStore.getState();

describe('landingEditorStore', () => {
  beforeEach(() => s().load([]));

  it('adds a block, selects it and marks dirty', () => {
    s().addBlock('hero');
    expect(s().blocks).toHaveLength(1);
    expect(s().blocks[0].type).toBe('hero');
    expect(s().selectedId).toBe(s().blocks[0].id);
    expect(s().dirty).toBe(true);
  });

  it('toggles visibility', () => {
    s().addBlock('price_band');
    const id = s().blocks[0].id;
    expect(s().blocks[0].visible).toBe(true);
    s().toggleVisible(id);
    expect(s().blocks[0].visible).toBe(false);
  });

  it('updates a block config', () => {
    s().addBlock('price_band');
    const id = s().blocks[0].id;
    s().updateConfig(id, { text: '10% entrada + saldo em 100x' });
    expect(s().blocks[0].config).toMatchObject({ text: '10% entrada + saldo em 100x' });
  });

  it('removes a block and clears selection', () => {
    s().addBlock('hero');
    const id = s().blocks[0].id;
    s().removeBlock(id);
    expect(s().blocks).toHaveLength(0);
    expect(s().selectedId).toBeNull();
  });

  it('reorders blocks', () => {
    s().addBlock('hero');
    s().addBlock('price_band');
    const [a, b] = s().blocks;
    s().reorder([b, a]);
    expect(s().blocks[0].id).toBe(b.id);
    expect(s().blocks[1].id).toBe(a.id);
  });

  it('undo and redo walk the history', () => {
    s().addBlock('hero');
    s().addBlock('price_band');
    expect(s().blocks).toHaveLength(2);
    s().undo();
    expect(s().blocks).toHaveLength(1);
    expect(s().canRedo()).toBe(true);
    s().redo();
    expect(s().blocks).toHaveLength(2);
  });

  it('load resets history and dirty', () => {
    s().addBlock('hero');
    s().load([]);
    expect(s().blocks).toHaveLength(0);
    expect(s().dirty).toBe(false);
    expect(s().canUndo()).toBe(false);
  });

  it('a new mutation clears the redo stack', () => {
    s().addBlock('hero');
    s().addBlock('price_band');
    s().undo();
    expect(s().canRedo()).toBe(true);
    s().addBlock('tech_sheet');
    expect(s().canRedo()).toBe(false);
  });
});
