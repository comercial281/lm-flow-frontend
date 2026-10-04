import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

const svc = vi.hoisted(() => ({ cepLookup: vi.fn(), geocode: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...svc } };
});
vi.mock('./MapaDoCadastro', () => ({
  default: ({ lat, lng, zoom, aoArrastar }: { lat: number | null; lng: number | null; zoom: number; aoArrastar: (a: number, b: number) => void }) => (
    <div data-testid="mapa" data-zoom={zoom}>{lat},{lng}<button onClick={() => aoArrastar(-1, -2)}>arrastar</button></div>
  ),
}));
import SecaoLocalizacao from './SecaoLocalizacao';

const base = {
  title: '', transaction_type: 'sale', category_type: 'residential', property_type: 'house', status: 'active', stage: 'ready',
  listing_kind: 'resale' as const,
  address_zip: '', address_street: '', address_number: '', address_neighborhood: '', address_city: '', address_state: '',
};
const ENDERECO = { address_street: 'Rua A', address_number: '1', address_city: 'Campinas', address_state: 'SP' };

// O formulário mora num estado de verdade, como na página: cada setF re-renderiza a seção.
function montar(form: Record<string, unknown>) {
  const estado = { atual: { ...base, ...form } as Record<string, unknown> };
  const setF = vi.fn();
  function Casca() {
    const [f, setForm] = useState(estado.atual);
    setF.mockImplementation((m: unknown) => setForm(prev => {
      const novo = { ...prev, ...(typeof m === 'function' ? (m as (p: unknown) => object)(prev) : (m as object)) };
      estado.atual = novo;
      return novo;
    }));
    return <SecaoLocalizacao form={f as never} setF={setF} editando={null} />;
  }
  render(<Casca />);
  return { setF, mudar: (m: object) => act(() => { setF(m); }), get: () => estado.atual };
}

function adiado<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const PONTO = { lat: -22.9, lng: -47.06, precision: 'number', failed: false };
const NAO_ACHOU = { lat: null, lng: null, precision: null, failed: false };
const FALHOU = { lat: null, lng: null, precision: null, failed: true };
// Busca pelo endereço responde da fila (vazia: PONTO); busca só da cidade responde `cidade`.
let fila: unknown[] = [];
let cidade: unknown = NAO_ACHOU;
const pelaRua = (p: Record<string, unknown>) => !!(p.street || p.number || p.neighborhood || p.cep);
const buscasDoEndereco = () => svc.geocode.mock.calls.filter(([p]) => pelaRua(p));

