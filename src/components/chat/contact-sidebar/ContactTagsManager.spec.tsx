import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ContactTagsManager from './ContactTagsManager';

// O painel do lead monta as Etiquetas de novo a cada contato. O catálogo de
// etiquetas (cor e sugestões) vem do store, com cache: trocar de conversa não
// pode pedir o catálogo de novo.

const getLabels = vi.fn().mockResolvedValue({
  data: [{ id: 'l1', title: 'zona sul', color: '#2563eb' }],
});

vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: {
    getLabels: (...a: unknown[]) => getLabels(...a),
    createLabel: vi.fn(),
  },
}));
vi.mock('@/services/contacts/contactsService', () => ({ contactsService: { updateContact: vi.fn() } }));
vi.mock('@/services/chat/chatService', () => ({ default: { addLabels: vi.fn(), removeLabels: vi.fn() } }));

describe('ContactTagsManager', () => {
  it('busca o catálogo uma vez só, mesmo remontando por contato', async () => {
    const { unmount } = render(<ContactTagsManager contactId="contato-1" initialLabels={[]} />);
    // Sugestão do catálogo aparece (veio do store).
    expect(await screen.findByText('zona sul')).toBeTruthy();
    unmount();

    render(<ContactTagsManager contactId="contato-2" initialLabels={['zona sul']} />);
    await waitFor(() => expect(screen.getByText('zona sul')).toBeTruthy());
    expect(getLabels).toHaveBeenCalledTimes(1);
  });
});
