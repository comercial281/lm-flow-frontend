import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientBroadcastModal from './ClientBroadcastModal';

vi.mock('@/services/core/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: [{ name: 'LM01', connected: true }, { name: 'LM02', connected: false }] } }),
    post: vi.fn(),
  },
}));

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false, media: '(pointer: coarse)', addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  // @ts-expect-error: o jsdom não tem matchMedia; voltamos a não ter.
  delete window.matchMedia;
});

const tenants = [{ id: '1', name: 'Cliente A', slug: 'a', status: 'active', settings: { phone: '11999990000' } }];

describe('Comunicado aos clientes no computador (janela roxa do painel raiz)', () => {
  it('escolher o número na lista não fecha a janela', async () => {
    const onClose = vi.fn();
    render(<ClientBroadcastModal tenants={tenants} onClose={onClose} />);
    const caixa = await screen.findByRole('combobox');
    await waitFor(() => expect(caixa).toHaveTextContent('LM01'));
    await userEvent.click(caixa);
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: /LM02/ }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Comunicado aos clientes')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('LM02');
  });

  it('a lista abre escura e as opções sem o fundo roxo inline (texto legível, realce do mouse)', async () => {
    render(<ClientBroadcastModal tenants={tenants} onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('combobox'));
    expect(await screen.findByRole('listbox')).toHaveClass('dark');
    expect(screen.getByRole('option', { name: /LM01/ }).style.background).toBe('');
  });
});
