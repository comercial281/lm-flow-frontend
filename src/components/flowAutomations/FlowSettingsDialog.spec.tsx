import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlowSettingsDialog } from './FlowSettingsDialog';

const base = { reentry: { mode: 'hours' as const, hours: 24 }, businessHoursOnly: false };

describe('FlowSettingsDialog', () => {
  it('tem os grupos Pode rodar de novo e Horário (miolo da janela)', () => {
    render(<FlowSettingsDialog open settings={base} triggerEvent="lead.created" onClose={vi.fn()} onSave={vi.fn()} />);
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByRole('group', { name: 'Pode rodar de novo pro mesmo lead' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('group', { name: 'Horário' })).toBeInTheDocument();
  });

  it('grava o mesmo formato: escolha, horas e horário comercial', async () => {
    const aoSalvar = vi.fn();
    render(<FlowSettingsDialog open settings={base} triggerEvent="lead.created" onClose={vi.fn()} onSave={aoSalvar} />);
    const horas = screen.getByLabelText('Quantas horas');
    fireEvent.change(horas, { target: { value: '48' } });
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(aoSalvar).toHaveBeenCalledWith({ reentry: { mode: 'hours', hours: 48 }, businessHoursOnly: true });
  });

  it('"Sempre" com mensagem recebida mostra o aviso e esconde as horas', async () => {
    render(<FlowSettingsDialog open settings={base} triggerEvent="lead.message_received" onClose={vi.fn()} onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Sempre que o gatilho acontecer' }));
    expect(screen.getByRole('status')).toHaveTextContent('roda a cada mensagem do lead');
    expect(screen.queryByLabelText('Quantas horas')).not.toBeInTheDocument();
  });
});
