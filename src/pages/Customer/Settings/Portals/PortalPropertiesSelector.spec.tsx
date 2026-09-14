import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalPropertiesSelector from './PortalPropertiesSelector';
import type { PortalAdType } from '@/services/portals/portalsService';

const list = vi.fn();
const updatePublications = vi.fn();
const updatePublicationsLegacy = vi.fn();

vi.mock('@/services/properties/propertiesService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/services/properties/propertiesService',
  );
  return {
    ...actual,
    propertiesService: { list: (...a: unknown[]) => list(...a) },
  };
});

vi.mock('@/services/portals/portalsService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/services/portals/portalsService',
  );
  return {
    ...actual,
    portalsService: {
      updatePublications: (...a: unknown[]) => updatePublications(...a),
      updatePublicationsLegacy: (...a: unknown[]) => updatePublicationsLegacy(...a),
    },
  };
});

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const imovel = (id: string) => ({
  id,
  code: `COD-${id}`,
  title: `Imóvel ${id}`,
  transaction_type: 'sale',
  address_neighborhood: 'Centro',
  address_city: 'Indaiatuba',
});

const tipos: PortalAdType[] = [
  { key: 'standard', label: 'Padrão', feed_value: 'STANDARD', limit: null, count: 0 },
  { key: 'premium', label: 'Destaque', feed_value: 'PREMIUM', limit: 1, count: 0 },
];

const erro422 = (overflows: unknown[]) => ({
  response: {
    status: 422,
    data: {
      success: false,
      error: { code: 'AD_PLAN_EXCEEDED', message: 'x', details: { overflows } },
    },
  },
});

/**
 * Tipo de anúncio por imóvel, com cota do plano. A regra do dono (2026-09-14):
 * estourar AVISA e pede confirmação, nunca trava. O que estes exemplos travam
 * é a sequência clique → pergunta → só então a requisição confirmada.
 */
