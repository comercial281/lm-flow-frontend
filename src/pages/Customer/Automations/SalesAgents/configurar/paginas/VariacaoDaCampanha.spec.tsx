import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import VariacaoDaCampanha from './VariacaoDaCampanha';

const agente = () => agenteDeTeste({ openings: [{ label: 'Black', origins: ['meta'], form_ids: ['1'], keywords: [] }] } as never);

describe('Variação da campanha (miolo da janela)', () => {
  it('tem os quatro grupos e cada rótulo aparece uma vez', () => {
    render(<VariacaoDaCampanha agent={agente()} indice={0} gravar={gravarDeTeste('openings')} aoFechar={vi.fn()} />);
    const dialogo = screen.getByRole('dialog');
    ['Identificação', 'Quando vale', 'O que ela diz', 'Mídia'].forEach((g) =>
      expect(within(dialogo).getByRole('group', { name: g })).toBeInTheDocument());
    expect(screen.getAllByLabelText('Nome da variação')).toHaveLength(1);
    expect(screen.getAllByLabelText('Origens')).toHaveLength(1);
  });

  it('o campo continua gravando ao sair', async () => {
    const gravar = gravarDeTeste('openings');
    render(<VariacaoDaCampanha agent={agente()} indice={0} gravar={gravar} aoFechar={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Palavras na primeira mensagem do lead'), 'oferta, black');
    expect(gravar).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(gravar).toHaveBeenCalledWith({ openings: [expect.objectContaining({ keywords: ['oferta', 'black'] })] });
  });
});
