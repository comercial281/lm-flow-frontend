// src/pages/Customer/Properties/lista/telaImoveis.spec.tsx
// A tela de Imóveis inteira, com o serviço de imóveis falso: abas com a
// contagem, aba padrão, troca de aba, aba vazia e a visão Mapa.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import type { Property } from '@/services/properties/propertiesService';

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  contarPorTipo: vi.fn(),
  facets: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
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
  default: ({ open, listingKind, onManual, onReview }: { open: boolean; listingKind?: string; onManual?: () => void; onReview?: (id: string) => void }) =>
    (open ? <div data-testid="lote">lote {listingKind}<button onClick={onManual}>Cadastrar à mão</button><button onClick={() => onReview?.('d1')}>Revisar d1</button></div> : null),
}));
vi.mock('@/services/propertyPhotos/propertyPhotosService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/propertyPhotos/propertyPhotosService')>();
  return { ...real, propertyPhotosService: { ...real.propertyPhotosService, list: () => Promise.resolve([]) } };
});
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

  it('Mostrar mais fica travado enquanto a lista recarrega com filtro novo', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 2 });
    svc.list.mockImplementation((p: Record<string, unknown>) =>
      (p['transaction_type[]']
        ? new Promise(() => {}) // a recarga com o filtro novo fica no ar
        : Promise.resolve(resposta([imovel({ id: 'a', code: 'AP1' })], 2))));
    abrir('/properties?aba=revenda');
    const mostrarMais = await screen.findByRole('button', { name: 'Mostrar mais' });
    expect(mostrarMais).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Venda' }));
    await waitFor(() => expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ 'transaction_type[]': ['sale', 'sale_rent'], page: 1 })));
    expect(screen.getByRole('button', { name: 'Mostrar mais' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    expect(svc.list).not.toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('com recorte da Dashboard não soma os cadastros da imobiliária', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 3 });
    abrir('/properties?recorte=sem_fotos');
    expect(await screen.findByRole('tab', { name: 'Revenda (3)' })).toBeInTheDocument();
    expect(screen.queryByText(/cadastros? na imobiliária/)).toBeNull();
    expect(svc.contarPorTipo).toHaveBeenCalledWith({ status: 'active', without_photos: '1' });
  });

  it('Cadastrar à mão na aba Empreendimentos abre o formulário de empreendimento', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 3 });
    abrir('/properties?aba=empreendimentos');
    fireEvent.click(await screen.findByRole('button', { name: /Novo empreendimento/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar à mão' }));
    expect(await screen.findByText('Fase da obra')).toBeInTheDocument();
    expect(screen.getByText('Previsão de entrega')).toBeInTheDocument();
    expect(screen.getByText('Tipologias do empreendimento')).toBeInTheDocument();
    expect(screen.getByText('Venda')).toBeInTheDocument();
  });

  it('Cadastrar à mão na aba Revenda esconde fase, previsão e tipologias', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 1, resale: 38 });
    abrir('/properties?aba=revenda');
    fireEvent.click(await screen.findByRole('button', { name: /Novo imóvel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar à mão' }));
    expect(await screen.findByText('Tipo de negócio')).toBeInTheDocument();
    expect(screen.queryByText('Fase da obra')).toBeNull();
    expect(screen.queryByText('Previsão de entrega')).toBeNull();
    expect(screen.queryByText('Tipologias do empreendimento')).toBeNull();
  });

  it('editar empreendimento salvo como locação mostra Valor de venda e a situação antiga', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 3 });
    svc.get.mockResolvedValue(imovel({ id: 'd1', listing_kind: 'development', transaction_type: 'rent', status: 'reserved' }));
    abrir('/properties?aba=empreendimentos');
    await screen.findByRole('button', { name: /Novo empreendimento/ });
    fireEvent.click(screen.getByRole('button', { name: /Novo empreendimento/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar d1' }));
    expect(await screen.findByText('Valor de venda (R$) *')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Reservado' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'À venda' })).toBeInTheDocument();
  });

  it('busca global (?aba=&q=) abre na aba do imóvel, já buscando', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 2, resale: 38 });
    abrir('/properties?aba=empreendimentos&q=EM0001');
    expect(await screen.findByRole('tab', { name: 'Empreendimentos (2)' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'development', q: 'EM0001' })));
    expect(svc.list).not.toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'resale' }));
    expect(screen.getByRole('textbox', { name: 'Buscar' })).toHaveValue('EM0001');
  });

  it('visão Mapa esconde busca, filtros e ordem e não recarrega a lista', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 2, resale: 1 });
    abrir('/properties?visao=mapa');
    expect(await screen.findByTestId('mapa')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Empreendimentos (2)' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Buscar' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Filtros/ })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Ordenar' })).toBeNull();
    expect(svc.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'development', page: 1 })));
    expect(screen.getByRole('textbox', { name: 'Buscar' })).toBeInTheDocument();
  });

  it('previsão de entrega em mês e ano: dez + 2027 salva 2027-12', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 3 });
    svc.create.mockResolvedValue(imovel({ id: 'n1', listing_kind: 'development' }));
    abrir('/properties?aba=empreendimentos');
    fireEvent.click(await screen.findByRole('button', { name: /Novo empreendimento/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar à mão' }));
    fireEvent.change(await screen.findByRole('combobox', { name: 'Mês da previsão de entrega' }), { target: { value: '12' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Ano da previsão de entrega' }), { target: { value: '2027' } });
    fireEvent.change(screen.getByPlaceholderText('450000'), { target: { value: '389900' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Apartamento 3 quartos - Jardim Europa'), { target: { value: 'Vista Taquaral' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar e enviar fotos' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ delivery_forecast: '2027-12', stage: 'launch' })));
  });

  it('só o mês, sem ano, não é previsão', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 3 });
    svc.create.mockResolvedValue(imovel({ id: 'n1', listing_kind: 'development' }));
    abrir('/properties?aba=empreendimentos');
    fireEvent.click(await screen.findByRole('button', { name: /Novo empreendimento/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar à mão' }));
    const mes = await screen.findByRole('combobox', { name: 'Mês da previsão de entrega' });
    fireEvent.change(mes, { target: { value: '12' } });
    expect(mes).toHaveValue('12');
    fireEvent.change(screen.getByPlaceholderText('450000'), { target: { value: '389900' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Apartamento 3 quartos - Jardim Europa'), { target: { value: 'Vista Taquaral' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar e enviar fotos' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ delivery_forecast: null })));
  });

  it('fechar as fotos relê só aquele imóvel, sem voltar à página 1', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 1 });
    svc.list.mockResolvedValue(resposta([imovel({ id: 'r1', code: 'AP0461', cover_photo_url: null })], 1));
    svc.get.mockResolvedValue(imovel({ id: 'r1', code: 'AP0461', cover_photo_url: null, address_neighborhood: 'Taquaral' }));
    abrir('/properties?aba=revenda');
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar fotos' }));
    const chamadas = svc.list.mock.calls.length;
    fireEvent.click(await screen.findByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(svc.get).toHaveBeenCalledWith('r1'));
    expect(await screen.findByText('Taquaral · Apartamento')).toBeInTheDocument();
    expect(svc.list.mock.calls.length).toBe(chamadas);
  });

  it('excluir usa Excluir, não Remover', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 1 });
    abrir('/properties?aba=revenda');
    await userEvent.click(await screen.findByRole('button', { name: 'Ações do AP0461' }));
    await userEvent.click(await screen.findByText('Excluir'));
    expect(await screen.findByText('Excluir imóvel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    expect(screen.queryByText('Remover imóvel')).toBeNull();
  });
});
