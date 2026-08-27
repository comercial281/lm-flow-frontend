import { describe, expect, it } from 'vitest';
import {
  parsePageBlocks,
  safeParsePageBlocks,
  withLegacyQualificationMaps,
  BLOCK_TYPES,
  type BlockConfig,
} from './contract';
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

  it('converte o formato antigo do formulário e preserva peso e desqualificação', () => {
    // Landing publicada antes da lógica condicional: opção era string solta e a
    // regra vivia em mapas paralelos, casados pelo TEXTO da alternativa.
    const raw = [
      {
        id: 'f',
        type: 'lead_form',
        config: {
          steps: [{ question: 'Orçamento?', options: ['Acima de 1 milhão', 'Até 100 mil'] }],
          answerWeights: { 'Acima de 1 milhão': 10 },
          disqualifyingAnswers: ['Até 100 mil'],
        },
      },
    ];
    const config = parsePageBlocks(raw)[0].config as BlockConfig<'lead_form'>;

    expect(config.steps[0].options).toHaveLength(2);
    expect(config.steps[0].options[0]).toMatchObject({ text: 'Acima de 1 milhão', weight: 10 });
    expect(config.steps[0].options[1]).toMatchObject({ text: 'Até 100 mil', disqualifies: true });
    // O id derivado é ESTÁVEL: é por ele que o destino gravado se pendura.
    expect(config.steps[0].options[0].id).toBe(parsePageBlocks(raw)[0].config.steps[0].options[0].id);
  });

  it('withLegacyQualificationMaps reescreve os mapas antigos a partir das opções', () => {
    const config = parsePageBlocks([
      {
        id: 'f',
        type: 'lead_form',
        config: {
          steps: [
            {
              id: 'q1',
              question: 'Orçamento?',
              options: [
                { id: 'o1', text: 'Alto', weight: 10 },
                { id: 'o2', text: 'Baixo', disqualifies: true },
              ],
            },
          ],
        },
      },
    ])[0].config as BlockConfig<'lead_form'>;

    const out = withLegacyQualificationMaps(config);
    expect(out.answerWeights).toEqual({ Alto: 10 });
    expect(out.disqualifyingAnswers).toEqual(['Baixo']);
  });

  it('defaultLandingBlocks returns a usable starting arrangement', () => {
    const blocks = defaultLandingBlocks();
    expect(blocks.length).toBeGreaterThan(0);
    // re-parsing the defaults must succeed (round-trip safe)
    expect(() => parsePageBlocks(blocks)).not.toThrow();
  });
});
