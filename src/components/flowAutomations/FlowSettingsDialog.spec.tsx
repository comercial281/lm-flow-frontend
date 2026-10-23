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

  it('o campo de horas aparece ao escolher "Depois de um tempo" partindo de outro modo', async () => {
    const aoSalvar = vi.fn();
    render(<FlowSettingsDialog open settings={{ reentry: { mode: 'always', hours: 24 }, businessHoursOnly: false }}
      triggerEvent="lead.created" onClose={vi.fn()} onSave={aoSalvar} />);
    expect(screen.queryByLabelText('Quantas horas')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Depois de um tempo' }));
    expect(screen.getByLabelText('Quantas horas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(aoSalvar).toHaveBeenCalledWith({ reentry: { mode: 'hours', hours: 24 }, businessHoursOnly: false });
  });

  it('"Sempre" com mensagem recebida mostra o aviso e esconde as horas', async () => {
    render(<FlowSettingsDialog open settings={base} triggerEvent="lead.message_received" onClose={vi.fn()} onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Sempre que o gatilho acontecer' }));
    expect(screen.getByRole('status')).toHaveTextContent('roda a cada mensagem do lead');
    expect(screen.queryByLabelText('Quantas horas')).not.toBeInTheDocument();
  });
});

// Entrega 4: o fluxo da equipe fala com o lead por UM número, escolhido aqui.
describe('FlowSettingsDialog: número do fluxo', () => {
  const numbers = [
    { inbox_id: 'i1', name: 'Loja', phone: '5511912341292', connection: 'connected' as const, owner: null },
    { inbox_id: 'i2', name: 'Plantão', phone: '5511900000017', connection: 'connected' as const, owner: null },
  ];
  const comNumero = (number: Record<string, unknown> = {}) => ({
    ...base,
    number: { mode: '' as const, inboxId: '', onConflict: 'follow_conversation' as const, ...number },
  });
  const CONFLITO = 'Se o lead já conversa com a equipe em outro número';

  it('mostra o grupo do conflito só com responsável ou número específico', async () => {
    render(<FlowSettingsDialog open settings={comNumero()} numbers={numbers} triggerEvent="lead.created" onClose={vi.fn()} onSave={vi.fn()} />);
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByRole('group', { name: 'Por qual número este fluxo fala com o lead' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Pelo número da conversa do lead' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('group', { name: CONFLITO })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Pelo número do responsável pelo lead' }));
    expect(screen.getByRole('group', { name: CONFLITO })).toBeInTheDocument();
    expect(screen.queryByLabelText('Número do fluxo')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Por um número específico' }));
    expect(screen.getByRole('group', { name: CONFLITO })).toBeInTheDocument();
    expect(screen.getByLabelText('Número do fluxo')).toBeInTheDocument();
    for (const rotulo of ['Pausar e esperar alguém escolher', 'Seguir pela conversa dele', 'Mandar pelo número do fluxo mesmo assim']) {
      expect(screen.getByRole('radio', { name: rotulo })).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole('radio', { name: 'Pelo número da conversa do lead' }));
    expect(screen.queryByRole('group', { name: CONFLITO })).not.toBeInTheDocument();
  });

  it('escolher número e conflito devolve a regra no Salvar', async () => {
    const aoSalvar = vi.fn();
    render(<FlowSettingsDialog open settings={comNumero()} numbers={numbers} triggerEvent="lead.created" onClose={vi.fn()} onSave={aoSalvar} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Por um número específico' }));
    // Sem número escolhido não salva.
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Número do fluxo'), { target: { value: 'i1' } });
    await userEvent.click(screen.getByRole('radio', { name: 'Pausar e esperar alguém escolher' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(aoSalvar).toHaveBeenCalledWith({
      ...base,
      number: { mode: 'number', inboxId: 'i1', onConflict: 'pause' },
    });
  });

  it('salvar sem mexer no número não devolve a regra', async () => {
    const aoSalvar = vi.fn();
    render(<FlowSettingsDialog open settings={comNumero({ mode: 'owner' })} numbers={numbers} triggerEvent="lead.created" onClose={vi.fn()} onSave={aoSalvar} />);
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const [next] = aoSalvar.mock.calls[0];
    expect(next).toEqual({ ...base, businessHoursOnly: true });
    expect('number' in next).toBe(false);
  });

  it('fluxo com números diferentes avisa, não marca nenhum e salvar sem mexer não muda nada', async () => {
    const aoSalvar = vi.fn();
    render(<FlowSettingsDialog open settings={comNumero()} numberDivergent numbers={numbers} triggerEvent="lead.created" onClose={vi.fn()} onSave={aoSalvar} />);
    expect(screen.getByText('Este fluxo fala por números diferentes. Escolha um nas Configurações.')).toBeInTheDocument();
    for (const rotulo of ['Pelo número da conversa do lead', 'Pelo número do responsável pelo lead', 'Por um número específico']) {
      expect(screen.getByRole('radio', { name: rotulo }).getAttribute('aria-checked')).toBe('false');
    }
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect('number' in aoSalvar.mock.calls[0][0]).toBe(false);
  });

  it('fluxo com números diferentes: escolher a conversa do lead vale como escolha', async () => {
    const aoSalvar = vi.fn();
    render(<FlowSettingsDialog open settings={comNumero()} numberDivergent numbers={numbers} triggerEvent="lead.created" onClose={vi.fn()} onSave={aoSalvar} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Pelo número da conversa do lead' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(aoSalvar).toHaveBeenCalledWith({ ...base, number: { mode: '', inboxId: '', onConflict: 'follow_conversation' } });
  });

  it('a descrição da janela fala do número quando o grupo aparece', () => {
    render(<FlowSettingsDialog open settings={comNumero()} numbers={numbers} triggerEvent="lead.created" onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText('Por qual número o fluxo fala, quando o mesmo lead pode passar por ele outra vez e em que horário as mensagens saem.')).toBeInTheDocument();
  });

  it('lista que não carregou avisa embaixo do seletor', async () => {
    render(<FlowSettingsDialog open settings={comNumero({ mode: 'number', inboxId: 'i9' })} numbers={[]} numbersState="failed"
      triggerEvent="lead.created" onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText('Não consegui carregar os números agora. Salvar mantém a escolha que já estava.')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'O número escolhido antes (a lista não carregou)' })).toBeInTheDocument();
  });

  it('sem regra de número (pessoal, follow-up) não mostra o grupo', () => {
    render(<FlowSettingsDialog open settings={base} triggerEvent="lead.created" onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText('Quando o mesmo lead pode passar por este fluxo outra vez, e em que horário as mensagens saem.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Por qual número este fluxo fala com o lead' })).not.toBeInTheDocument();
  });
});
