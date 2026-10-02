// src/pages/Customer/Properties/lista/telaImoveis.spec.tsx
// A tela de Imóveis inteira, com o serviço de imóveis falso: abas com a
// contagem, aba padrão, troca de aba, aba vazia e a visão Mapa.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Property } from '@/services/properties/propertiesService';

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  contarPorTipo: vi.fn(),
  facets: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...svc } };
});
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));
vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: { getLabels: () => Promise.resolve({ data: [] }) },
}));
vi.mock('@/services/users/usersService', () => ({
  default: { getUsers: () => Promise.resolve({ data: [] }) },
}));
// O lote com IA e o mapa têm testes próprios; aqui só importa que a tela os chama.
vi.mock('../PropertyImportDialog', () => ({
  default: ({ open, listingKind }: { open: boolean; listingKind?: string }) =>
    (open ? <div data-testid="lote">lote {listingKind}</div> : null),
}));
vi.mock('./VisaoMapa', () => ({
  default: ({ kind }: { kind: string }) => <div data-testid="mapa">mapa {kind}</div>,
}));

import Properties from '../Properties';

const imovel = (over: Partial<Property>): Property => ({
  id: '1', code: 'AP0461', title: 'Apartamento', transaction_type: 'sale', category_type: 'residential',
  property_type: 'apartment', status: 'active', stage: 'ready', created_at: '2026-10-01',
  updated_at: new Date().toISOString(), listing_kind: 'resale', address_neighborhood: 'Cambuí', ...over,
} as Property);

const resposta = (data: Property[], total = data.length) => ({ data, meta: { total, page: 1, per_page: 50 } });

function abrir(endereco = '/properties') {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Properties />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  svc.facets.mockResolvedValue({ neighborhoods: [], property_types: [], captors: [] });
  svc.list.mockImplementation(async (p: { listing_kind: string }) =>
    (p.listing_kind === 'resale'
      ? resposta([imovel({ id: 'r1', code: 'AP0461' })], 38)
      : resposta([imovel({ id: 'd1', code: 'EM0001', title: 'Vista Taquaral', listing_kind: 'development' })], 12)));
});

describe('Tela de Imóveis', () => {
  it('mostra as abas com a contagem e abre na aba com mais cadastros', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 38 });
    abrir();
    expect(await screen.findByRole('tab', { name: 'Revenda (38)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Empreendimentos (12)' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('50 cadastros na imobiliária')).toBeInTheDocument();
    await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'resale', page: 1 })));
    expect(svc.list).not.toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'development' }));
    expect(await screen.findByText('38 imóveis de revenda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo imóvel/ })).toBeInTheDocument();
  });

  it('não desenha as abas antes de saber a aba padrão', async () => {
    let soltar: (c: { development: number; resale: number }) => void = () => {};
    svc.contarPorTipo.mockReturnValue(new Promise(r => { soltar = r; }));
    abrir();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(svc.list).not.toHaveBeenCalled();
    soltar({ development: 5, resale: 1 });
    expect(await screen.findByRole('tab', { name: 'Empreendimentos (5)' })).toHaveAttribute('aria-selected', 'true');
  });

  it('trocar de aba busca a lista do outro tipo e grava a aba no endereço', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 38 });
    abrir();
    fireEvent.click(await screen.findByRole('tab', { name: 'Empreendimentos (12)' }));
    await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'development', page: 1 })));
    expect(await screen.findByText('12 empreendimentos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo empreendimento/ })).toBeInTheDocument();
  });

  it('aba vazia convida a cadastrar o primeiro, já com o tipo no lote', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 3 });
    svc.list.mockImplementation(async (p: { listing_kind: string }) =>
      (p.listing_kind === 'resale' ? resposta([imovel({})], 3) : resposta([], 0)));
    abrir('/properties?aba=empreendimentos');
    expect(await screen.findByText('Você ainda não tem empreendimento cadastrado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar o primeiro empreendimento' }));
    expect(screen.getByTestId('lote')).toHaveTextContent('lote development');
  });

  it('filtro sem resultado não confunde com aba vazia', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 3 });
    svc.list.mockResolvedValue(resposta([], 0));
    abrir('/properties?aba=revenda&recorte=sem_fotos');
    expect(await screen.findByText('Nada encontrado')).toBeInTheDocument();
    expect(screen.queryByText('Você ainda não tem imóvel de revenda')).toBeNull();
  });

  it('erro de carga mostra Tentar de novo, não lista vazia', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 3 });
    svc.list.mockRejectedValue(new Error('rede'));
    abrir('/properties?aba=revenda');
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('?visao=mapa abre a visão Mapa da aba', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 2, resale: 1 });
    abrir('/properties?visao=mapa');
    expect(await screen.findByTestId('mapa')).toHaveTextContent('mapa development');
    expect(screen.getByRole('button', { name: 'Mapa' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Mostrar mais acrescenta a página 2 no fim da lista', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 2 });
    svc.list.mockImplementation(async (p: { page: number }) =>
      (p.page === 1 ? resposta([imovel({ id: 'a', code: 'AP1' })], 2) : resposta([imovel({ id: 'b', code: 'AP2' })], 2)));
    abrir('/properties?aba=revenda');
    fireEvent.click(await screen.findByRole('button', { name: 'Mostrar mais' }));
    expect(await screen.findByText('Mostrando 2 de 2')).toBeInTheDocument();
    expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });
});
