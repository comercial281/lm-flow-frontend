import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import ArchivedFeaturesView from './ArchivedFeaturesView';

const catalogo = [
  { key: 'disparos', label: 'Disparos', group: 'disparos' },
  { key: 'disparos_agendar', label: 'Agendar disparo', group: 'disparos' },
  { key: 'visits', label: 'Visitas', group: 'visits' },
];

describe('Plataforma → Menus arquivados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { data: { catalog: catalogo, keys: ['visits'] } } });
    api.patch.mockImplementation(async (_url: string, corpo: { key: string; archived: boolean }) => ({
      data: { data: { keys: corpo.archived ? ['visits', corpo.key] : [] } },
    }));
  });

  it('só os menus inteiros aparecem, cada um com a chave da casa', async () => {
    render(<ArchivedFeaturesView />);
    expect(await screen.findByRole('switch', { name: 'Arquivar Disparos' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Arquivar Visitas' })).toBeChecked();
    expect(screen.queryByRole('switch', { name: 'Arquivar Agendar disparo' })).not.toBeInTheDocument();
  });

  it('arquivar confirma dizendo que some para todos, e só então grava', async () => {
    const user = userEvent.setup();
    render(<ArchivedFeaturesView />);
    await user.click(await screen.findByRole('switch', { name: 'Arquivar Disparos' }));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('Esconder Disparos de todos os clientes?');
    expect(dialogo).toHaveTextContent('Some também para você e para a equipe.');
    expect(api.patch).not.toHaveBeenCalled();
    await user.click(within(dialogo).getByRole('button', { name: 'Arquivar' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      '/super/pooled_tenants/update_archived_features', { key: 'disparos', archived: true },
    ));
  });

  it('desarquivar não pergunta', async () => {
    const user = userEvent.setup();
    render(<ArchivedFeaturesView />);
    await user.click(await screen.findByRole('switch', { name: 'Arquivar Visitas' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      '/super/pooled_tenants/update_archived_features', { key: 'visits', archived: false },
    ));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('erro ao carregar mostra o erro e tenta de novo', async () => {
    api.get.mockRejectedValueOnce(new Error('rede'));
    const user = userEvent.setup();
    render(<ArchivedFeaturesView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra carregar');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('switch', { name: 'Arquivar Disparos' })).toBeInTheDocument();
  });

  it('catálogo sem menus diz isso', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { catalog: [], keys: [] } } });
    render(<ArchivedFeaturesView />);
    expect(await screen.findByText('Nenhum menu no catálogo')).toBeInTheDocument();
  });
});
