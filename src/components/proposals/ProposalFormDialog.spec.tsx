// Proposta registrada pelo card do lead (E4): vai ligada ao card, para a
// proposta aceita marcar ESTE card como Ganho (Parte 2, Proposals::MarkCardWon).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProposalFormDialog from './ProposalFormDialog';

const s = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), cards: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/proposals/proposalsService', () => ({ proposalsService: { create: s.create, update: s.update } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getOpenCardsOfContact: s.cards },
}));
vi.mock('@/services/properties/propertiesService', () => ({
  propertiesService: { list: vi.fn().mockResolvedValue({ data: [] }) },
}));
vi.mock('@/components/visits/LeadCombobox', () => ({
  LeadCombobox: (p: { onChange: (l: unknown) => void }) => (
    <button type="button" onClick={() => p.onChange({ id: 'c2', name: 'Bia Teste', in_pipeline: true })}>trocar lead</button>
  ),
}));

const lead = { id: 'c1', name: 'Ana Teste', in_pipeline: true };
const imovel = { id: 'im1', title: 'Apto Lapa', code: 'AP0001' };

function abrir(props: Partial<Parameters<typeof ProposalFormDialog>[0]> = {}) {
  render(
    <ProposalFormDialog open onOpenChange={vi.fn()} leadInicial={lead} imovelInicial={imovel} onSaved={vi.fn()} {...props} />,
  );
}

beforeEach(() => {
  s.create.mockReset().mockResolvedValue({ id: 'pr1' });
  s.update.mockReset().mockResolvedValue({ id: 'pr1' });
  s.cards.mockReset().mockResolvedValue([]);
});

describe('ProposalFormDialog · proposta ligada ao card', () => {
  it('registrada pelo card: manda o id do card em metadata.pipeline_item_id', async () => {
    abrir({ pipelineItemId: 'i1' });
    await userEvent.type(screen.getAllByPlaceholderText('0,00')[0], '500000');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Rascunho' }));

    await waitFor(() => expect(s.create).toHaveBeenCalledTimes(1));
    expect(s.create.mock.calls[0][0]).toMatchObject({
      contact_id: 'c1',
      property_id: 'im1',
      offered_value: 500000,
      metadata: { pipeline_item_id: 'i1' },
    });
  });

  it('fora do card, lead sem card aberto: sem metadata', async () => {
    abrir();
    await userEvent.type(screen.getAllByPlaceholderText('0,00')[0], '500000');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Rascunho' }));

    await waitFor(() => expect(s.create).toHaveBeenCalledTimes(1));
    expect(s.create.mock.calls[0][0]).not.toHaveProperty('metadata');
  });

  it('editar uma proposta não mexe na ligação com o card', async () => {
    const proposta = {
      id: 'pr1', property_id: 'im1', contact_id: 'c1', proposal_type: 'purchase', offered_value: 400000,
      property: imovel, contact: { id: 'c1', name: 'Ana Teste' },
    } as never;
    abrir({ proposta, pipelineItemId: 'i1' });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(s.update).toHaveBeenCalledTimes(1));
    expect(s.update.mock.calls[0][1]).not.toHaveProperty('metadata');
  });
});

