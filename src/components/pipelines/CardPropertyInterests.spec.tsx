import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PipelineItem } from '@/types/analytics';

const mocks = vi.hoisted(() => ({
  listByContact: vi.fn(),
  create: vi.fn(),
  listProps: vi.fn(),
  visitaProps: vi.fn(),
}));

vi.mock('@/services/propertyInterests/propertyInterestsService', () => ({
  propertyInterestsService: {
    listByContact: (...a: unknown[]) => mocks.listByContact(...a),
    create: (...a: unknown[]) => mocks.create(...a),
    update: vi.fn(),
    delete: vi.fn(),
  },
  INTEREST_STAGE_LABELS: { interested: 'Interessado', visit_scheduled: 'Visita marcada' },
  INTEREST_STAGE_COLORS: {},
}));
vi.mock('@/services/properties/propertiesService', () => ({
  propertiesService: { list: (...a: unknown[]) => mocks.listProps(...a) },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ can: () => true }) }));
vi.mock('@/components/visits/ScheduleVisitDialog', () => ({
  ScheduleVisitDialog: (p: { open: boolean; imovelInicial?: unknown }) => {
    if (p.open) mocks.visitaProps(p.imovelInicial);
    return p.open ? <div data-testid="janela-visita" /> : null;
  },
}));

import CardPropertyInterests from './CardPropertyInterests';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/ds';

const item = {
  id: 'i1',
  pipeline_id: 'p1',
  contact: { id: 'c1', name: 'Maria' },
} as unknown as PipelineItem;

const interesse = (n: number) => ({
  id: `int${n}`,
  contact_id: 'c1',
  property_id: `p${n}`,
  interest_stage: 'interested',
  property: { id: `p${n}`, code: `AP${n}`, title: `Imóvel ${n}`, neighborhood: 'Centro', city: 'SP', display_price: 'R$ 100.000' },
});

const montar = (props = {}) =>
  render(<MemoryRouter><CardPropertyInterests item={item} {...props} /></MemoryRouter>);

