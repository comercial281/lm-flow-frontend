import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeadRoutingModal from './LeadRoutingModal';

vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: { getLabels: vi.fn().mockResolvedValue({ data: [{ id: 1, title: 'quente' }, { id: 2, title: 'frio' }] }) },
}));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: {
    getPipelines: vi.fn().mockResolvedValue({ data: [{ id: 'p1', name: 'Vendas' }] }),
    getPipelineStages: vi.fn().mockResolvedValue({ data: [] }),
  },
}));
vi.mock('@/services/capi/capiConfigService', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/capi/capiConfigService')>()),
  capiConfigService: { get: vi.fn().mockResolvedValue(null), testConnection: vi.fn() },
}));
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({
  roletaConfigService: { getAll: vi.fn().mockResolvedValue([]) },
  roletaLabel: (r: { name: string }) => r.name,
}));
vi.mock('@/services/landingPages/landingPageService', () => ({
  landingPageService: { saveRouting: vi.fn() },
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

const page = { id: 'lp1', title: 'Lançamento', settings: {} } as never;

describe('Roteamento de lead no computador', () => {
  it('a lista aberta continua aberta quando a janela redesenha', async () => {
    const props = { siteId: 's1', page, onClose: () => {}, onSaved: () => {} };
    const { rerender } = render(<LeadRoutingModal {...props} />);
    const tags = await screen.findAllByRole('combobox', { name: /Tag/ });
    await userEvent.click(tags[0]);
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    rerender(<LeadRoutingModal {...props} onSaved={() => {}} />);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: 'quente' }));
    expect(screen.getAllByRole('combobox', { name: /Tag/ })[0]).toHaveTextContent('quente');
  });
});
