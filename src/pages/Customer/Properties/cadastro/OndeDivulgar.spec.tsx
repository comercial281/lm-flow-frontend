import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const portais = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), updatePublications: vi.fn(), updatePublicationsLegacy: vi.fn() }));
const imoveis = vi.hoisted(() => ({ update: vi.fn() }));
const avisos = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('sonner', () => ({ toast: avisos }));
vi.mock('@/services/portals/portalsService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/portals/portalsService')>();
  return { ...real, portalsService: { ...real.portalsService, ...portais } };
});
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...imoveis } };
});
import OndeDivulgar from './OndeDivulgar';

const imovel = { id: 'p1', code: 'AP1', title: 'Apê', listing_kind: 'resale', published_on_site: false } as never;
const zap = { portal_key: 'zap', name: 'ZAP', connected: true, is_enabled: true,
  ad_types: [{ key: 'standard', label: 'Simples', feed_value: 'S', base: true, limit: null, count: 3 },
             { key: 'premium', label: 'Destaque', feed_value: 'P', limit: 2, count: 2 }] };
const olx = { portal_key: 'olx', name: 'OLX', connected: false, is_enabled: false, ad_types: [] };

beforeEach(() => {
  vi.clearAllMocks();
  portais.list.mockResolvedValue([zap, olx]);
  portais.get.mockResolvedValue({ ...zap, publications: [{ property_id: 'x', ad_type: 'standard' }] });
  portais.updatePublications.mockResolvedValue({ ...zap, publications: [] });
});

const abrir = (modo: 'passo' | 'cartao' = 'passo', aoMudarImovel = vi.fn()) =>
  render(<MemoryRouter><OndeDivulgar imovel={imovel} modo={modo} aoMudarImovel={aoMudarImovel} /></MemoryRouter>);

describe('OndeDivulgar', () => {
  it('mostra só o conectado e resume o resto', async () => {
    abrir();
    expect(await screen.findByText('ZAP')).toBeInTheDocument();
    expect(screen.queryByText('OLX')).toBeNull();
    expect(screen.getByText(/Outros 1 portal/)).toBeInTheDocument();
  });

  it('ligar o portal publica sem tirar os outros imóveis', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('switch', { name: 'Publicar no ZAP' }));
    await waitFor(() => expect(portais.updatePublications).toHaveBeenCalledWith('zap',
      [{ property_id: 'x', ad_type: 'standard' }, { property_id: 'p1', ad_type: 'standard' }], expect.anything()));
  });

  it('tipo com cota cheia fica bloqueado', async () => {
    abrir();
    await userEvent.click(await screen.findByRole('switch', { name: 'Publicar no ZAP' }));
    const linha = screen.getByTestId('portal-zap');
    expect(within(linha).getByRole('option', { name: 'Destaque' })).toBeDisabled();
  });

  it('cota estourada no servidor avisa e volta a chave', async () => {
    portais.updatePublications.mockRejectedValue({ response: { data: { success: false, error: { code: 'AD_PLAN_EXCEEDED',
      message: 'x', details: { overflows: [{ key: 'premium', label: 'Destaque', limit: 2, count: 3, excess: 1 }] } } } } });
    abrir();
    const chave = await screen.findByRole('switch', { name: 'Publicar no ZAP' });
    await userEvent.click(chave);
    await waitFor(() => expect(avisos.error).toHaveBeenCalledWith(expect.stringContaining('Destaque: 3 de 2')));
    await waitFor(() => expect(chave).not.toBeChecked());
  });

  it('desligar tira só este imóvel', async () => {
    portais.get.mockResolvedValue({ ...zap, publications: [{ property_id: 'x', ad_type: 'standard' }, { property_id: 'p1', ad_type: 'premium' }] });
    abrir();
    await userEvent.click(await screen.findByRole('switch', { name: 'Publicar no ZAP' }));
    await waitFor(() => expect(portais.updatePublications).toHaveBeenCalledWith('zap',
      [{ property_id: 'x', ad_type: 'standard' }], expect.anything()));
  });

  it('portal sem tipos de anúncio usa o formato antigo', async () => {
    const velho = { portal_key: 'velho', name: 'Velho', connected: true, is_enabled: true };
    portais.list.mockResolvedValue([velho]);
    portais.get.mockResolvedValue({ ...velho, property_ids: ['x'], featured_property_ids: ['x'] });
    portais.updatePublicationsLegacy.mockResolvedValue({});
    abrir();
    await userEvent.click(await screen.findByRole('switch', { name: 'Publicar no Velho' }));
    await waitFor(() => expect(portais.updatePublicationsLegacy).toHaveBeenCalledWith('velho', ['x', 'p1'], ['x']));
  });

  it('sem portal conectado manda para Integrações', async () => {
    portais.list.mockResolvedValue([olx]);
    abrir();
    expect(await screen.findByText(/Nenhum portal conectado/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Integrações/ })).toHaveAttribute('href', '/settings/portals');
  });

  it('site grava na hora e avisa o pai', async () => {
    const atualizado = { ...imovel, published_on_site: true };
    imoveis.update.mockResolvedValue(atualizado);
    const aoMudar = vi.fn();
    abrir('passo', aoMudar);
    await userEvent.click(await screen.findByRole('switch', { name: 'Publicar no site' }));
    expect(imoveis.update).toHaveBeenCalledWith('p1', { published_on_site: true });
    await waitFor(() => expect(aoMudar).toHaveBeenCalledWith(atualizado));
  });

  it('erro ao gravar o site volta a chave', async () => {
    imoveis.update.mockRejectedValue(new Error('falhou'));
    abrir();
    const chave = await screen.findByRole('switch', { name: 'Publicar no site' });
    await userEvent.click(chave);
    await waitFor(() => expect(avisos.error).toHaveBeenCalled());
    await waitFor(() => expect(chave).not.toBeChecked());
  });

  it('modo passo tem Pular e Concluir; cartão não', async () => {
    abrir('passo');
    await screen.findByText('ZAP');
    expect(screen.getByRole('button', { name: 'Pular' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeInTheDocument();
  });

  it('cartão não tem Pular nem Concluir', async () => {
    abrir('cartao');
    await screen.findByText('ZAP');
    expect(screen.queryByRole('button', { name: 'Concluir' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pular' })).toBeNull();
  });
});
