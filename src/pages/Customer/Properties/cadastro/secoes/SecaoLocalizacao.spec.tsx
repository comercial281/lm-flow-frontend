import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const svc = vi.hoisted(() => ({ cepLookup: vi.fn(), geocode: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...svc } };
});
vi.mock('./MapaDoCadastro', () => ({
  default: ({ lat, lng, aoArrastar }: { lat: number | null; lng: number | null; aoArrastar: (a: number, b: number) => void }) => (
    <div data-testid="mapa">{lat},{lng}<button onClick={() => aoArrastar(-1, -2)}>arrastar</button></div>
  ),
}));
import SecaoLocalizacao from './SecaoLocalizacao';

const base = { title: '', transaction_type: 'sale', category_type: 'residential', property_type: 'house', status: 'active', stage: 'ready', listing_kind: 'resale' as const };

function montar(form: Record<string, unknown>) {
  let atual = { ...base, ...form } as never;
  const setF = vi.fn((m: unknown) => { atual = { ...(atual as object), ...(typeof m === 'function' ? (m as (p: unknown) => object)(atual) : (m as object)) } as never; });
  const r = render(<SecaoLocalizacao form={atual} setF={setF} editando={null} />);
  return { setF, rerender: () => r.rerender(<SecaoLocalizacao form={atual} setF={setF} editando={null} />), get: () => atual as Record<string, unknown> };
}

beforeEach(() => { vi.clearAllMocks(); svc.geocode.mockResolvedValue({ lat: -22.9, lng: -47.06, precision: 'number' }); });
afterEach(() => { vi.useRealTimers(); });

