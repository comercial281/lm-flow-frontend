import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ItemDeCampanha } from '@/services/campanhas/campanhasService';

const props = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: props.list } }));
import TabelaDeAnuncios from './TabelaDeAnuncios';

const anuncio = (extra: Partial<ItemDeCampanha> = {}): ItemDeCampanha => ({
  key: 'campaign:Moeda Forte', kind: 'campaign', label: 'Moeda Forte', form_config_id: null, link_id: null, keyword_rule: false, property_ids: [], sells_scope: null,
  sells_listing_kind: null, offer_condition: null, audience_intents: [], leads_count: 7, last_lead_at: null, ad_title: null, ad_body: null, campaign_name: 'Moeda Forte',
  match_kind: 'campaign', match_value: 'Moeda Forte', is_active: true, agents: [], ...extra,
});

beforeEach(() => { props.list.mockReset().mockResolvedValue({ data: [{ id: 'p1', title: 'Moeda Forte Mandaqui' }] }); });

describe('TabelaDeAnuncios', () => {
  it('sem oferta: selo e "Parece: <imóvel>"; com oferta: o que vende e nada de selo', async () => {
    render(<TabelaDeAnuncios podeEditar aoAbrir={vi.fn()} itens={[anuncio(), anuncio({ key: 'campaign:B', label: 'Campanha B', campaign_name: 'Campanha B', sells_scope: 'catalog' })]} />);
    const [semOferta, comOferta] = screen.getAllByTestId('linha-do-anuncio');
    expect(within(semOferta).getByText('Não diz o que oferece')).toBeInTheDocument();
    expect(await within(semOferta).findByText('Parece: Moeda Forte Mandaqui')).toBeInTheDocument();
    expect(within(comOferta).getByText('Todo o catálogo')).toBeInTheDocument();
    expect(within(comOferta).queryByText('Não diz o que oferece')).toBeNull();
  });

  it('busca de imóvel parecido falhando não derruba a linha', async () => {
    props.list.mockRejectedValue(new Error('500'));
    render(<TabelaDeAnuncios podeEditar aoAbrir={vi.fn()} itens={[anuncio()]} />);
    await waitFor(() => expect(props.list).toHaveBeenCalled());
    expect(screen.getByText('Não diz o que oferece')).toBeInTheDocument();
    expect(screen.queryByText(/Parece:/)).toBeNull();
  });

  it('clicar na linha e Editar abrem; só leitura vê Ver', () => {
    const aoAbrir = vi.fn();
    const { rerender } = render(<TabelaDeAnuncios podeEditar aoAbrir={aoAbrir} itens={[anuncio({ sells_scope: 'catalog' })]} />);
    fireEvent.click(screen.getByTestId('linha-do-anuncio'));
    fireEvent.click(screen.getByRole('button', { name: 'Editar Moeda Forte' }));
    expect(aoAbrir).toHaveBeenCalledTimes(2);
    rerender(<TabelaDeAnuncios podeEditar={false} aoAbrir={aoAbrir} itens={[anuncio({ sells_scope: 'catalog' })]} />);
    expect(screen.getByRole('button', { name: 'Ver Moeda Forte' })).toBeInTheDocument();
  });

  it('só anúncio sem nome de campanha: tudo recolhido, sem cabeçalho de tabela', () => {
    render(<TabelaDeAnuncios podeEditar aoAbrir={vi.fn()} itens={[anuncio({ key: 'ad:1', kind: 'ad', label: 'Anúncio 1', campaign_name: null, match_kind: 'ad' })]} />);
    expect(screen.queryByTestId('linha-do-anuncio')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /anúncio sem nome de campanha/ }));
    expect(screen.getByTestId('linha-do-anuncio')).toBeInTheDocument();
  });
});
