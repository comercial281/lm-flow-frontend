import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MessageFunnels from './MessageFunnels';

const listarFunis = vi.fn();
const listarTags = vi.fn();
const criarTag = vi.fn().mockResolvedValue({});
const excluirTag = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  messageFunnelsService: {
    list: (...a: unknown[]) => listarFunis(...a),
    destroy: vi.fn(),
    update: vi.fn(),
  },
  messageFunnelFoldersService: { list: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  messageFunnelTagsService: {
    list: (...a: unknown[]) => listarTags(...a),
    create: (...a: unknown[]) => criarTag(...a),
    update: vi.fn(),
    destroy: (...a: unknown[]) => excluirTag(...a),
  },
}));

vi.mock('@/components/messageFunnels/MessageFunnelEditor', () => ({ default: () => null }));

const QUENTE = { id: 't1', name: 'Lead quente', color: '#dc2626', usage_count: 3 };
const FUNIL = {
  id: 'f1', name: 'Saudação', description: null, category: 'geral', active: true,
  user_id: null, shared: true, usage_count: 0, folder_id: null, humanize: true,
  tag_ids: ['t1'], items: [], created_at: '', updated_at: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  listarFunis.mockResolvedValue([FUNIL]);
  listarTags.mockResolvedValue([QUENTE]);
});

const montar = () => render(<MessageFunnels />, { wrapper: MemoryRouter });

describe('Etiquetas de funil', () => {
  it('a etiqueta aparece no card do funil', async () => {
    montar();
    // "Lead quente" aparece duas vezes: no filtro e no card. O card é o que
    // prova que tag_ids virou nome e cor na tela.
    await waitFor(() => expect(screen.getAllByText('Lead quente').length).toBeGreaterThan(1));
  });

  it('clicar na etiqueta filtra pelo BACKEND, com tagId', async () => {
    const usuario = userEvent.setup();
    montar();
    const chip = await screen.findByRole('button', { name: 'Lead quente' });

    await usuario.click(chip);

    // O filtro não é da tela: tem que chegar como tagId no serviço.
    await waitFor(() => expect(listarFunis).toHaveBeenCalledWith(expect.objectContaining({ tagId: 't1' })));
  });

  it('criar etiqueta passa pelo diálogo e manda nome e cor', async () => {
    const usuario = userEvent.setup();
    montar();

    await usuario.click(await screen.findByRole('button', { name: /Etiquetas/i }));
    await usuario.click(await screen.findByRole('button', { name: 'Nova etiqueta' }));
    await usuario.type(screen.getByPlaceholderText('Nome da etiqueta'), 'Frio');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(criarTag).toHaveBeenCalledWith(expect.objectContaining({ name: 'Frio' })),
    );
    expect(criarTag.mock.calls[0][0].color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('excluir etiqueta diz de quantos funis ela some', async () => {
    const usuario = userEvent.setup();
    montar();

    await usuario.click(await screen.findByRole('button', { name: /Etiquetas/i }));
    await usuario.click(await screen.findByTitle('Excluir etiqueta'));
    expect(await screen.findByText(/some de 3 funis/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(excluirTag).toHaveBeenCalledWith('t1'));
  });

  it('se o endpoint de etiquetas falhar, a página continua listando os funis', async () => {
    // ⚠️ ESTE É O CASO QUE IMPORTA. Funcionalidade nova não pode derrubar o que
    // já funcionava: sem etiqueta, a tela tem que ficar exatamente como era.
    listarTags.mockRejectedValue(new Error('500'));
    montar();

    expect(await screen.findByText('Saudação')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Todas' })).toBeNull();
  });
});