describe('PortalPropertiesSelector — tipo de anúncio e cota', () => {
  beforeEach(() => {
    [list, updatePublications, updatePublicationsLegacy, toastError].forEach(m => m.mockReset());
    list.mockResolvedValue({ data: [imovel('a'), imovel('b')] });
    updatePublications.mockResolvedValue({});
  });

  const montar = (adTypes: PortalAdType[], pubs: Array<{ property_id: string; ad_type: string }> = []) =>
    render(
      <PortalPropertiesSelector
        portalKey="portal_zap"
        adTypes={adTypes}
        initialPublications={pubs}
        supportsHighlight
      />,
    );

  it('mostra o seletor de tipo só no imóvel marcado, e só com mais de um tipo', async () => {
    montar(tipos, [{ property_id: 'a', ad_type: 'standard' }]);
    await screen.findByText('Imóvel a');

    expect(screen.getByRole('combobox', { name: 'Tipo de anúncio de COD-a' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Tipo de anúncio de COD-b' })).toBeNull();
    // Estrela de destaque é só do modo legado.
    expect(screen.queryByTitle('Destacar neste portal')).toBeNull();
  });

  it('com um tipo só não há seletor — não existe o que escolher', async () => {
    montar([tipos[0]], [{ property_id: 'a', ad_type: 'standard' }]);
    await screen.findByText('Imóvel a');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByTestId('contador-standard')).toHaveTextContent('Padrão');
  });

  it('o contador fica vermelho quando passa da cota, e o Salvar continua habilitado', async () => {
    const usuario = userEvent.setup();
    montar(tipos, [{ property_id: 'a', ad_type: 'premium' }]);
    await screen.findByText('Imóvel a');

    expect(screen.getByTestId('contador-premium')).toHaveTextContent('1 / 1');
    expect(screen.getByTestId('contador-premium').className).not.toContain('text-destructive');

    await usuario.click(screen.getByRole('checkbox', { name: 'Publicar COD-b' }));
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Tipo de anúncio de COD-b' }), 'premium');

    const chip = screen.getByTestId('contador-premium');
    expect(chip).toHaveTextContent('2 / 1');
    expect(chip.className).toContain('text-destructive');
    expect(screen.getByRole('button', { name: 'Salvar publicações' })).toBeEnabled();
  });

  it('com estouro, Salvar abre o diálogo e só envia confirmado depois do clique', async () => {
    const usuario = userEvent.setup();
    montar(tipos, [
      { property_id: 'a', ad_type: 'premium' },
      { property_id: 'b', ad_type: 'premium' },
    ]);
    await screen.findByText('Imóvel a');

    await usuario.click(screen.getByRole('button', { name: 'Salvar publicações' }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Plano de anúncios estourado')).toBeInTheDocument();
    expect(within(dialogo).getByText('Destaque: 2 de 1 — o portal rebaixa 1 imóvel para o tipo abaixo')).toBeInTheDocument();
    // Enquanto a pessoa não responde, NADA foi enviado.
    expect(updatePublications).not.toHaveBeenCalled();

    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar mesmo assim' }));

    await waitFor(() => expect(updatePublications).toHaveBeenCalledTimes(1));
    expect(updatePublications).toHaveBeenCalledWith(
      'portal_zap',
      [
        { property_id: 'a', ad_type: 'premium' },
        { property_id: 'b', ad_type: 'premium' },
      ],
      { confirmOverflow: true },
    );
  });

  it('cancelar o diálogo não envia nada', async () => {
    const usuario = userEvent.setup();
    montar(tipos, [
      { property_id: 'a', ad_type: 'premium' },
      { property_id: 'b', ad_type: 'premium' },
    ]);
    await screen.findByText('Imóvel a');

    await usuario.click(screen.getByRole('button', { name: 'Salvar publicações' }));
    const dialogo = await screen.findByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(updatePublications).not.toHaveBeenCalled();
  });

  it('sem estouro envia direto, sem confirmação', async () => {
    const usuario = userEvent.setup();
    montar(tipos, [{ property_id: 'a', ad_type: 'premium' }]);
    await screen.findByText('Imóvel a');

    await usuario.click(screen.getByRole('button', { name: 'Salvar publicações' }));

    await waitFor(() => expect(updatePublications).toHaveBeenCalledTimes(1));
    expect(updatePublications).toHaveBeenCalledWith(
      'portal_zap',
      [{ property_id: 'a', ad_type: 'premium' }],
      { confirmOverflow: false },
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('422 AD_PLAN_EXCEEDED do servidor reabre o diálogo com as linhas DELE e reenvia confirmado', async () => {
    const usuario = userEvent.setup();
    // Na tela a cota parece respeitada (1 de 1); o servidor, com outra conta,
    // recusa. As linhas do diálogo são as do servidor.
    updatePublications
      .mockRejectedValueOnce(erro422([{ key: 'premium', label: 'Destaque', limit: 0, count: 1, excess: 1 }]))
      .mockResolvedValueOnce({});
    montar(tipos, [{ property_id: 'a', ad_type: 'premium' }]);
    await screen.findByText('Imóvel a');

    await usuario.click(screen.getByRole('button', { name: 'Salvar publicações' }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Destaque: 1 de 0 — o portal rebaixa 1 imóvel para o tipo abaixo')).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();

    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar mesmo assim' }));

    await waitFor(() => expect(updatePublications).toHaveBeenCalledTimes(2));
    expect(updatePublications).toHaveBeenLastCalledWith(
      'portal_zap',
      [{ property_id: 'a', ad_type: 'premium' }],
      { confirmOverflow: true },
    );
  });

  it('outro erro do servidor vira toast com a mensagem dele (recusa por cargo inclusa)', async () => {
    const usuario = userEvent.setup();
    updatePublications.mockRejectedValueOnce({
      response: { status: 403, data: { error: 'Seu cargo não permite esta ação' } },
    });
    montar(tipos, [{ property_id: 'a', ad_type: 'standard' }]);
    await screen.findByText('Imóvel a');

    await usuario.click(screen.getByRole('button', { name: 'Salvar publicações' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Seu cargo não permite esta ação'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Selecionar todos marca quem faltava no tipo base e preserva o tipo de quem já estava', async () => {
    const usuario = userEvent.setup();
    montar(tipos, [{ property_id: 'a', ad_type: 'premium' }]);
    await screen.findByText('Imóvel a');

    await usuario.click(screen.getByRole('button', { name: 'Selecionar todos' }));
    await usuario.click(screen.getByRole('button', { name: 'Salvar publicações' }));

    await waitFor(() => expect(updatePublications).toHaveBeenCalledTimes(1));
    expect(updatePublications.mock.calls[0][1]).toEqual([
      { property_id: 'a', ad_type: 'premium' },
      { property_id: 'b', ad_type: 'standard' },
    ]);
  });

  it('servidor antigo (sem tipos): estrela de destaque e envio no formato legado', async () => {
    const usuario = userEvent.setup();
    updatePublicationsLegacy.mockResolvedValue({});
    montar([], [{ property_id: 'a', ad_type: 'standard' }]);
    await screen.findByText('Imóvel a');

    expect(screen.queryByTestId('contadores-por-tipo')).toBeNull();
    // A estrela existe em toda linha (desabilitada em quem não está marcado); a primeira é a do imóvel `a`.
    await usuario.click(screen.getAllByTitle('Destacar neste portal')[0]);
    await usuario.click(screen.getByRole('button', { name: 'Salvar publicações' }));

    await waitFor(() => expect(updatePublicationsLegacy).toHaveBeenCalledWith('portal_zap', ['a'], ['a']));
    expect(updatePublications).not.toHaveBeenCalled();
  });
});