describe('SecaoLocalizacao', () => {
  it('CEP preenche e procura o ponto', async () => {
    svc.cepLookup.mockResolvedValue({ address_street: 'Rua Barão de Jaguara', address_neighborhood: 'Centro', address_city: 'Campinas', address_state: 'SP' });
    const m = montar({ address_number: '1481' });
    await userEvent.type(screen.getByLabelText('CEP'), '13015-002');
    await userEvent.tab();
    await waitFor(() => expect(m.get()).toMatchObject({ address_street: 'Rua Barão de Jaguara', address_city: 'Campinas', latitude: -22.9, longitude: -47.06, location_source: 'auto' }));
  });

  it('CEP incompleto não chama o servidor', async () => {
    montar({});
    await userEvent.type(screen.getByLabelText('CEP'), '1301500');
    await userEvent.tab();
    expect(svc.cepLookup).not.toHaveBeenCalled();
  });

  it('CEP não encontrado avisa', async () => {
    svc.cepLookup.mockRejectedValue({ response: { status: 404 } });
    montar({});
    await userEvent.type(screen.getByLabelText('CEP'), '99999999');
    await userEvent.tab();
    expect(await screen.findByText('CEP não encontrado')).toBeInTheDocument();
  });

  it('arrastar marca manual e o alfinete não pula quando o endereço muda', async () => {
    const m = montar({ address_street: 'Rua A', address_number: '1', address_city: 'Campinas', address_state: 'SP', latitude: -22.9, longitude: -47.06, location_source: 'auto' });
    // O mapa é carregado sob demanda (lazy): aparece um instante depois.
    await userEvent.click(await screen.findByRole('button', { name: 'arrastar' }));
    expect(m.get()).toMatchObject({ latitude: -1, longitude: -2, location_source: 'manual' });
    m.rerender();
    svc.geocode.mockClear();
    await userEvent.clear(screen.getByLabelText('Número'));
    await userEvent.type(screen.getByLabelText('Número'), '99');
    await userEvent.tab();
    m.rerender();
    expect(svc.geocode).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Reposicionar pelo endereço' }));
    await waitFor(() => expect(m.get()).toMatchObject({ location_source: 'auto', latitude: -22.9 }));
  });

  it('não achou: aviso honesto e nada de erro', async () => {
    svc.geocode.mockResolvedValue({ lat: null, lng: null, precision: null });
    montar({ address_street: 'Rua Inexistente', address_number: '1', address_city: 'Campinas', address_state: 'SP' });
    await userEvent.click(screen.getByLabelText('Número'));
    await userEvent.tab();
    expect(await screen.findByText('Não achamos o endereço. Arraste o alfinete até o imóvel.')).toBeInTheDocument();
  });

  it('serviço ocupado: tenta de novo em silêncio depois de 1,5 s e aplica o ponto', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    svc.geocode
      .mockResolvedValueOnce({ lat: null, lng: null, precision: null, failed: true })
      .mockResolvedValueOnce({ lat: -22.9, lng: -47.06, precision: 'number', failed: false });
    const m = montar({ address_street: 'Rua A', address_number: '1', address_city: 'Campinas', address_state: 'SP' });
    await userEvent.click(screen.getByLabelText('Número'));
    await userEvent.tab();
    await waitFor(() => expect(svc.geocode).toHaveBeenCalledTimes(1));
    expect(m.get().latitude).toBeUndefined();
    await act(() => vi.advanceTimersByTimeAsync(1500));
    await waitFor(() => expect(m.get()).toMatchObject({ latitude: -22.9, longitude: -47.06, location_source: 'auto' }));
    expect(svc.geocode).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Achamos pelo endereço. Arraste o alfinete se precisar ajustar.')).toBeInTheDocument();
  });

  it('serviço ocupado duas vezes: fica como não achado e mantém o ponto atual', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const m = montar({ address_street: 'Rua A', address_number: '1', address_city: 'Campinas', address_state: 'SP', latitude: -22.8, longitude: -47.1, location_source: 'auto' });
    svc.geocode.mockResolvedValue({ lat: null, lng: null, precision: null, failed: true });
    await userEvent.clear(screen.getByLabelText('Número'));
    await userEvent.type(screen.getByLabelText('Número'), '2');
    m.rerender();
    await userEvent.tab();
    await waitFor(() => expect(svc.geocode).toHaveBeenCalledTimes(1));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(await screen.findByText('Não achamos o endereço. Arraste o alfinete até o imóvel.')).toBeInTheDocument();
    expect(svc.geocode).toHaveBeenCalledTimes(2);
    expect(m.get()).toMatchObject({ latitude: -22.8, longitude: -47.1, location_source: 'auto' });
    expect(screen.getByTestId('mapa')).toHaveTextContent('-22.8,-47.1');
  });

  it('revenda avisa da região; empreendimento não', () => {
    montar({ address_city: 'Campinas', address_street: 'Rua A', latitude: -22.9, longitude: -47.06 });
    expect(screen.getByText('No site e nos portais aparece só a região, não o endereço exato.')).toBeInTheDocument();
  });

  it('empreendimento não tem a linha da região', () => {
    montar({ listing_kind: 'development', address_city: 'Campinas', address_street: 'Rua A', latitude: -22.9, longitude: -47.06 });
    expect(screen.queryByText('No site e nos portais aparece só a região, não o endereço exato.')).toBeNull();
  });

  it('sem endereço pede pra preencher e sem campos de latitude', () => {
    montar({});
    expect(screen.getByText('Preencha o endereço para marcar o imóvel no mapa.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Latitude/)).toBeNull();
  });

  it('ponto já salvo: aviso pela origem, e nenhum aviso no ponto antigo sem origem', async () => {
    const auto = montar({ address_city: 'Campinas', address_street: 'Rua A', latitude: -22.9, longitude: -47.06, location_source: 'auto' });
    expect(await screen.findByText('Achamos pelo endereço. Arraste o alfinete se precisar ajustar.')).toBeInTheDocument();
    auto.setF({ location_source: 'manual' });
    auto.rerender();
    expect(screen.getByText('Posição ajustada à mão.')).toBeInTheDocument();
    auto.setF({ location_source: null });
    auto.rerender();
    expect(screen.queryByText('Posição ajustada à mão.')).toBeNull();
    expect(screen.queryByText(/Achamos|Não achamos/)).toBeNull();
  });

  it('rótulos ligados aos campos do endereço', () => {
    montar({});
    for (const rotulo of ['CEP', 'Rua', 'Número', 'Complemento', 'Bairro', 'Cidade', 'Estado (UF)']) {
      expect(screen.getByLabelText(rotulo)).toBeInTheDocument();
    }
  });
});
