import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageFunnelEditor from './MessageFunnelEditor';

const atualizarFunil = vi.fn().mockResolvedValue({ id: 'f1', items: [] });
const listarTags = vi.fn();

vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  messageFunnelsService: {
    create: vi.fn().mockResolvedValue({ id: 'novo', items: [] }),
    update: (...a: unknown[]) => atualizarFunil(...a),
    get: vi.fn(),
    uploadItemMedia: vi.fn(),
  },
  messageFunnelFoldersService: { list: vi.fn().mockResolvedValue([]) },
  messageFunnelTagsService: { list: (...a: unknown[]) => listarTags(...a) },
  tenantTemplateVariablesService: { list: vi.fn().mockResolvedValue({ variables: [] }) },
}));

const QUENTE = { id: 't1', name: 'Lead quente', color: '#dc2626', usage_count: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  listarTags.mockResolvedValue([QUENTE]);
});

// Funil já válido. Editar (em vez de criar) evita ter que preencher a sequência
// inteira pela UI só pra chegar no botão de salvar — o que está sob teste aqui é
// a etiqueta, não a validação da sequência.
const FUNIL_VALIDO = {
  id: 'f1', name: 'Saudação', description: null, category: 'geral', active: true,
  user_id: null, shared: true, usage_count: 0, folder_id: null, humanize: true,
  tag_ids: [] as string[],
  items: [{
    id: 'i1', message_funnel_id: 'f1', position: 0, kind: 'text' as const,
    text_content: 'Olá!', media_url: null, media_caption: null, media_filename: null,
    delay_seconds: 0, config: {}, created_at: '', updated_at: '',
  }],
  created_at: '', updated_at: '',
};

describe('Editor de funil: etiquetas', () => {
  it('marcar a etiqueta manda tag_ids no salvar — é o que prende a etiqueta ao funil', async () => {
    const usuario = userEvent.setup();
    render(<MessageFunnelEditor open onClose={() => {}} funnel={FUNIL_VALIDO} />);

    await usuario.click(await screen.findByRole('button', { name: 'Lead quente' }));
    await usuario.click(screen.getByRole('button', { name: /Salvar alterações/i }));

    await waitFor(() =>
      expect(atualizarFunil).toHaveBeenCalledWith('f1', expect.objectContaining({ tag_ids: ['t1'] })),
    );
  });

  it('desmarcar tira a etiqueta — tag_ids vai VAZIO, não some do payload', async () => {
    // Se a chave sumisse, o backend faria replace_tags! só quando ela existe e a
    // etiqueta nunca seria removida. O `if params.dig(:tag_ids)` do controller
    // depende disso.
    const usuario = userEvent.setup();
    render(<MessageFunnelEditor open onClose={() => {}} funnel={{ ...FUNIL_VALIDO, tag_ids: ['t1'] }} />);

    await usuario.click(await screen.findByRole('button', { name: 'Lead quente' }));
    await usuario.click(screen.getByRole('button', { name: /Salvar alterações/i }));

    await waitFor(() =>
      expect(atualizarFunil).toHaveBeenCalledWith('f1', expect.objectContaining({ tag_ids: [] })),
    );
  });

  it('sem etiqueta cadastrada, a seção nem aparece — rótulo em cima de vazio é ruído', async () => {
    listarTags.mockResolvedValue([]);
    render(<MessageFunnelEditor open onClose={() => {}} funnel={FUNIL_VALIDO} />);

    await screen.findByDisplayValue('Saudação');
    expect(screen.queryByText('Etiquetas (opcional)')).toBeNull();
  });
});
