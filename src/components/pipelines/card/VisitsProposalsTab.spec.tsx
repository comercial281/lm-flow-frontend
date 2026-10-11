import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PipelineItem } from '@/types/analytics';

const listVisitas = vi.fn();
const listPropostas = vi.fn();
let podeCriar = true;
let featureCriar = true;
const dialogo = vi.fn();
const janelaVisita = vi.fn();
let aoAtualizar: (() => void) | null = null;

vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return {
    ...real,
    visitsService: {
      ...real.visitsService,
      list: (...a: unknown[]) => listVisitas(...a),
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
  default: (props: { open: boolean; leadInicial?: { id: string } | null; imovelInicial?: { id: string } | null; pipelineItemId?: string | null }) => {
    dialogo(props);
    return props.open ? <div>janela de proposta</div> : null;
  },
}));

vi.mock('@/components/visits/ScheduleVisitDialog', () => ({
  ScheduleVisitDialog: (props: { open: boolean; leadInicial?: { id: string } | null; imovelInicial?: { id: string } | null; onCreated: () => void }) => {
    janelaVisita(props);
    return props.open ? <button onClick={props.onCreated}>janela de visita</button> : null;
  },
}));
vi.mock('@/features/visits/AcoesDaVisita', () => ({
  AcoesDaVisita: ({ visita, onAtualizada }: { visita: { id: string }; onAtualizada: () => void }) => {
    aoAtualizar = onAtualizada;
    return <div data-testid={`acoes-${visita.id}`} />;
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
      pipelineItemId: 'i1',
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

  it('Nova visita abre a janela com o lead do card e o imóvel de interesse', async () => {
    abrir();

    await userEvent.click(await screen.findByRole('button', { name: /Nova visita/ }));

    expect(screen.getByText('janela de visita')).toBeInTheDocument();
    expect(janelaVisita).toHaveBeenLastCalledWith(expect.objectContaining({
      open: true,
      leadInicial: expect.objectContaining({ id: 'c1' }),
      imovelInicial: expect.objectContaining({ id: 'im1' }),
    }));
  });

  it('sem permissão de criar visita, não mostra Nova visita', async () => {
    podeCriar = false;
    abrir();

    await screen.findByText('Amou a varanda');
    expect(screen.queryByRole('button', { name: /Nova visita/ })).not.toBeInTheDocument();
  });

  it('depois de criar a visita, a lista é buscada de novo', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: /Nova visita/ }));
    expect(listVisitas).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByText('janela de visita'));

    await waitFor(() => expect(listVisitas).toHaveBeenCalledTimes(2));
  });

  it('cada visita tem a peça única de botões, e o onAtualizada recarrega a lista', async () => {
    abrir();

    expect(await screen.findByTestId('acoes-v1')).toBeInTheDocument();
    expect(screen.getByTestId('acoes-v2')).toBeInTheDocument();
    act(() => aoAtualizar?.());

    await waitFor(() => expect(listVisitas).toHaveBeenCalledTimes(2));
  });

  it('a aba recarrega quando a versão do pai sobe', async () => {
    const { rerender } = render(
      <MemoryRouter><VisitsProposalsTab item={item} nomeExibido="Ana Teste" versao={0} /></MemoryRouter>,
    );
    await screen.findByTestId('acoes-v1');

    rerender(<MemoryRouter><VisitsProposalsTab item={item} nomeExibido="Ana Teste" versao={1} /></MemoryRouter>);

    await waitFor(() => expect(listVisitas).toHaveBeenCalledTimes(2));
  });

  it('o diálogo antigo de Cancelar visita não existe mais nesta aba', async () => {
    listVisitas.mockResolvedValue({
      data: [{ id: 'v3', status: 'scheduled', scheduled_at: '2026-10-20T15:00:00Z' }],
      meta: { total: 1 },
    });
    abrir();

    await screen.findByText('Agendada');
    expect(screen.queryByRole('button', { name: /Cancelar visita/ })).not.toBeInTheDocument();
  });
  it('visitas e propostas que não carregaram mostram erro com Tentar de novo, não a lista vazia', async () => {
    listVisitas.mockRejectedValueOnce(new Error('Network Error'));
    listPropostas.mockRejectedValueOnce(new Error('Network Error'));
    abrir();

    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(screen.queryByText(/Nenhuma visita com este lead/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma proposta deste lead/)).not.toBeInTheDocument();

    const [tentarVisitas, tentarPropostas] = screen.getAllByRole('button', { name: 'Tentar de novo' });
    await userEvent.click(tentarVisitas);
    expect(await screen.findByText('Amou a varanda')).toBeInTheDocument();
    await userEvent.click(tentarPropostas);
    expect(await screen.findByText('R$ 500.000,00')).toBeInTheDocument();
  });

  it('sem visita nem proposta, mostra os vazios', async () => {
    listVisitas.mockResolvedValue({ data: [], meta: { total: 0 } });
    listPropostas.mockResolvedValue({ data: [], meta: { total: 0 } });
    abrir();

    expect(await screen.findByText('Nenhuma visita com este lead ainda.')).toBeInTheDocument();
    expect(await screen.findByText(/Nenhuma proposta deste lead/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
