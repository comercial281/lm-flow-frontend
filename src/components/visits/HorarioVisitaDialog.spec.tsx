import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: (m: string) => toastSuccess(m) } }));

const getSettings = vi.fn();
const updateSettings = vi.fn();
vi.mock('@/services/visits/agendaService', () => ({
  agendaService: {
    getSettings: (...a: unknown[]) => getSettings(...a),
    updateSettings: (...a: unknown[]) => updateSettings(...a),
  },
}));

import { HorarioVisitaDialog } from './HorarioVisitaDialog';

const HORARIO = {
  enabled: true,
  days: [1, 2, 3, 4, 5, 6],
  start: '08:00',
  end: '20:00',
  closed_dates: ['2026-12-25'],
  seeded_from: { agent_id: 'a1', agent_name: 'Sofia', differing_agent_names: ['Lia'] },
};

const abrir = (onOpenChange = vi.fn()) => render(<HorarioVisitaDialog open onOpenChange={onOpenChange} />);

beforeEach(() => {
  vi.clearAllMocks();
  getSettings.mockResolvedValue(HORARIO);
});

describe('Horário de visita', () => {
  it('mostra o horário atual, o aviso da IA usada e o efeito', async () => {
    abrir();
    expect(await screen.findByRole('button', { name: 'Seg' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Dom' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Início')).toHaveValue('08:00');
    expect(screen.getByLabelText('Fim')).toHaveValue('20:00');
    expect(screen.getByText('25/12/2026')).toBeInTheDocument();
    expect(screen.getByText('As IAs Sofia e Lia tinham horários diferentes; usamos o de Sofia')).toBeInTheDocument();
    expect(screen.getByText('Vale para a IA e para quem marca à mão. Fora disso, nenhuma visita é marcada.')).toBeInTheDocument();
  });

  it('as horas são uma lista de 30 em 30, sem o campo de hora do navegador', async () => {
    abrir();
    const inicio = await screen.findByLabelText('Início');
    expect(inicio.tagName).toBe('SELECT');
    expect(document.querySelector('input[type="time"]')).toBeNull();
    const opcoes = Array.from((inicio as HTMLSelectElement).options).map(o => o.value);
    expect(opcoes).toContain('08:30');
    expect(opcoes).not.toContain('08:15');
  });

  it('Salvar envia dias, faixa e datas fechadas', async () => {
    updateSettings.mockResolvedValue(HORARIO);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    abrir(onOpenChange);

    await user.click(await screen.findByRole('button', { name: 'Dom' }));
    await user.click(screen.getByRole('button', { name: 'Sáb' }));
    await user.selectOptions(screen.getByLabelText('Início'), '09:30');
    await user.selectOptions(screen.getByLabelText('Fim'), '18:00');
    fireEvent.change(screen.getByLabelText('Data fechada'), { target: { value: '2026-10-12' } });
    await user.click(screen.getByRole('button', { name: 'Adicionar data' }));
    await user.click(screen.getByRole('button', { name: 'Remover 25/12/2026' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    expect(updateSettings).toHaveBeenCalledWith({
      days: [0, 1, 2, 3, 4, 5],
      start: '09:30',
      end: '18:00',
      closed_dates: ['2026-10-12'],
    });
    expect(toastSuccess).toHaveBeenCalledWith('Horário de visita salvo');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('erro 422 do servidor aparece na janela, e ela continua aberta', async () => {
    updateSettings.mockRejectedValue({
      response: { status: 422, data: { success: false, error: { code: 'invalid', message: 'Escolha pelo menos um dia' } } },
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    abrir(onOpenChange);

    await user.click(await screen.findByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Escolha pelo menos um dia');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('confere antes de mandar: fim antes do início não sai', async () => {
    const user = userEvent.setup();
    abrir();
    await user.selectOptions(await screen.findByLabelText('Fim'), '07:00');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('O fim precisa ser depois do início');
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('não carregou: diz e oferece tentar de novo (erro nunca vira formulário vazio)', async () => {
    getSettings.mockRejectedValueOnce(new Error('rede'));
    const user = userEvent.setup();
    abrir();
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByLabelText('Início')).toHaveValue('08:00');
    expect(getSettings).toHaveBeenCalledTimes(2);
  });
});