// Ajuste de 08/10: pela tela Propostas, a proposta também fica ligada a um card.
describe('ProposalFormDialog · tela Propostas pergunta o atendimento', () => {
  const card = (id: string, funil: string, etapa: string) =>
    ({ id, pipeline_id: `p-${id}`, pipeline_name: funil, stage_id: `s-${id}`, stage_name: etapa, created_at: null });

  it('lead com dois atendimentos abertos: pergunta e manda o escolhido', async () => {
    s.cards.mockResolvedValue([card('i1', 'Vendas', 'Proposta'), card('i2', 'Locação', 'Agendou visita')]);
    abrir();
    await userEvent.type(screen.getAllByPlaceholderText('0,00')[0], '500000');

    const pergunta = await screen.findByRole('combobox', { name: 'De qual atendimento é esta proposta?' });
    expect(s.cards).toHaveBeenCalledWith('c1');
    expect(screen.getByRole('button', { name: 'Criar Rascunho' })).toBeDisabled();

    await userEvent.selectOptions(pergunta, 'i2');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Rascunho' }));

    await waitFor(() => expect(s.create).toHaveBeenCalledTimes(1));
    expect(s.create.mock.calls[0][0]).toMatchObject({ metadata: { pipeline_item_id: 'i2' } });
  });

  it('um atendimento só: liga sozinho, sem perguntar', async () => {
    s.cards.mockResolvedValue([card('i7', 'Vendas', 'Proposta')]);
    abrir();

    expect(await screen.findByText('Atendimento: Vendas · Proposta')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'De qual atendimento é esta proposta?' })).toBeNull();
    await userEvent.type(screen.getAllByPlaceholderText('0,00')[0], '500000');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Rascunho' }));

    await waitFor(() => expect(s.create).toHaveBeenCalledTimes(1));
    expect(s.create.mock.calls[0][0]).toMatchObject({ metadata: { pipeline_item_id: 'i7' } });
  });

  it('registrada pelo card: não pergunta (o card já diz)', async () => {
    abrir({ pipelineItemId: 'i1' });
    await userEvent.type(screen.getAllByPlaceholderText('0,00')[0], '500000');
    await userEvent.click(screen.getByRole('button', { name: 'Criar Rascunho' }));

    await waitFor(() => expect(s.create).toHaveBeenCalledTimes(1));
    expect(s.cards).not.toHaveBeenCalled();
  });
});

describe('ProposalFormDialog · lista de atendimentos (correções)', () => {
  const card = (id: string) => ({ id, pipeline_id: 'p', pipeline_name: 'Vendas', stage_id: 's', stage_name: 'Proposta', created_at: '2026-10-03T12:00:00Z' });

  it('trocar o lead: bloqueia salvar até a lista do novo lead chegar e usa o card dele', async () => {
    let resolveB: (v: unknown) => void = () => {};
    s.cards.mockImplementation((id: string) => (id === 'c1'
      ? Promise.resolve([card('iA')])
      : new Promise(r => { resolveB = r; })));
    abrir();
    expect(await screen.findByText(/Atendimento: Vendas · Proposta/)).toBeInTheDocument();
    await userEvent.type(screen.getAllByPlaceholderText('0,00')[0], '500000');

    await userEvent.click(screen.getByRole('button', { name: 'trocar lead' }));
    expect(screen.queryByText(/Atendimento: Vendas/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Criar Rascunho' })).toBeDisabled();

    resolveB([card('iB')]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar Rascunho' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Criar Rascunho' }));
    await waitFor(() => expect(s.create).toHaveBeenCalledTimes(1));
    expect(s.create.mock.calls[0][0]).toMatchObject({ contact_id: 'c2', metadata: { pipeline_item_id: 'iB' } });
  });

  it('falha na lista: avisa, deixa salvar sem ligação e permite tentar de novo', async () => {
    s.cards.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([card('i1'), { ...card('i2'), stage_name: 'Visita' }]);
    abrir();
    expect(await screen.findByText(/Não consegui carregar os atendimentos deste lead/)).toBeInTheDocument();
    await userEvent.type(screen.getAllByPlaceholderText('0,00')[0], '500000');
    expect(screen.getByRole('button', { name: 'Criar Rascunho' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('combobox', { name: 'De qual atendimento é esta proposta?' })).toBeInTheDocument();
    expect(screen.queryByText(/Não consegui carregar/)).toBeNull();
    expect(screen.getByRole('option', { name: 'Vendas · Visita · 03/10/2026' })).toBeInTheDocument();
  });

  it('um card com nomes vazios: texto de reserva', async () => {
    s.cards.mockResolvedValue([{ ...card('i1'), pipeline_name: null, stage_name: null }]);
    abrir();
    expect(await screen.findByText('Atendimento aberto')).toBeInTheDocument();
  });
});
