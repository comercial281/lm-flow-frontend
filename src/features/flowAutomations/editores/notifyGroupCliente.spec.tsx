import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { ActionEditor, formatActionSummary } from '@/features/flowAutomations/editores/LeadAutomationsEditors';

const svc = vi.hoisted(() => ({ getGroupsResult: vi.fn() }));
vi.mock('@/services/leadAutomation/leadAutomationService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/leadAutomation/leadAutomationService')>();
  return { ...real, leadAutomationService: { ...real.leadAutomationService, ...svc } };
});
const numeros = vi.hoisted(() => ({ sendNumbers: vi.fn() }));
vi.mock('@/services/numbers/numbersService', () => ({ default: numeros }));
const equipe = vi.hoisted(() => ({ valor: false }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => equipe.valor }));

const resources = {
  labels: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [], roletas: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false, erros: {}, erro: false, recarregar: () => {},
} as never;

function acao(params: Record<string, string>) {
  return { type: 'notify_group', params } as never;
}

describe('Avisar no grupo, na tela do cliente', () => {
  beforeEach(() => {
    equipe.valor = false;
    numeros.sendNumbers.mockReset();
    numeros.sendNumbers.mockRejectedValue(new Error('rede'));
  });

  const numero = (phone: string, connection = 'connected') => ({ inbox_id: phone, name: 'n', phone, connection, owner: null });

  it('com 1 número conectado, a opção mostra o final dele', async () => {
    svc.getGroupsResult.mockResolvedValue({ groups: [], reason: null, instance: null });
    numeros.sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [numero('+55 (11) 91234-1292'), numero('+55 (11) 90000-0001', 'disconnected')] });
    render(<ActionEditor action={acao({})} onChange={() => {}} resources={resources} />);
    expect(await screen.findByRole('option', { name: 'WhatsApp deste CRM (final 92)' })).toBeInTheDocument();
  });

  it('com mais de 1 conectado, diz que é o número da conversa do lead', async () => {
    svc.getGroupsResult.mockResolvedValue({ groups: [], reason: null, instance: null });
    numeros.sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [numero('+55 (11) 91234-1292'), numero('+55 (11) 90000-0001')] });
    render(<ActionEditor action={acao({})} onChange={() => {}} resources={resources} />);
    expect(await screen.findByRole('option', { name: 'WhatsApp deste CRM (o número da conversa do lead)' })).toBeInTheDocument();
  });

  it('nenhum texto da janela do cliente fala de lembrete, LM01 ou emoji', async () => {
    svc.getGroupsResult.mockResolvedValue({ groups: [], reason: null, instance: null });
    const { container } = render(<ActionEditor action={acao({})} onChange={() => {}} resources={resources} />);
    await waitFor(() => expect(screen.getByText('Quem recebe *')).toBeInTheDocument());
    expect(container.textContent).not.toMatch(/lembrete|LM01|✓|⚠️/i);
  });

  it('troca o campo livre por duas opções e não fala da central pelo nome', async () => {
    svc.getGroupsResult.mockResolvedValue({ groups: [], reason: null, instance: null });
    render(<ActionEditor action={acao({})} onChange={() => {}} resources={resources} />);

    expect(screen.getByRole('option', { name: 'WhatsApp deste CRM' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Central da Leal Mídia' })).toBeInTheDocument();
    expect(screen.queryByText(/Operacional \(LM01\)/)).toBeNull();
  });

  it('destino gravado fora da lista aparece travado, sem o nome real', async () => {
    svc.getGroupsResult.mockResolvedValue({ groups: [{ id: '9@g.us', name: 'ALI x Leal Mídia' }], reason: null, instance: 'Operacional (LM01)' });
    render(<ActionEditor action={acao({ instance: 'Operacional (LM01)', group_jid: '8@g.us' })} onChange={() => {}} resources={resources} />);

    await waitFor(() => expect(screen.getByRole('option', { name: 'Grupo definido pela Leal Mídia' })).toBeInTheDocument());
    expect(screen.queryByText('8@g.us')).toBeNull();
    expect(screen.getByText(/definido pela Leal Mídia\. Pra trocar/)).toBeInTheDocument();
  });

  it('pelo número próprio, grupo salvo fora da lista não trava nem fala da Leal', async () => {
    svc.getGroupsResult.mockResolvedValue({ groups: [{ id: '9@g.us', name: 'Outro grupo' }], reason: null, instance: null });
    render(<ActionEditor action={acao({ instance: '', group_jid: '7@g.us' })} onChange={() => {}} resources={resources} />);

    await waitFor(() => expect(screen.getByRole('option', { name: 'Grupo já escolhido (não apareceu na lista)' })).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'Grupo definido pela Leal Mídia' })).toBeNull();
    expect(screen.queryByText(/definido pela Leal Mídia\. Pra trocar/)).toBeNull();
    screen.getAllByRole('combobox').forEach(c => expect(c).not.toBeDisabled());
  });

  it('número próprio escolhido pela equipe aparece como WhatsApp deste CRM', async () => {
    svc.getGroupsResult.mockResolvedValue({ groups: [], reason: null, instance: 'lmf_apto_01' });
    render(<ActionEditor action={acao({ instance: 'lmf_apto_01', group_jid: '7@g.us' })} onChange={() => {}} resources={resources} />);

    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe('proprio');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Grupo já escolhido (não apareceu na lista)' })).toBeInTheDocument());
  });

  it('central sem grupo liberado mostra o motivo do servidor', async () => {
    svc.getGroupsResult.mockResolvedValue({ groups: [], reason: 'Nenhum grupo liberado pra este CRM. Fale com a Leal Mídia.', instance: 'Operacional (LM01)' });
    render(<ActionEditor action={acao({ instance: 'Operacional (LM01)' })} onChange={() => {}} resources={resources} />);

    await waitFor(() => expect(screen.getByText('Nenhum grupo liberado pra este CRM. Fale com a Leal Mídia.')).toBeInTheDocument());
  });

  it('trocar o número zera o destino na mesma gravação e não trava nada', async () => {
    svc.getGroupsResult.mockResolvedValue({ groups: [{ id: '1@g.us', name: 'Meu grupo' }], reason: null, instance: null });
    const onChange = vi.fn();
    render(<ActionEditor action={acao({ group_jid: '1@g.us' })} onChange={onChange} resources={resources} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Meu grupo' })).toBeInTheDocument());

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'central' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].params).toMatchObject({ instance: 'Operacional (LM01)', group_jid: '' });
    expect(screen.queryByRole('option', { name: 'Grupo definido pela Leal Mídia' })).toBeNull();
  });

  it('erro ao carregar os grupos não trava o destino salvo', async () => {
    svc.getGroupsResult.mockRejectedValue(new Error('rede'));
    render(<ActionEditor action={acao({ group_jid: '8@g.us' })} onChange={() => {}} resources={resources} />);

    await waitFor(() => expect(screen.getByText(/Não foi possível carregar os grupos/)).toBeInTheDocument());
    expect(screen.queryByText(/definido pela Leal Mídia\. Pra trocar/)).toBeNull();
    screen.getAllByRole('combobox').forEach(c => expect(c).not.toBeDisabled());
  });

  it('equipe sem lista de números mantém o campo livre', async () => {
    equipe.valor = true;
    svc.getGroupsResult.mockResolvedValue({ groups: [], reason: null, instance: null });
    render(<ActionEditor action={acao({ instance: 'Outra' })} onChange={() => {}} resources={resources} />);

    expect(screen.getByPlaceholderText('Operacional (LM01)')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Central da Leal Mídia' })).toBeNull();
  });

  it('o resumo da ação não mostra o JID do grupo', () => {
    expect(formatActionSummary(acao({ group_jid: '8@g.us' }), resources)).toBe('Grupo escolhido');
    expect(formatActionSummary(acao({}), resources)).toBe('(sem grupo)');
  });
});
