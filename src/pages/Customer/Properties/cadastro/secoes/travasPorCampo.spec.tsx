// Imóvel do site: cada seção trava só os campos que o leitor da fonte preenche.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { PropertyFormData } from '@/services/properties/propertiesService';

const svc = vi.hoisted(() => ({ cepLookup: vi.fn(), geocode: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...svc } };
});
vi.mock('./MapaDoCadastro', () => ({
  default: ({ travado }: { travado?: boolean }) => <div data-testid="mapa" data-travado={String(!!travado)} />,
}));

import { CamposTravadosContext } from '@/features/properties/cadastro/travasDoSite';
import SecaoBasico from './SecaoBasico';
import SecaoLocalizacao from './SecaoLocalizacao';
import SecaoValores from './SecaoValores';
import SecaoComposicao from './SecaoComposicao';
import SecaoDetalhesDaVenda from './SecaoDetalhesDaVenda';
import SecaoCaracteristicas from './SecaoCaracteristicas';
import SecaoDescricao from './SecaoDescricao';
import SecaoComissao from './SecaoComissao';

// O que cada leitor do servidor trava (nomes de coluna, como o servidor manda).
const LISTA_COMBINADA = ['title', 'description', 'property_type', 'category_type', 'transaction_type', 'sale_price', 'appraisal_value',
  'occupancy', 'accepts_financing', 'bedrooms', 'parking_spaces', 'useful_area_m2', 'address_neighborhood', 'address_city',
  'address_state', 'status', 'features', 'condo_features'];
const VRSYNC = ['title', 'description', 'transaction_type', 'sale_price', 'rent_price', 'condo_fee', 'iptu', 'iptu_period',
  'useful_area_m2', 'total_area_m2', 'bedrooms', 'bathrooms', 'suites', 'parking_spaces', 'address_cep', 'address_street',
  'address_number', 'address_neighborhood', 'address_city', 'address_state', 'latitude', 'longitude', 'property_type',
  'category_type', 'features', 'condo_features', 'status', 'video_url'];

const form = {
  title: 'Apê', transaction_type: 'sale', category_type: 'residential', property_type: 'apartment', status: 'active', stage: 'ready',
  listing_kind: 'resale', description: 'texto', address_zip: '', address_street: 'Rua A', address_number: '1',
  address_neighborhood: 'Centro', address_city: 'Campinas', address_state: 'SP', latitude: -22.9, longitude: -47.0,
} as PropertyFormData;

const comTravas = (travados: string[], ui: ReactNode) =>
  render(<CamposTravadosContext.Provider value={travados}>{ui}</CamposTravadosContext.Provider>);

