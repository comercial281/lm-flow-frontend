import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/services/salesAgents/salesAgentsService', () => ({
  salesAgentsService: {
    playbook: vi.fn().mockResolvedValue({
      intent_question_mode: 'always', intent_question_modes: ['always', 'opening_only', 'never'], vars: {},
      slot_defaults: { tipo_venda: '', perguntas_situacao: '', dor_tipica: '', lead_pronto: '', proximo_passo: '', objecoes: [] },
      var_labels: { dor_tipica: 'O que dói no cliente' }, var_hints: {}, sale_types: [], next_steps: [{ value: 'visita', label: 'Visita' }], blocks: [],
    }),
  },
}));
import PlaybookSection from './PlaybookSection';

describe('PlaybookSection (Motor, onda 3)', () => {
  it('não mostra o que foi pras páginas e não apaga os caminhos da intenção ao gravar', async () => {
    const onSave = vi.fn();
    const caminhos = [{ nome: 'Morar', como: 'x' }];
    render(<PlaybookSection agentId="ia-1" playbook={{ vars: { caminhos_intencao: caminhos, tipo_venda: 'usado', lead_pronto: 'y' } }} onSave={onSave} />);
    const dor = await screen.findByLabelText('O que dói no cliente');
    expect(screen.queryByText(/Perguntar se é moradia ou investimento/)).toBeNull();
    expect(screen.queryByLabelText(/perguntas_situacao|lead_pronto|tipo_venda/)).toBeNull();
    await userEvent.type(dor, 'aluguel caro');
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith({ playbook: { vars: { caminhos_intencao: caminhos, tipo_venda: 'usado', lead_pronto: 'y', dor_tipica: 'aluguel caro' } } });
  });
});
