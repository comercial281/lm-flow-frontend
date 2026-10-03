import { describe, it, expect } from 'vitest';
import { FLOW_NODE_DEFS } from '@/types/flowAutomations';
import { isVisibleKind, paletteGroups, HIDDEN_BLOCK_NOTICE } from './palette';
import { summaryLine } from '@/components/flowAutomations/FlowNodeCard';

describe('paleta enxuta', () => {
  it('só os 8 blocos da spec, nos três grupos', () => {
    const groups = paletteGroups();
    expect(groups.map(g => [g.label, g.defs.map(d => d.label)])).toEqual([
      ['Mensagem', ['Mandar WhatsApp']],
      ['Controle', ['Esperar', 'Aguardar resposta', 'Se / senão', 'Só continuar se']],
      ['Lead', ['Aplicar etiqueta', 'Tirar etiqueta', 'Mover de etapa']],
    ]);
  });

  it('os outros 15 ficam fora da paleta', () => {
    const fora = FLOW_NODE_DEFS.filter(d => !isVisibleKind(d.kind));
    expect(fora).toHaveLength(15);
    const naPaleta = paletteGroups().flatMap(g => g.defs.map(d => d.kind));
    fora.forEach(d => expect(naPaleta).not.toContain(d.kind));
  });

  it('a busca ignora acento e maiúscula', () => {
    expect(paletteGroups('AGUARDAR').flatMap(g => g.defs.map(d => d.kind))).toEqual(['wait_for_reply']);
    expect(paletteGroups('so continuar').flatMap(g => g.defs.map(d => d.kind))).toEqual(['filter_label']);
    expect(paletteGroups('nada disso')).toEqual([]);
  });

  it('bloco escondido de fluxo antigo aparece com o aviso, sem quebrar', () => {
    const antigo = {
      id: 'x', kind: 'http_call' as const, label: null, config: { url: 'https://exemplo' },
      next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
    };
    expect(summaryLine(antigo)).toBe(HIDDEN_BLOCK_NOTICE);
    expect(HIDDEN_BLOCK_NOTICE).toBe('Este bloco volta na próxima versão');
  });

  it('o sino não fala do Hub', () => {
    expect(FLOW_NODE_DEFS.find(d => d.kind === 'notify_bell')?.label).not.toMatch(/hub/i);
  });
});
