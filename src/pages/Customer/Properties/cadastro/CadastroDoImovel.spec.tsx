import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const svc = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...svc } };
});
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));
vi.mock('@/services/contacts/labelsService', () => ({ labelsService: { getLabels: () => Promise.resolve({ data: [] }) } }));
vi.mock('@/services/users/usersService', () => ({ default: { getUsers: () => Promise.resolve({ data: [] }) } }));
vi.mock('@/services/propertyOwners/propertyOwnersService', () => ({ propertyOwnersService: { list: () => Promise.resolve({ data: [], meta: { total: 0 } }) } }));

import CadastroDoImovel from './CadastroDoImovel';

function Onde() { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; }
// O endereço fica sempre à vista (fora das rotas): depois de "Criar" a página
// vai para /properties/:id/editar, que é ela mesma de novo.
function abrir(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/properties/new" element={<CadastroDoImovel />} />
    <Route path="/properties/:id/editar" element={<CadastroDoImovel />} />
    <Route path="*" element={null} />
  </Routes><Onde /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom não tem IntersectionObserver nem scrollIntoView
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView = vi.fn();
  // Edição aberta sem imóvel combinado no teste fica carregando.
  svc.get.mockReturnValue(new Promise(() => {}));
});

describe('CadastroDoImovel', () => {
  it('empreendimento novo: título, índice do tipo e botões da criação', async () => {
    abrir('/properties/new?tipo=empreendimento');
    expect(await screen.findByRole('heading', { name: 'Novo empreendimento' })).toBeInTheDocument();
    const indice = screen.getByRole('navigation', { name: 'Seções do cadastro' });
    expect(indice).toHaveTextContent('Construtora');
    expect(indice).not.toHaveTextContent('Proprietário');
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' })).toBeInTheDocument();
  });

  it('criar sem título rola até Básico e não chama o servidor', async () => {
    abrir('/properties/new?tipo=revenda');
    await userEvent.click(await screen.findByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    expect(svc.create).not.toHaveBeenCalled();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Básico' })).toHaveAttribute('aria-current', 'true');
  });

  it('criar com sucesso vai para o passo de divulgar', async () => {
    svc.create.mockResolvedValue({ id: 'n1', listing_kind: 'resale' });
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText('Título'), 'Casa no Cambuí');
    await userEvent.type(screen.getByLabelText('Valor de venda'), '500000');
    await userEvent.click(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties/n1/editar?passo=divulgar'));
  });

  it('salvar rascunho cria como draft e volta para a lista', async () => {
    svc.create.mockResolvedValue({ id: 'n2', listing_kind: 'resale' });
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText('Título'), 'Rascunho');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' })));
    expect(screen.getByTestId('onde')).toHaveTextContent('/properties?aba=revenda');
  });

  it('edição carrega, salva sem mudar o tipo e volta para o lote quando veio dele', async () => {
    svc.get.mockResolvedValue({ id: 'e1', code: 'AP1', title: 'Apê', transaction_type: 'sale', category_type: 'residential',
      property_type: 'apartment', status: 'active', stage: 'ready', listing_kind: 'resale', sale_price: 1, created_at: '', updated_at: '' });
    svc.update.mockResolvedValue({ id: 'e1', listing_kind: 'resale' });
    abrir('/properties/e1/editar?de=lote');
    expect(await screen.findByRole('heading', { name: 'Editar imóvel' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Seções do cadastro' })).toHaveTextContent('Onde divulgar');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('e1', expect.not.objectContaining({ listing_kind: expect.anything() })));
    expect(screen.getByTestId('onde')).toHaveTextContent('/properties?aba=revenda&importar=1');
  });

  it('cancelar com alteração pergunta antes', async () => {
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText('Título'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Sair sem salvar?')).toBeInTheDocument();
  });
});

// Vieram de telaImoveis.spec.tsx: eram da janela de cadastro, que virou esta página.
describe('CadastroDoImovel: campos por tipo (herdados da janela)', () => {
  it('empreendimento mostra fase da obra, previsão e tipologias', async () => {
    abrir('/properties/new?tipo=empreendimento');
    expect(await screen.findByText('Fase da obra')).toBeInTheDocument();
    expect(screen.getByText('Previsão de entrega')).toBeInTheDocument();
    expect(screen.getByText('Tipologias do empreendimento')).toBeInTheDocument();
  });

  it('revenda mostra o tipo de negócio e esconde fase, previsão e tipologias', async () => {
    abrir('/properties/new?tipo=revenda');
    expect(await screen.findByText('Tipo de negócio')).toBeInTheDocument();
    expect(screen.queryByText('Fase da obra')).toBeNull();
    expect(screen.queryByText('Previsão de entrega')).toBeNull();
    expect(screen.queryByText('Tipologias do empreendimento')).toBeNull();
  });

  it('editar empreendimento salvo como locação mostra Valor de venda e a situação antiga', async () => {
    svc.get.mockResolvedValue({ id: 'd1', code: 'EM1', title: 'Vista', transaction_type: 'rent', category_type: 'residential',
      property_type: 'apartment', status: 'reserved', stage: 'ready', listing_kind: 'development', created_at: '', updated_at: '' });
    abrir('/properties/d1/editar');
    expect(await screen.findByLabelText('Valor de venda')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Reservado' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'À venda' })).toBeInTheDocument();
  });

  it('previsão de entrega em mês e ano: dez + 2027 salva 2027-12', async () => {
    svc.create.mockResolvedValue({ id: 'n1', listing_kind: 'development' });
    abrir('/properties/new?tipo=empreendimento');
    fireEvent.change(await screen.findByRole('combobox', { name: 'Mês da previsão de entrega' }), { target: { value: '12' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Ano da previsão de entrega' }), { target: { value: '2027' } });
    fireEvent.change(screen.getByPlaceholderText('450000'), { target: { value: '389900' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Apartamento 3 quartos - Jardim Europa'), { target: { value: 'Vista Taquaral' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ delivery_forecast: '2027-12', stage: 'launch' })));
  });

  it('só o mês, sem ano, não é previsão', async () => {
    svc.create.mockResolvedValue({ id: 'n1', listing_kind: 'development' });
    abrir('/properties/new?tipo=empreendimento');
    const mes = await screen.findByRole('combobox', { name: 'Mês da previsão de entrega' });
    fireEvent.change(mes, { target: { value: '12' } });
    expect(mes).toHaveValue('12');
    fireEvent.change(screen.getByPlaceholderText('450000'), { target: { value: '389900' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Apartamento 3 quartos - Jardim Europa'), { target: { value: 'Vista Taquaral' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ delivery_forecast: null })));
  });

  it('tipologia em branco não vai para o servidor', async () => {
    svc.create.mockResolvedValue({ id: 'n1', listing_kind: 'development' });
    abrir('/properties/new?tipo=empreendimento');
    await userEvent.click(await screen.findByRole('button', { name: /Adicionar tipologia/ }));
    fireEvent.change(screen.getByPlaceholderText('450000'), { target: { value: '389900' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Apartamento 3 quartos - Jardim Europa'), { target: { value: 'Vista Taquaral' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ typologies: [] })));
  });
});
