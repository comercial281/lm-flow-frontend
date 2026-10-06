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
const createForProperty = vi.fn().mockResolvedValue({ dto: { id: 'lp1' } });
const getOrCreateForProperty = vi.fn();
vi.mock('@/services/landingPages/landingPageService', () => ({
  landingPageService: {
    createForProperty: (...a: unknown[]) => createForProperty(...a),
    getOrCreateForProperty: (...a: unknown[]) => getOrCreateForProperty(...a),
  },
}));
vi.mock('@/services/landingPages/landingTemplatesService', () => ({ landingTemplatesService: { list: vi.fn().mockResolvedValue([]) } }));
const imoveis = vi.hoisted(() => ({ lista: [] as unknown[] }));
vi.mock('@/services/properties/propertiesService', () => ({
  propertiesService: { list: vi.fn().mockImplementation(async () => ({ data: imoveis.lista })) },
}));

beforeEach(() => {
  createForProperty.mockClear();
  getOrCreateForProperty.mockClear();
  imoveis.lista = [];
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

describe('Assistente: modelos prontos', () => {
  const tela = () => (
    <MemoryRouter><CreateLandingWizard siteId="s1" onClose={() => {}} /></MemoryRouter>
  );
  const apto = { id: 'im1', code: 'AP1', title: 'Apto Centro', transaction_type: 'rent', listing_kind: 'resale' };

  it('mostra os três modelos antes de Em branco', () => {
    render(tela());
    const nomes = ['Lançamento', 'Revenda', 'Aluguel', 'Em branco'].map((n) => screen.getByText(n));
    expect(nomes[2].compareDocumentPosition(nomes[3]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sem imóvel, o Próximo fica desligado com um modelo escolhido', async () => {
    imoveis.lista = [apto];
    render(tela());
    await userEvent.click(screen.getByText('Aluguel'));
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
    await userEvent.click(await screen.findByText('Apto Centro'));
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled();
  });

  it('cria com os blocos e o tema do modelo, sempre por createForProperty', async () => {
    imoveis.lista = [apto];
    render(tela());
    await userEvent.click(screen.getByText('Aluguel'));
    await userEvent.click(await screen.findByText('Apto Centro'));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: /Criar landing/ }));
    expect(getOrCreateForProperty).not.toHaveBeenCalled();
    expect(createForProperty).toHaveBeenCalledTimes(1);
    const [siteId, input] = createForProperty.mock.calls[0];
    expect(siteId).toBe('s1');
    expect(input.propertyId).toBe('im1');
    expect(input.blocks[0].type).toBe('hero');
    expect(input.theme.fontFamily).toContain('Nunito');
  });

  it('sugere o outro modelo sem trocar sozinho, e o Trocar troca', async () => {
    imoveis.lista = [apto];
    render(tela());
    await userEvent.click(screen.getByText('Lançamento'));
    await userEvent.click(await screen.findByText('Apto Centro'));
    expect(screen.getByText(/Este imóvel é de aluguel\. O modelo Aluguel combina mais\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trocar' }));
    expect(screen.queryByText(/combina mais/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: /Criar landing/ }));
    expect(createForProperty.mock.calls[0][1].theme.fontFamily).toContain('Nunito');
  });
});