beforeEach(() => {
  vi.clearAllMocks();
  fila = [];
  cidade = NAO_ACHOU;
  svc.geocode.mockImplementation(async (p: Record<string, unknown>) => (pelaRua(p) ? (fila.length ? fila.shift() : PONTO) : cidade));
});
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

  it('CEP trocado no meio: a resposta do antigo não sobrescreve o novo', async () => {
    const a = adiado<object>();
    const b = adiado<object>();
    svc.cepLookup.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const m = montar({});
    const campo = screen.getByLabelText('CEP');
    await userEvent.type(campo, '13015-002');
    await userEvent.tab();
    await userEvent.clear(campo);
    await userEvent.type(campo, '01310-100');
    await userEvent.tab();
    expect(svc.cepLookup).toHaveBeenCalledTimes(2);
    await act(async () => { b.resolve({ address_street: 'Avenida Paulista', address_city: 'São Paulo', address_state: 'SP' }); });
    await act(async () => { a.resolve({ address_street: 'Rua Barão de Jaguara', address_city: 'Campinas', address_state: 'SP' }); });
    expect(m.get()).toMatchObject({ address_zip: '01310-100', address_street: 'Avenida Paulista', address_city: 'São Paulo' });
  });

  it('404 atrasado de um CEP antigo não avisa embaixo do novo', async () => {
    const a = adiado<object>();
    const b = adiado<object>();
    svc.cepLookup.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    montar({});
    const campo = screen.getByLabelText('CEP');
    await userEvent.type(campo, '99999999');
    await userEvent.tab();
    await userEvent.clear(campo);
    await userEvent.type(campo, '01310-100');
    await userEvent.tab();
    await act(async () => { b.resolve({ address_city: 'São Paulo', address_state: 'SP' }); });
    await act(async () => { a.reject({ response: { status: 404 } }); });
    expect(screen.queryByText('CEP não encontrado')).toBeNull();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeEnabled();
  });

  it('o ponto depois do CEP usa o Número digitado enquanto o CEP carregava', async () => {
    const cep = adiado<object>();
    svc.cepLookup.mockReturnValueOnce(cep.promise);
    montar({});
    await userEvent.type(screen.getByLabelText('CEP'), '13015-002');
    await userEvent.tab();
    await userEvent.type(screen.getByLabelText('Número'), '1481');
    await userEvent.tab();
    await act(async () => { cep.resolve({ address_street: 'Rua Barão de Jaguara', address_city: 'Campinas', address_state: 'SP' }); });
    await waitFor(() => expect(buscasDoEndereco()).toHaveLength(1));
    expect(buscasDoEndereco()[0][0]).toMatchObject({ number: '1481', street: 'Rua Barão de Jaguara', city: 'Campinas' });
  });

  it('arrastar marca manual e o alfinete não pula quando o endereço muda', async () => {
    const m = montar({ ...ENDERECO, latitude: -22.9, longitude: -47.06, location_source: 'auto' });
    // O mapa é carregado sob demanda (lazy): aparece um instante depois.
    await userEvent.click(await screen.findByRole('button', { name: 'arrastar' }));
    expect(m.get()).toMatchObject({ latitude: -1, longitude: -2, location_source: 'manual' });
    svc.geocode.mockClear();
    await userEvent.clear(screen.getByLabelText('Número'));
    await userEvent.type(screen.getByLabelText('Número'), '99');
    await userEvent.tab();
    expect(svc.geocode).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Reposicionar pelo endereço' }));
    await waitFor(() => expect(m.get()).toMatchObject({ location_source: 'auto', latitude: -22.9 }));
  });

  it('arrastar enquanto o ponto é procurado: o alfinete da pessoa fica', async () => {
    const busca = adiado<object>();
    fila = [busca.promise];
    const m = montar({ ...ENDERECO, latitude: -22.8, longitude: -47.1, location_source: 'auto' });
    await userEvent.clear(screen.getByLabelText('Número'));
    await userEvent.type(screen.getByLabelText('Número'), '2');
    await userEvent.tab();
    expect(buscasDoEndereco()).toHaveLength(1);
    await userEvent.click(await screen.findByRole('button', { name: 'arrastar' }));
    await act(async () => { busca.resolve(PONTO); });
    expect(m.get()).toMatchObject({ latitude: -1, longitude: -2, location_source: 'manual' });
  });

  it('respostas fora de ordem: vale a da última busca', async () => {
    const primeira = adiado<object>();
    const segunda = adiado<object>();
    fila = [primeira.promise, segunda.promise];
    const m = montar({ ...ENDERECO, latitude: -22.8, longitude: -47.1, location_source: 'auto' });
    const numero = screen.getByLabelText('Número');
    await userEvent.clear(numero);
    await userEvent.type(numero, '2');
    await userEvent.tab();
    await userEvent.clear(numero);
    await userEvent.type(numero, '3');
    await userEvent.tab();
    expect(buscasDoEndereco()).toHaveLength(2);
    await act(async () => { segunda.resolve({ lat: -23, lng: -46, precision: 'number', failed: false }); });
    await act(async () => { primeira.resolve({ lat: -10, lng: -40, precision: 'number', failed: false }); });
    expect(m.get()).toMatchObject({ latitude: -23, longitude: -46, location_source: 'auto' });
  });

  it('não achou: aviso honesto e nada de erro', async () => {
    fila = [NAO_ACHOU];
    montar({ address_street: 'Rua Inexistente', address_number: '1', address_city: 'Campinas', address_state: 'SP' });
    await userEvent.click(screen.getByLabelText('Número'));
    await userEvent.tab();
    expect(await screen.findByText('Não achamos o endereço. Arraste o alfinete até o imóvel.')).toBeInTheDocument();
  });

  it('achou só a cidade: não grava o ponto, centra o mapa na cidade e avisa', async () => {
    fila = [{ lat: -22.95, lng: -47.05, precision: 'city', failed: false }];
    const m = montar(ENDERECO);
    await userEvent.click(screen.getByLabelText('Número'));
    await userEvent.tab();
    expect(await screen.findByText('Não achamos o endereço. Arraste o alfinete até o imóvel.')).toBeInTheDocument();
    expect(m.get().latitude ?? null).toBeNull();
    expect(m.get().location_source ?? null).toBeNull();
    expect(m.setF).not.toHaveBeenCalled();
    expect(await screen.findByTestId('mapa')).toHaveTextContent('-22.95,-47.05');
    expect(screen.getByTestId('mapa')).toHaveAttribute('data-zoom', '12');
  });

  it('serviço ocupado: tenta de novo em silêncio depois de 1,5 s e aplica o ponto', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fila = [FALHOU, PONTO];
    const m = montar(ENDERECO);
    await userEvent.click(screen.getByLabelText('Número'));
    await userEvent.tab();
    await waitFor(() => expect(buscasDoEndereco()).toHaveLength(1));
    expect(m.get().latitude).toBeUndefined();
    await act(() => vi.advanceTimersByTimeAsync(1500));
    await waitFor(() => expect(m.get()).toMatchObject({ latitude: -22.9, longitude: -47.06, location_source: 'auto' }));
    expect(buscasDoEndereco()).toHaveLength(2);
    expect(screen.getByText('Achamos pelo endereço. Arraste o alfinete se precisar ajustar.')).toBeInTheDocument();
  });

  it('serviço ocupado duas vezes: fica como não achado e mantém o ponto atual', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fila = [FALHOU, FALHOU];
    const m = montar({ ...ENDERECO, latitude: -22.8, longitude: -47.1, location_source: 'auto' });
    await userEvent.clear(screen.getByLabelText('Número'));
    await userEvent.type(screen.getByLabelText('Número'), '2');
    await userEvent.tab();
    await waitFor(() => expect(buscasDoEndereco()).toHaveLength(1));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(await screen.findByText('Não achamos o endereço. Arraste o alfinete até o imóvel.')).toBeInTheDocument();
    expect(buscasDoEndereco()).toHaveLength(2);
    expect(m.get()).toMatchObject({ latitude: -22.8, longitude: -47.1, location_source: 'auto' });
    expect(screen.getByTestId('mapa')).toHaveTextContent('-22.8,-47.1');
  });

  it('busca trocada por outra antes de 1,5 s não tenta de novo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fila = [FALHOU, PONTO];
    const m = montar({ ...ENDERECO, latitude: -22.8, longitude: -47.1, location_source: 'auto' });
    const numero = screen.getByLabelText('Número');
    await userEvent.clear(numero);
    await userEvent.type(numero, '2');
    await userEvent.tab();
    await waitFor(() => expect(buscasDoEndereco()).toHaveLength(1));
    await userEvent.clear(numero);
    await userEvent.type(numero, '3');
    await userEvent.tab();
    await waitFor(() => expect(m.get()).toMatchObject({ latitude: -22.9, address_number: '3' }));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(buscasDoEndereco()).toHaveLength(2);
  });

  it('endereço sem ponto salvo: o mapa já abre na cidade, sem gravar nada', async () => {
    cidade = { lat: -22.9, lng: -47.06, precision: 'city', failed: false };
    const m = montar({ address_street: 'Rua A', address_city: 'Campinas', address_state: 'SP' });
    await waitFor(() => expect(screen.getByTestId('mapa')).toHaveTextContent('-22.9,-47.06'));
    expect(screen.getByTestId('mapa')).toHaveAttribute('data-zoom', '12');
    expect(svc.geocode).toHaveBeenCalledWith({ city: 'Campinas', state: 'SP' });
    expect(m.setF).not.toHaveBeenCalled();
  });

  it('sem ponto e sem cidade achada: mapa do Brasil sem alfinete', async () => {
    montar({ address_street: 'Rua A', address_city: 'Lugar Nenhum' });
    const mapa = await screen.findByTestId('mapa');
    await waitFor(() => expect(svc.geocode).toHaveBeenCalled());
    expect(mapa.textContent).toBe(',arrastar');
    expect(mapa).toHaveAttribute('data-zoom', '4');
  });

  it('ponto salvo abre no zoom 16', async () => {
    montar({ ...ENDERECO, latitude: -22.9, longitude: -47.06, location_source: 'auto' });
    expect(await screen.findByTestId('mapa')).toHaveAttribute('data-zoom', '16');
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
    const m = montar({ address_city: 'Campinas', address_street: 'Rua A', latitude: -22.9, longitude: -47.06, location_source: 'auto' });
    expect(await screen.findByText('Achamos pelo endereço. Arraste o alfinete se precisar ajustar.')).toBeInTheDocument();
    m.mudar({ location_source: 'manual' });
    expect(screen.getByText('Posição ajustada à mão.')).toBeInTheDocument();
    m.mudar({ location_source: null });
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
