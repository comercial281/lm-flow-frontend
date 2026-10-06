import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import Horario from './Horario';

function abrir(agent: SalesAgent = agenteDeTeste()) {
  const gravar = gravarDeTeste('horario');
  render(<><Horario agent={agent} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} /><button>fora</button></>);
  return gravar;
}

describe('Horário', () => {
  it('Personalizado grava o modo com a janela, e o aviso aparece fora do 24 horas', async () => {
    const gravar = abrir();
    expect(screen.queryByRole('switch', { name: 'Avisar quem escrever fora do horário' })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Personalizado' }));
    expect(gravar).toHaveBeenCalledWith({
      active_hours: { mode: 'custom', tz: 'America/Sao_Paulo', windows: [{ start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] }] },
    });
  });

  it('dias e horário da janela gravam (dia no clique, hora ao sair)', async () => {
    const gravar = abrir(agenteDeTeste({ active_hours: { mode: 'custom', tz: 'America/Sao_Paulo', windows: [{ start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] }] } }));
    await userEvent.click(screen.getByRole('button', { name: 'Sábado' }));
    expect(gravar).toHaveBeenLastCalledWith({
      active_hours: { mode: 'custom', tz: 'America/Sao_Paulo', windows: [{ start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5, 6] }] },
    });
    // Campo de hora: o jsdom só aceita o valor inteiro (digitar letra a letra passa por valores inválidos).
    const fim = screen.getByLabelText('Até');
    fireEvent.change(fim, { target: { value: '20:00' } });
    fireEvent.blur(fim);
    expect(gravar).toHaveBeenLastCalledWith({
      active_hours: { mode: 'custom', tz: 'America/Sao_Paulo', windows: [{ start: '08:00', end: '20:00', days: [1, 2, 3, 4, 5] }] },
    });
  });

  it('aviso fora do horário: chave no clique, texto ao sair', async () => {
    const gravar = abrir(agenteDeTeste({ active_hours: { mode: 'outside_business', tz: 'America/Sao_Paulo' }, out_of_hours_reply: true }));
    await userEvent.type(screen.getByLabelText('Mensagem fora do horário'), 'Volto às 8h!');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenLastCalledWith({ out_of_hours_message: 'Volto às 8h!' });
    await userEvent.click(screen.getByRole('switch', { name: 'Avisar quem escrever fora do horário' }));
    expect(gravar).toHaveBeenLastCalledWith({ out_of_hours_reply: false });
  });
});
