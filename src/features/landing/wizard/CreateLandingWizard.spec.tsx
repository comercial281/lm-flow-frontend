import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CreateLandingWizard from './CreateLandingWizard';

vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: { getLabels: vi.fn().mockResolvedValue({ data: [{ id: 1, title: 'quente' }] }) },
}));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: {
    getPipelines: vi.fn().mockResolvedValue({ data: [{ id: 'p1', name: 'Vendas' }] }),
    getPipelineStages: vi.fn().mockResolvedValue({ data: [{ id: 's1', name: 'Novo' }] }),
  },
}));
vi.mock('@/services/landingPages/landingPageService', () => ({ landingPageService: {} }));
vi.mock('@/services/landingPages/landingTemplatesService', () => ({ landingTemplatesService: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: vi.fn().mockResolvedValue({ data: [] }) } }));

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

describe('Assistente de landing no computador', () => {
  it('a lista do passo 3 continua aberta quando o assistente redesenha', async () => {
    const tela = (onClose: () => void) => (
      <MemoryRouter><CreateLandingWizard siteId="s1" onClose={onClose} /></MemoryRouter>
    );
    const { rerender } = render(tela(() => {}));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.type(screen.getByPlaceholderText(/Campanha Lançamento/), 'Teste');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('combobox', { name: /Tag/ }));
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    rerender(tela(() => {}));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: 'quente' }));
    expect(screen.getByRole('combobox', { name: /Tag/ })).toHaveTextContent('quente');
  });
});
