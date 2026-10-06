import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import Restricoes from './Restricoes';

describe('Restrições', () => {
  it('etiqueta liga/desliga a subchave; própria sai com Tirar e entra com Adicionar', async () => {
    const gravar = gravarDeTeste('restricoes');
    render(<Restricoes agent={agenteDeTeste({ ai_limits: { address: true, custom: ['Permuta'] } })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Desconto' }));
    expect(gravar).toHaveBeenLastCalledWith({ ai_limits: { address: true, discount: true, price: false, iptu: false, custom: ['Permuta'] } },
      ['ai_limits.address', 'ai_limits.discount', 'ai_limits.price', 'ai_limits.iptu']);
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Permuta' }));
    expect(gravar).toHaveBeenLastCalledWith({ ai_limits: { address: true, custom: [] } }, ['ai_limits.custom']);
    await userEvent.type(screen.getByLabelText('Nova restrição'), 'Financiamento direto{Enter}');
    expect(gravar).toHaveBeenLastCalledWith({ ai_limits: { address: true, custom: ['Permuta', 'Financiamento direto'] } }, ['ai_limits.custom']);
  });
});
