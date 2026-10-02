import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ContactTagsManager from './ContactTagsManager';

// O painel do lead monta as Etiquetas de novo a cada contato. O catálogo de
// etiquetas (cor e sugestões) vem do store, com cache: trocar de conversa não
// pode pedir o catálogo de novo.
//
// Proposta B (02/10): a seção mostra SÓ as etiquetas do lead. O catálogo da
// conta abre no "+ Etiqueta" (antes ficava sempre aberto e parecia que o lead
// tinha todas).

const getLabels = vi.fn().mockResolvedValue({
  data: [
    { id: 'l1', title: 'zona sul', color: '#2563eb' },
    { id: 'l2', title: 'visita-agendada', color: '#16a34a' },
  ],
});

const createLabel = vi.fn().mockResolvedValue({});
vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: {
    getLabels: (...a: unknown[]) => getLabels(...a),
    createLabel: (...a: unknown[]) => createLabel(...a),
  },
}));
const updateContact = vi.fn().mockResolvedValue({});
vi.mock('@/services/contacts/contactsService', () => ({
  contactsService: { updateContact: (...a: unknown[]) => updateContact(...a) },
}));
const removeLabels = vi.fn().mockResolvedValue({});
const addLabels = vi.fn().mockResolvedValue({});
vi.mock('@/services/chat/chatService', () => ({
  default: {
    addLabels: (...a: unknown[]) => addLabels(...a),
    removeLabels: (...a: unknown[]) => removeLabels(...a),
  },
}));

describe('ContactTagsManager', () => {
  beforeEach(() => {
    updateContact.mockClear();
    removeLabels.mockClear();
    addLabels.mockClear();
    createLabel.mockClear();
  });

  it('busca o catálogo uma vez só, mesmo remontando por contato', async () => {
    const { unmount } = render(<ContactTagsManager contactId="contato-1" initialLabels={[]} />);
    // O catálogo (do store) aparece ao abrir o "+ Etiqueta".
    fireEvent.click(screen.getByRole('button', { name: '+ Etiqueta' }));
    expect(await screen.findByText('zona sul')).toBeTruthy();
    unmount();

    render(<ContactTagsManager contactId="contato-2" initialLabels={['zona sul']} />);
    await waitFor(() => expect(screen.getByText('zona sul')).toBeTruthy());
    expect(getLabels).toHaveBeenCalledTimes(1);
  });

  it('mostra só as etiquetas do lead; o catálogo fica fechado', async () => {
    render(<ContactTagsManager contactId="contato-3" initialLabels={[{ name: 'zona sul' }]} />);
    expect(screen.getByText('zona sul')).toBeTruthy();
    // Etiqueta da conta que o lead não tem não aparece, nem o campo de busca.
    await waitFor(() => expect(getLabels).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('visita-agendada')).toBeNull();
    expect(screen.queryByPlaceholderText('Buscar ou criar etiqueta...')).toBeNull();
  });

  it('sem etiqueta: só o "+ Etiqueta", sem a frase "Nenhuma etiqueta"', () => {
    render(<ContactTagsManager contactId="contato-4" initialLabels={[]} />);
    expect(screen.queryByText('Nenhuma etiqueta')).toBeNull();
    expect(screen.getByRole('button', { name: '+ Etiqueta' })).toBeTruthy();
  });

  it('"+ Etiqueta" abre o catálogo sem as que o lead já tem; clicar aplica', async () => {
    render(<ContactTagsManager contactId="contato-5" conversationId="conv-5" initialLabels={['zona sul']} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Etiqueta' }));

    expect(screen.getByPlaceholderText('Buscar ou criar etiqueta...')).toBeTruthy();
    const sugestao = await screen.findByRole('button', { name: 'visita-agendada' });
    // "zona sul" aparece uma vez só: como etiqueta do lead, não como sugestão.
    expect(screen.getAllByText('zona sul')).toHaveLength(1);

    fireEvent.click(sugestao);
    await waitFor(() =>
      expect(updateContact).toHaveBeenCalledWith('contato-5', { labels: ['zona sul', 'visita-agendada'] }),
    );
    expect(addLabels).toHaveBeenCalledWith('conv-5', ['visita-agendada']);
  });

  it('a busca filtra o catálogo', async () => {
    render(<ContactTagsManager contactId="contato-6" initialLabels={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Etiqueta' }));
    expect(await screen.findByRole('button', { name: 'zona sul' })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Buscar ou criar etiqueta...'), { target: { value: 'visita' } });
    expect(screen.queryByRole('button', { name: 'zona sul' })).toBeNull();
    expect(screen.getByRole('button', { name: 'visita-agendada' })).toBeTruthy();
  });

  it('o ✕ remove a etiqueta e chama o serviço (contato e conversa)', async () => {
    render(<ContactTagsManager contactId="contato-7" conversationId="conv-7" initialLabels={['zona sul']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover zona sul' }));

    await waitFor(() => expect(updateContact).toHaveBeenCalledWith('contato-7', { labels: [] }));
    expect(removeLabels).toHaveBeenCalledWith('conv-7', ['zona sul']);
    await waitFor(() => expect(screen.queryByText('zona sul')).toBeNull());
  });
  // Enter na busca (revisão de 02/10): "vis" + Enter não pode criar uma etiqueta
  // "vis" na conta inteira quando o catálogo já mostra "visita-agendada".
  const abrirEDigitar = async (contato: string, texto: string) => {
    render(<ContactTagsManager contactId={contato} initialLabels={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Etiqueta' }));
    await screen.findByRole('button', { name: 'zona sul' });
    const campo = screen.getByPlaceholderText('Buscar ou criar etiqueta...');
    fireEvent.change(campo, { target: { value: texto } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    return campo;
  };

  it('Enter com parte do nome aplica a 1ª sugestão, sem criar etiqueta nova', async () => {
    await abrirEDigitar('contato-8', 'vis');
    await waitFor(() => expect(updateContact).toHaveBeenCalledWith('contato-8', { labels: ['visita-agendada'] }));
    expect(createLabel).not.toHaveBeenCalled();
  });

  it('Enter com o nome exato (sem diferença de maiúscula) aplica essa, não a 1ª sugestão', async () => {
    // O catálogo já está no store; "Zona Sul" casa exato com "zona sul".
    await abrirEDigitar('contato-9', 'Zona Sul');
    await waitFor(() => expect(updateContact).toHaveBeenCalledWith('contato-9', { labels: ['zona sul'] }));
    expect(createLabel).not.toHaveBeenCalled();
  });

  it('Enter sem sugestão nenhuma cria a etiqueta', async () => {
    await abrirEDigitar('contato-10', 'investidor');
    await waitFor(() => expect(createLabel).toHaveBeenCalledWith(expect.objectContaining({ title: 'investidor' })));
    await waitFor(() => expect(updateContact).toHaveBeenCalledWith('contato-10', { labels: ['investidor'] }));
  });

  it('enquanto salva, o campo não é desabilitado (desabilitar tira o foco no navegador)', async () => {
    let terminar: (v: unknown) => void = () => {};
    updateContact.mockImplementationOnce(() => new Promise(r => { terminar = r; }));
    const campo = (await abrirEDigitar('contato-11', 'zona')) as HTMLInputElement;
    await waitFor(() => expect(updateContact).toHaveBeenCalled());
    // Salvando: só leitura, mas ainda focável e com o foco.
    expect(campo.disabled).toBe(false);
    expect(campo.readOnly).toBe(true);
    expect(document.activeElement).toBe(campo);
    terminar({});
    await waitFor(() => expect(campo.readOnly).toBe(false));
    expect(document.activeElement).toBe(campo);
  });
});
