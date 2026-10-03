import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

const cap = vi.hoisted(() => ({ list: vi.fn(), approve: vi.fn(), reject: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('@/services/propertyCaptureRequests/propertyCaptureRequestsService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/propertyCaptureRequests/propertyCaptureRequestsService')>();
  return { ...real, propertyCaptureRequestsService: { ...real.propertyCaptureRequestsService, ...cap } };
});
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));
import NovasCaptacoes from './NovasCaptacoes';

function Onde() { return <p data-testid="onde">{useLocation().pathname}</p>; }
const pedido = { id: 'c1', status: 'received', source: 'site', transaction_type: 'sale', property_type: 'house',
  owner: { name: 'Maria', phone: '11999998888' }, address: { city: 'Campinas', state: 'SP' }, expected_price: 450000,
  photo_urls: [], created_at: new Date().toISOString(), updated_at: '' };

beforeEach(() => { vi.clearAllMocks(); cap.list.mockResolvedValue({ data: [pedido], meta: { total: 1 } }); });

const abrir = () => render(<MemoryRouter initialEntries={['/property-owners?aba=captacoes']}><Routes>
  <Route path="/property-owners" element={<NovasCaptacoes />} />
  <Route path="*" element={<Onde />} />
</Routes></MemoryRouter>);

describe('NovasCaptacoes', () => {
  it('pede só os pendentes', async () => {
    abrir();
    await screen.findByText('Maria');
    expect(cap.list).toHaveBeenCalledWith(expect.objectContaining({ pending: 'true' }));
  });

  it('aprovar abre o cadastro do imóvel criado', async () => {
    cap.approve.mockResolvedValue({ property_id: 'p9' });
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar e cadastrar' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties/p9/editar'));
    expect(toasts.success).toHaveBeenCalledWith('Proprietário e imóvel criados. Complete o cadastro.');
  });

  it('erro ao aprovar mostra a mensagem do servidor e fica na lista', async () => {
    cap.approve.mockRejectedValue({ response: { status: 422, data: { error: 'Invalid', message: 'Pedido já recusado' } } });
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar e cadastrar' }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Pedido já recusado'));
    expect(screen.getByText('Maria')).toBeInTheDocument();
  });

  it('recusar exige motivo', async () => {
    cap.reject.mockResolvedValue({});
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Recusar' }));
    const enviar = screen.getByRole('button', { name: 'Recusar pedido' });
    expect(enviar).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Motivo'), 'fora da região');
    await userEvent.click(enviar);
    await waitFor(() => expect(cap.reject).toHaveBeenCalledWith('c1', 'fora da região'));
    expect(screen.queryByText('Maria')).toBeNull();
  });

  it('sem pedidos mostra o estado vazio', async () => {
    cap.list.mockResolvedValue({ data: [], meta: { total: 0 } });
    abrir();
    expect(await screen.findByText('Nenhuma captação nova')).toBeInTheDocument();
  });

  // Portado de PropertyCaptureRequests.recusa.spec (página antiga).
  it('403 mostra o aviso do cargo', async () => {
    cap.list.mockRejectedValue({ response: { status: 403 } });
    abrir();
    expect(await screen.findByText(NO_ACCESS_MESSAGE)).toBeInTheDocument();
  });

  it('queda de rede NÃO culpa o cargo', async () => {
    cap.list.mockRejectedValue(new Error('Network Error'));
    abrir();
    await waitFor(() => expect(cap.list).toHaveBeenCalled());
    await screen.findByText('Não deu pra carregar');
    expect(screen.queryByText(NO_ACCESS_MESSAGE)).not.toBeInTheDocument();
  });
});