describe('CardPropertyInterests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista os imóveis numa fileira que rola pro lado', async () => {
    mocks.listByContact.mockResolvedValue({ data: [1, 2, 3, 4, 5].map(interesse) });
    const aoContar = vi.fn();
    montar({ aoContar });
    expect(await screen.findByText('Imóvel 1')).toBeInTheDocument();
    const fileira = screen.getByTestId('fileira-de-imoveis');
    expect(fileira.className).toContain('overflow-x-auto');
    expect(fileira.className).toContain('grid-flow-col');
    expect(fileira.children).toHaveLength(5);
    await waitFor(() => expect(aoContar).toHaveBeenLastCalledWith(5));
  });

  it('a busca fica no topo e adicionar cria o interesse e mostra o cartão', async () => {
    mocks.listByContact.mockResolvedValueOnce({ data: [] }).mockResolvedValue({ data: [interesse(9)] });
    mocks.listProps.mockResolvedValue({ data: [{ id: 'p9', code: 'AP9', title: 'Imóvel 9', address_neighborhood: 'Centro', display_price: 'R$ 1' }] });
    mocks.create.mockResolvedValue({});
    const user = userEvent.setup();
    montar();
    const busca = await screen.findByPlaceholderText(/Buscar imóvel/);
    await user.click(busca);
    const adicionar = await screen.findByRole('button', { name: 'Adicionar imóvel' });
    await user.click(adicionar);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ contact_id: 'c1', property_id: 'p9' })));
    expect(await screen.findByTestId('fileira-de-imoveis')).toBeInTheDocument();
  });

  describe('lista de resultados da busca', () => {
    const abrir = async () => {
      mocks.listByContact.mockResolvedValue({ data: [interesse(1)] });
      mocks.listProps.mockResolvedValue({ data: [{ id: 'p9', code: 'AP9', title: 'Imóvel 9', address_neighborhood: 'Centro', display_price: 'R$ 1' }] });
      const user = userEvent.setup();
      montar();
      await screen.findByText('Imóvel 1');
      const busca = screen.getByPlaceholderText(/Buscar imóvel/);
      await user.click(busca);
      const lista = await screen.findByTestId('lista-de-busca-de-imoveis');
      return { user, lista, busca };
    };

    it('aparece num portal, fora da fileira de cartões', async () => {
      const { lista } = await abrir();
      expect(document.body).toContainElement(lista);
      expect(screen.getByTestId('fileira-de-imoveis')).not.toContainElement(lista);
      expect(lista.closest('[data-testid="fileira-de-imoveis"]')).toBeNull();
    });

    it('Esc fecha', async () => {
      const { user } = await abrir();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByTestId('lista-de-busca-de-imoveis')).not.toBeInTheDocument());
    });

    it('o botão Fechar a lista fecha', async () => {
      const { user } = await abrir();
      await user.click(screen.getByRole('button', { name: 'Fechar a lista' }));
      await waitFor(() => expect(screen.queryByTestId('lista-de-busca-de-imoveis')).not.toBeInTheDocument());
    });

    it('clicar fora fecha, mas clicar no campo não', async () => {
      const { user, busca } = await abrir();
      await user.click(busca);
      expect(screen.getByTestId('lista-de-busca-de-imoveis')).toBeInTheDocument();
      await user.click(document.body);
      await waitFor(() => expect(screen.queryByTestId('lista-de-busca-de-imoveis')).not.toBeInTheDocument());
    });
  });

  describe('teclado e janela modal', () => {
    const doisResultados = () => {
      mocks.listByContact.mockResolvedValue({ data: [interesse(1)] });
      mocks.listProps.mockResolvedValue({ data: [
        { id: 'p8', code: 'AP8', title: 'Imóvel 8' },
        { id: 'p9', code: 'AP9', title: 'Imóvel 9' },
      ] });
    };

    it('seta pra baixo vai do campo ao primeiro resultado, setas navegam e Esc volta ao campo e fecha', async () => {
      doisResultados();
      const user = userEvent.setup();
      montar();
      await screen.findByText('Imóvel 1');
      const busca = screen.getByPlaceholderText(/Buscar imóvel/);
      await user.click(busca);
      const botoes = await screen.findAllByRole('button', { name: 'Adicionar imóvel' });
      await user.keyboard('{ArrowDown}');
      expect(botoes[0]).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(botoes[1]).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(botoes[0]).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(busca).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByTestId('lista-de-busca-de-imoveis')).not.toBeInTheDocument());
      expect(busca).toHaveFocus();
    });

    it('dentro de um Dialog: Esc fecha só a lista e clicar num resultado não fecha a janela', async () => {
      doisResultados();
      mocks.create.mockResolvedValue({});
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <Dialog open onOpenChange={() => undefined}>
            <DialogContent>
              <DialogTitle>Janela</DialogTitle>
              <CardPropertyInterests item={item} />
            </DialogContent>
          </Dialog>
        </MemoryRouter>,
      );
      await screen.findByText('Imóvel 1');
      await user.click(screen.getByPlaceholderText(/Buscar imóvel/));
      await screen.findByTestId('lista-de-busca-de-imoveis');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByTestId('lista-de-busca-de-imoveis')).not.toBeInTheDocument());
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.click(screen.getByPlaceholderText(/Buscar imóvel/));
      const botoes = await screen.findAllByRole('button', { name: 'Adicionar imóvel' });
      await user.click(botoes[0]);
      await waitFor(() => expect(mocks.create).toHaveBeenCalled());
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('sem nenhum imóvel: estado vazio compacto', async () => {
    mocks.listByContact.mockResolvedValue({ data: [] });
    montar();
    expect(await screen.findByText('Nenhum imóvel vinculado ainda.')).toBeInTheDocument();
    expect(screen.queryByTestId('fileira-de-imoveis')).not.toBeInTheDocument();
  });

  it('Agendar visita no cartão abre a janela de visita com o imóvel escolhido', async () => {
    mocks.listByContact.mockResolvedValue({ data: [interesse(1)] });
    const user = userEvent.setup();
    montar();
    await screen.findByText('Imóvel 1');
    await user.click(screen.getByRole('button', { name: /Agendar visita/ }));
    expect(await screen.findByTestId('janela-visita')).toBeInTheDocument();
    expect(mocks.visitaProps).toHaveBeenCalledWith({ id: 'p1', title: 'Imóvel 1', code: 'AP1' });
  });
});
