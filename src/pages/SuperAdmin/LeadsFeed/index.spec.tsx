import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeadsFeed from './index';

vi.mock('@/services/superLeadsFeed/superLeadsFeedService', () => ({
  default: {
    getLeadsFeed: vi.fn().mockResolvedValue({
      data: {
        data: {
          leads: [],
          clients: [],
          server_time: '2026-10-02T12:00:00Z',
          overview: { total_today: 0, total_1h: 0, clients_total: 0, clients_silent: 0 },
        },
      },
    }),
  },
}));

beforeEach(() => {
  localStorage.clear();
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

describe('Mural de leads no computador', () => {
  it('"Alertar após": largura fixa e escolher grava o número', async () => {
    render(<LeadsFeed />);
    const caixa = await screen.findByRole('combobox');
    expect(caixa.className.split(/\s+/)).toEqual(expect.arrayContaining(['w-40', 'h-auto']));
    expect(caixa).toHaveTextContent('2h sem lead');
    await userEvent.click(caixa);
    await userEvent.click(await screen.findByRole('option', { name: '4h sem lead' }));
    expect(screen.getByRole('combobox')).toHaveTextContent('4h sem lead');
    expect(JSON.parse(localStorage.getItem('lmflow.leadsFeed.silenceMinutes') ?? 'null')).toBe(240);
  });

  it('Esc com a lista aberta no modo mural fecha só a lista', async () => {
    render(<LeadsFeed />);
    await userEvent.click(screen.getByTitle('Modo mural (tela cheia)'));
    await userEvent.click(await screen.findByRole('combobox'));
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByTitle('Sair do modo mural (Esc)')).toBeInTheDocument();
  });
});
