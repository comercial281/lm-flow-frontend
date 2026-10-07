import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PipelineItem } from '@/types/analytics';

const listVisitas = vi.fn();
const cancelarVisita = vi.fn();
const listPropostas = vi.fn();
let podeCriar = true;
let featureCriar = true;
const dialogo = vi.fn();

vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return {
    ...real,
    visitsService: {
      ...real.visitsService,
      list: (...a: unknown[]) => listVisitas(...a),
      cancel: (...a: unknown[]) => cancelarVisita(...a),
    },
  };
});
vi.mock('@/services/proposals/proposalsService', async (orig) => {
  const real = await orig<typeof import('@/services/proposals/proposalsService')>();
  return { ...real, proposalsService: { ...real.proposalsService, list: (...a: unknown[]) => listPropostas(...a) } };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => podeCriar }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => featureCriar }));
vi.mock('@/components/proposals/ProposalFormDialog', () => ({
  default: (props: { open: boolean; leadInicial?: { id: string } | null; imovelInicial?: { id: string } | null }) => {
    dialogo(props);
    return props.open ? <div>janela de proposta</div> : null;
  },
}));

import VisitsProposalsTab from './VisitsProposalsTab';

const item = {
  id: 'i1',
  pipeline_id: 'p1',
  stage_id: 's1',
  contact: { id: 'c1', name: 'Ana Teste' },
  primary_property: { id: 'im1', title: 'Apto Lapa', code: 'AP0001' },
} as unknown as PipelineItem;

const abrir = () =>
  render(
    <MemoryRouter>
      <VisitsProposalsTab item={item} nomeExibido="Ana Teste" />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  podeCriar = true;
  featureCriar = true;
  listVisitas.mockResolvedValue({
    data: [
      { id: 'v1', status: 'completed', scheduled_at: '2026-09-01T15:00:00Z', rating: null, feedback_notes: null, property: { id: 'im1', title: 'Apto Lapa', code: 'AP0001' } },
      { id: 'v2', status: 'completed', scheduled_at: '2026-09-10T15:00:00Z', rating: 5, feedback_notes: 'Amou a varanda' },
    ],
    meta: { total: 2 },
  });
  listPropostas.mockResolvedValue({
    data: [{ id: 'pr1', status: 'sent', proposal_type: 'purchase', offered_value: 500000, display_offered_value: 'R$ 500.000,00', property: { id: 'im1', title: 'Apto Lapa', code: 'AP0001' } }],
    meta: { total: 1 },
  });
});

describe('Aba Visitas e propostas do card', () => {
  it('busca visitas e propostas só deste lead', async () => {
    abrir();

    expect(await screen.findByText('Amou a varanda')).toBeInTheDocument();
    expect(listVisitas).toHaveBeenCalledWith(expect.objectContaining({ contact_id: 'c1' }));
    expect(listPropostas).toHaveBeenCalledWith({ contact_id: 'c1' });
  });

  it('visita passada sem nota nem comentário aparece como "Sem feedback"', async () => {
    abrir();

    expect(await screen.findByText('Sem feedback')).toBeInTheDocument();
    expect(screen.getAllByText('Sem feedback')).toHaveLength(1);
  });

  it('mostra a proposta com valor e status, e o link para Propostas filtrado pelo lead', async () => {
    abrir();

    expect(await screen.findByText('R$ 500.000,00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir em Propostas' })).toHaveAttribute(
      'href',
      '/proposals?contact_id=c1&nome=Ana%20Teste',
    );
  });

  it('Registrar proposta abre a janela com o lead e o imóvel de interesse', async () => {
    abrir();

    await userEvent.click(await screen.findByRole('button', { name: /Registrar proposta/ }));

    expect(screen.getByText('janela de proposta')).toBeInTheDocument();
    expect(dialogo).toHaveBeenLastCalledWith(expect.objectContaining({
      open: true,
      leadInicial: expect.objectContaining({ id: 'c1' }),
      imovelInicial: expect.objectContaining({ id: 'im1' }),
    }));
  });

  it('sem permissão de criar, não mostra o botão', async () => {
    podeCriar = false;
    abrir();

    await screen.findByText('R$ 500.000,00');
    expect(screen.queryByRole('button', { name: /Registrar proposta/ })).not.toBeInTheDocument();
  });

  it('sem permissão de ver propostas, a seção some e as visitas ficam', async () => {
    listPropostas.mockRejectedValue({ response: { status: 403 } });
    abrir();

    expect(await screen.findByText('Amou a varanda')).toBeInTheDocument();
    expect(screen.queryByText('Propostas')).not.toBeInTheDocument();
  });

  it('visita agendada tem Cancelar visita: pede o motivo e a visita passa a Cancelada', async () => {
    listVisitas.mockResolvedValue({
      data: [
        { id: 'v1', status: 'completed', scheduled_at: '2026-09-01T15:00:00Z', rating: 5, feedback_notes: 'Ok' },
        { id: 'v3', status: 'scheduled', scheduled_at: '2026-10-20T15:00:00Z', property: { id: 'im1', title: 'Apto Lapa', code: 'AP0001' } },
      ],
      meta: { total: 2 },
    });
    cancelarVisita.mockResolvedValue({ id: 'v3', status: 'cancelled', scheduled_at: '2026-10-20T15:00:00Z' });
    abrir();

    // Só a ativa ganha o botão; a realizada não.
    const botoes = await screen.findAllByRole('button', { name: /Cancelar visita/ });
    expect(botoes).toHaveLength(1);
    await userEvent.click(botoes[0]);
    await userEvent.type(screen.getByPlaceholderText('Opcional'), 'Cliente desistiu');
    const confirmar = screen.getAllByRole('button', { name: 'Cancelar visita' }).at(-1)!;
    await userEvent.click(confirmar);

    expect(cancelarVisita).toHaveBeenCalledWith('v3', 'Cliente desistiu');
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancelar visita/ })).not.toBeInTheDocument();
  });

  it('sem permissão de cancelar, a visita agendada não tem o botão', async () => {
    podeCriar = false; // o mock do useCan responde o mesmo para toda permissão
    listVisitas.mockResolvedValue({
      data: [{ id: 'v3', status: 'scheduled', scheduled_at: '2026-10-20T15:00:00Z' }],
      meta: { total: 1 },
    });
    abrir();

    await screen.findByText('Agendada');
    expect(screen.queryByRole('button', { name: /Cancelar visita/ })).not.toBeInTheDocument();
  });
});
