import { describe, expect, it } from 'vitest';
import { parsePageBlocks, safeParsePageBlocks, BLOCK_TYPES } from './contract';
import { BLOCK_REGISTRY, createBlock, defaultLandingBlocks } from './registry';

describe('landing blocks contract', () => {
  it('every block type has registry metadata', () => {
    for (const t of BLOCK_TYPES) {
      expect(BLOCK_REGISTRY[t]).toBeDefined();
      expect(BLOCK_REGISTRY[t].label.length).toBeGreaterThan(0);
    }
  });

  it('createBlock applies schema defaults', () => {
    const sim = createBlock('finance_simulator');
    expect(sim.type).toBe('finance_simulator');
    expect(sim.visible).toBe(true);
    expect(sim.id).toMatch(/[0-9a-f-]{36}/);
    // zod defaults
    expect(sim.config).toMatchObject({ entradaPct: 10, prazoMeses: 120 });
  });

  it('parsePageBlocks normalizes a raw array from the API', () => {
    const raw = [
      { id: 'a', type: 'hero', config: { badge: 'PRÉ LANÇAMENTO' } },
      { id: 'b', type: 'price_band', visible: false, config: { text: '10% entrada' } },
    ];
    const blocks = parsePageBlocks(raw);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].visible).toBe(true); // default applied
    expect(blocks[0].config).toMatchObject({ source: 'property', badge: 'PRÉ LANÇAMENTO' });
    expect(blocks[1].visible).toBe(false);
  });

  it('safeParsePageBlocks drops invalid blocks instead of throwing', () => {
    const raw = [
      { id: 'a', type: 'hero', config: {} },
      { id: 'b', type: 'not_a_real_block', config: {} },
    ];
    const blocks = safeParsePageBlocks(raw);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('hero');
  });

  it('defaultLandingBlocks returns a usable starting arrangement', () => {
    const blocks = defaultLandingBlocks();
    expect(blocks.length).toBeGreaterThan(0);
    // re-parsing the defaults must succeed (round-trip safe)
    expect(() => parsePageBlocks(blocks)).not.toThrow();
  });
});
