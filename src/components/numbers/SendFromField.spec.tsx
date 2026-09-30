import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// O campo "Enviar pelo número" (fase 2b.2). Cada tela tem o seu padrão (E37),
// e o campo diz quando a lista não veio ou o número escolhido sumiu, em vez de
// trocar a escolha calado.
const sendNumbers = vi.hoisted(() => vi.fn());
vi.mock('@/services/numbers/numbersService', () => ({ default: { sendNumbers } }));

import SendFromField from './SendFromField';
import type { SendFromValue } from '@/features/numbers/sendFrom';

const padrao: SendFromValue = { send_from: '', send_from_inbox_id: '' };
const loja = { inbox_id: 'i1', name: 'Loja', phone: '+5511912341234', connection: 'connected' as const, owner: null };
const daAna = {
  inbox_id: 'i2', name: 'Da Ana', phone: null, connection: 'disconnected' as const, owner: { id: 'u1', name: 'Ana' },
};

// Bloco (não seta), de propósito: `mockReset()` devolve o próprio mock (uma
// função), e um beforeEach que devolvesse essa função seria lido pelo Vitest
// como o teardown do teste — rodando `sendNumbers()` de novo depois de cada
// teste, sem quem trate a promessa. Com `mockRejectedValue` isso vira rejeição
// sem dono, atribuída ao teste seguinte. `{}` corta o retorno.
beforeEach(() => {
  sendNumbers.mockReset();
});

describe('SendFromField', () => {
  it('automação: automático, o número do responsável e cada número, com o dono quando a regra vale', async () => {
    sendNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [loja, daAna] });

    render(<SendFromField scope="lead_automation_rules" value={padrao} onChange={() => {}} />);

    expect(await screen.findByRole('option', { name: 'Loja · (11) 91234-1234' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Da Ana · desconectado · de Ana' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Automático (como sempre foi)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'O número do responsável pelo lead' })).toBeInTheDocument();
    expect(screen.getByText('Enviar pelo número')).toBeInTheDocument();
    expect(sendNumbers).toHaveBeenCalledWith('lead_automation_rules');
  });

  it('funil: o padrão é o número do responsável, sem opção repetida', async () => {
    sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [loja] });

    render(<SendFromField scope="followup_sequences" value={{ send_from: 'owner', send_from_inbox_id: '' }} onChange={() => {}} />);

    expect(await screen.findByRole('option', { name: 'O número do responsável pelo lead (padrão)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'O número do responsável pelo lead' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Automático (como sempre foi)' })).not.toBeInTheDocument();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('');
    expect(screen.getByText(/sai como antes: pelo número da conversa do lead/)).toBeInTheDocument();
  });

  it('sem a regra do dono, o dono não aparece', async () => {
    sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [daAna] });

    render(<SendFromField scope="followup_sequences" value={padrao} onChange={() => {}} />);

    expect(await screen.findByRole('option', { name: 'Da Ana · desconectado' })).toBeInTheDocument();
  });

  it('escolher um número devolve o modo e o número', async () => {
    sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [loja] });
    const onChange = vi.fn();

    render(<SendFromField scope="followup_sequences" value={padrao} onChange={onChange} />);
    await screen.findByRole('option', { name: 'Loja · (11) 91234-1234' });
    await userEvent.selectOptions(screen.getByRole('combobox'), 'number:i1');

    expect(onChange).toHaveBeenCalledWith({ send_from: 'number', send_from_inbox_id: 'i1' });
  });

  // Review Focus 2.
  it('número escolhido que sumiu aparece como tal, ainda selecionado', async () => {
    sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [loja] });

    render(
      <SendFromField
        scope="lead_automation_rules"
        value={{ send_from: 'number', send_from_inbox_id: 'apagado' }}
        onChange={() => {}}
      />,
    );

    expect(await screen.findByRole('option', { name: 'Número que não existe mais — escolha outro' })).toBeInTheDocument();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('number:apagado');
  });

  it('lista que não carregou: diz, e mantém a escolha que já estava', async () => {
    sendNumbers.mockRejectedValue(new Error('500'));

    render(
      <SendFromField
        scope="lead_automation_rules"
        value={{ send_from: 'number', send_from_inbox_id: 'i9' }}
        onChange={() => {}}
      />,
    );

    expect(await screen.findByText('Não consegui carregar os números agora. Salvar mantém a escolha que já estava.')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'O número escolhido antes (a lista não carregou)' })).toBeInTheDocument();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('number:i9');
  });

  it('a explicação acompanha a escolha', async () => {
    sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [] });

    render(<SendFromField scope="lead_automation_rules" value={{ send_from: 'owner', send_from_inbox_id: '' }} onChange={() => {}} />);

    expect(await screen.findByText(/Sai pelo número do responsável pelo lead/)).toBeInTheDocument();
  });

  it('fala número, nunca instância, inbox ou caixa de entrada', async () => {
    sendNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [loja, daAna] });

    const { container } = render(<SendFromField scope="lead_automation_rules" value={padrao} onChange={() => {}} />);
    await screen.findByRole('option', { name: 'Loja · (11) 91234-1234' });

    expect(container.textContent).not.toMatch(/instância|inbox|caixa de entrada/i);
  });
});