describe('Lista combinada (Leilão): trava só o que o site manda', () => {
  it('Localização: rua, número e CEP livres; bairro, cidade e UF travados; alfinete livre', async () => {
    comTravas(LISTA_COMBINADA, <SecaoLocalizacao form={form} setF={vi.fn()} editando={null} />);
    expect(screen.getByLabelText('CEP')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled();
    expect(screen.getByLabelText('Rua')).toBeEnabled();
    expect(screen.getByLabelText('Número')).toBeEnabled();
    expect(screen.getByLabelText('Complemento')).toBeEnabled();
    expect(screen.getByLabelText('Bairro')).toBeDisabled();
    expect(screen.getByLabelText('Cidade')).toBeDisabled();
    expect(screen.getByLabelText('Estado (UF)')).toBeDisabled();
    expect(await screen.findByTestId('mapa')).toHaveAttribute('data-travado', 'false');
    expect(screen.getByLabelText('Bairro').closest('[title]')).toHaveAttribute('title', expect.stringMatching(/site da imobiliária/));
  });

  it('Localização: o CEP preenche a rua, mas não troca o bairro e a cidade que vêm do site', async () => {
    svc.cepLookup.mockResolvedValue({ address_street: 'Rua Nova', address_neighborhood: 'Outro', address_city: 'Outra', address_state: 'RJ' });
    svc.geocode.mockResolvedValue({ failed: true });
    const setF = vi.fn();
    comTravas(LISTA_COMBINADA, <SecaoLocalizacao form={{ ...form, address_zip: '13010-000' }} setF={setF} editando={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(setF).toHaveBeenCalledWith({ address_street: 'Rua Nova' }));
  });

  it('Composição: banheiros, suítes e área total livres; quartos, vagas e área útil travados', () => {
    comTravas(LISTA_COMBINADA, <SecaoComposicao form={form} setF={vi.fn()} editando={null} />);
    expect(screen.getByLabelText('Banheiros')).toBeEnabled();
    expect(screen.getByLabelText('Suítes')).toBeEnabled();
    expect(screen.getByLabelText('Área total (m²)')).toBeEnabled();
    expect(screen.getByLabelText('Ano de construção')).toBeEnabled();
    expect(screen.getByLabelText('Quartos')).toBeDisabled();
    expect(screen.getByLabelText('Vagas')).toBeDisabled();
    expect(screen.getByLabelText('Área útil (m²)')).toBeDisabled();
  });

  it('Valores: condomínio e IPTU livres; venda, avaliação e ocupação travados', () => {
    comTravas(LISTA_COMBINADA, <SecaoValores form={{ ...form, listing_kind: 'auction' }} setF={vi.fn()} editando={null} />);
    expect(screen.getByLabelText('Condomínio (R$/mês)')).toBeEnabled();
    expect(screen.getByLabelText('IPTU (R$)')).toBeEnabled();
    expect(screen.getByLabelText(/Valor de venda/)).toBeDisabled();
    expect(screen.getByLabelText('Valor de avaliação (R$)')).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Ocupado' })).toBeDisabled();
  });

  it('Detalhes da venda: só o financiamento trava; FGTS, MCMV, padrão e exclusividade livres', () => {
    comTravas(LISTA_COMBINADA, <SecaoDetalhesDaVenda form={form} setF={vi.fn()} editando={null} />);
    expect(within(screen.getByRole('radiogroup', { name: 'Aceita financiamento' })).getByRole('radio', { name: 'Sim' })).toBeDisabled();
    expect(within(screen.getByRole('radiogroup', { name: 'Aceita FGTS' })).getByRole('radio', { name: 'Sim' })).toBeEnabled();
    expect(within(screen.getByRole('radiogroup', { name: 'Minha Casa Minha Vida' })).getByRole('radio', { name: 'Sim' })).toBeEnabled();
    expect(screen.getByRole('checkbox')).toBeEnabled();
  });

  it('Características: as do imóvel e as do condomínio travadas', () => {
    comTravas(LISTA_COMBINADA, <SecaoCaracteristicas form={{ ...form, features: [], condo_features: [] }} setF={vi.fn()} editando={null} />);
    const botoes = screen.getAllByRole('button');
    expect(botoes.length).toBeGreaterThan(0);
    botoes.forEach(b => expect(b).toBeDisabled());
  });
});

describe('VRSync: o site manda quase tudo', () => {
  it('Básico: título, finalidade, tipo e situação travados', () => {
    comTravas(VRSYNC, <SecaoBasico form={form} setF={vi.fn()} editando={null} />);
    expect(screen.getByLabelText('Título')).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Venda' })).toBeDisabled();
    screen.getAllByRole('combobox').forEach(c => expect(c).toBeDisabled());
  });

  it('Descrição travada e sem o Gerar com IA (que reescreveria por cima)', () => {
    comTravas(VRSYNC, <SecaoDescricao form={form} setF={vi.fn()} editando={null} podeGerar gerando={false} aoGerar={vi.fn()} />);
    expect(screen.getByLabelText('Descrição')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Gerar descrição/ })).toBeNull();
  });

  it('Valores: valor de venda travado', () => {
    comTravas(VRSYNC, <SecaoValores form={form} setF={vi.fn()} editando={null} />);
    expect(screen.getByLabelText(/Valor de venda/)).toBeDisabled();
    expect(screen.getByLabelText('Condomínio (R$/mês)')).toBeDisabled();
  });

  it('Localização: endereço inteiro e alfinete travados; complemento livre', async () => {
    comTravas(VRSYNC, <SecaoLocalizacao form={form} setF={vi.fn()} editando={null} />);
    expect(screen.getByLabelText('CEP')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();
    expect(screen.getByLabelText('Rua')).toBeDisabled();
    expect(screen.getByLabelText('Complemento')).toBeEnabled();
    expect(await screen.findByTestId('mapa')).toHaveAttribute('data-travado', 'true');
    expect(screen.getByText('O ponto no mapa vem do site da imobiliária.')).toBeInTheDocument();
  });

  it('Comissão nunca trava', () => {
    comTravas(VRSYNC, <SecaoComissao form={form} setF={vi.fn()} editando={null} />);
    expect(screen.getByLabelText('Percentual')).toBeEnabled();
  });
});

describe('sem fonte ligada (lista vazia)', () => {
  it('nada trava', () => {
    comTravas([], <SecaoBasico form={form} setF={vi.fn()} editando={null} />);
    expect(screen.getByLabelText('Título')).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'Venda' })).toBeEnabled();
  });
});
