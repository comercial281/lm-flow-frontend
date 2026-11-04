import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

const list = vi.fn();
const get = vi.fn();
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: (...a: unknown[]) => list(...a), get: (...a: unknown[]) => get(...a) } }));

import { SeletorDeImoveis } from './SeletorDeImoveis';

const item = (n: number, extra: Record<string, unknown> = {}) => ({ id: `p${n}`, title: `Imóvel ${n}`, code: `AP${n}`, ...extra });
const pagina = (itens: unknown[], total = itens.length) => ({ data: itens, meta: { total, page: 1, per_page: 20 } });

function Host({ inicial = [], max = 10, sugestaoQ = null, disabled, aoMudar = () => {} }: {
  inicial?: string[]; max?: number; sugestaoQ?: string | null; disabled?: boolean; aoMudar?: (ids: string[]) => void;
}) {
  const [ids, setIds] = useState(inicial);
  return <SeletorDeImoveis id="sel" selecionados={ids} max={max} sugestaoQ={sugestaoQ} disabled={disabled} aoMudar={n => { setIds(n); aoMudar(n); }} />;
}

describe('SeletorDeImoveis', () => {
  beforeEach(() => { list.mockReset(); get.mockReset(); });

  it('ao montar lista os 20 mais recentes sem digitar e mostra o total', async () => {
    list.mockResolvedValue(pagina([item(1), item(2)], 912));
    render(<Host />);
    expect(await screen.findByRole('button', { name: /^Imóvel 1/ })).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith({ per_page: 20, sort: 'recent' });
    expect(screen.getByText('Mostrando 2 de 912')).toBeInTheDocument();
  });

  it('digitar busca com q depois de 300 ms', async () => {
    list.mockResolvedValue(pagina([item(1)]));
    render(<Host />);
    await screen.findByRole('button', { name: /^Imóvel 1/ });
    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByPlaceholderText('Buscar por título ou código'), { target: { value: 'capri' } });
      await act(async () => { await vi.advanceTimersByTimeAsync(299); });
      expect(list).toHaveBeenCalledTimes(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(2); });
      expect(list).toHaveBeenCalledTimes(2);
      expect(list.mock.calls[1][0]).toMatchObject({ q: 'capri', per_page: 20 });
    } finally { vi.useRealTimers(); }
  });

  it('filtro por tipo manda listing_kind', async () => {
    list.mockResolvedValue(pagina([item(1)]));
    render(<Host />);
    await screen.findByRole('button', { name: /^Imóvel 1/ });
    fireEvent.click(screen.getByRole('button', { name: 'Empreendimentos' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ listing_kind: 'development' })));
  });

  it('clique marca e desmarca', async () => {
    list.mockResolvedValue(pagina([item(1), item(2)]));
    const aoMudar = vi.fn();
    render(<Host aoMudar={aoMudar} />);
    const b = await screen.findByRole('button', { name: /^Imóvel 1/ });
    fireEvent.click(b);
    expect(aoMudar).toHaveBeenLastCalledWith(['p1']);
    expect(screen.getByRole('button', { name: /^Imóvel 1/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^Imóvel 1/ }));
    expect(aoMudar).toHaveBeenLastCalledWith([]);
  });

  it('com max atingido, os demais ficam desabilitados e os marcados continuam clicáveis', async () => {
    list.mockResolvedValue(pagina([item(1), item(2), item(3)]));
    render(<Host inicial={['p1', 'p2']} max={2} />);
    await screen.findByRole('button', { name: /^Imóvel 3/ });
    expect(screen.getByRole('button', { name: /^Imóvel 3/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Imóvel 1/ })).not.toBeDisabled();
  });

  it('id selecionado fora da página fica nos selecionados com o nome, buscado uma vez', async () => {
    list.mockResolvedValue(pagina([item(1)], 900));
    get.mockResolvedValue(item(777, { title: 'Casa Distante' }));
    const aoMudar = vi.fn();
    render(<Host inicial={['p777']} aoMudar={aoMudar} />);
    await waitFor(() => expect(screen.getByTestId('selecionados')).toHaveTextContent('Casa Distante'));
    // filtrar não faz sumir
    list.mockResolvedValue(pagina([]));
    fireEvent.change(screen.getByPlaceholderText('Buscar por título ou código'), { target: { value: 'zzz' } });
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: 'zzz' })));
    expect(screen.getByTestId('selecionados')).toHaveTextContent('Casa Distante');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('p777');
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('get que falha mantém o id selecionado com texto de reserva', async () => {
    list.mockResolvedValue(pagina([item(1)]));
    get.mockRejectedValue(new Error('404'));
    const aoMudar = vi.fn();
    render(<Host inicial={['p9']} aoMudar={aoMudar} />);
    expect(await screen.findByText('Imóvel não encontrado')).toBeInTheDocument();
    expect(aoMudar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tirar Imóvel não encontrado' }));
    expect(aoMudar).toHaveBeenCalledWith([]);
  });

  it('resposta antiga não sobrescreve a lista mais nova', async () => {
    let soltaVelha: (v: unknown) => void = () => {};
    list.mockResolvedValueOnce(pagina([item(1)]));
    render(<Host />);
    await screen.findByRole('button', { name: /^Imóvel 1/ });
    list.mockImplementationOnce(() => new Promise(r => { soltaVelha = r; }));
    list.mockResolvedValueOnce(pagina([item(3, { title: 'Nova' })]));
    fireEvent.click(screen.getByRole('button', { name: 'Empreendimentos' })); // pedido lento
    fireEvent.click(screen.getByRole('button', { name: 'Revenda' })); // pedido rápido
    expect(await screen.findByRole('button', { name: /Nova/ })).toBeInTheDocument();
    await act(async () => { soltaVelha(pagina([item(2, { title: 'Velha' })])); });
    expect(screen.queryByRole('button', { name: /Velha/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nova/ })).toBeInTheDocument();
  });

  it('sugestaoQ traz o sugerido primeiro com o selo, sem repetir na lista', async () => {
    list.mockImplementation(async (p: { q?: string }) => p.q === 'Capri'
      ? pagina([item(5, { title: 'Residencial Capri' })])
      : pagina([item(1), item(5, { title: 'Residencial Capri' })], 2));
    render(<Host sugestaoQ="Capri" />);
    await screen.findByText('Sugerido');
    const botoes = screen.getAllByRole('button', { name: /Imóvel 1|Capri/ });
    expect(botoes[0]).toHaveTextContent('Residencial Capri');
    expect(botoes[0]).toHaveTextContent('Sugerido');
    expect(screen.getAllByText(/Residencial Capri/)).toHaveLength(1);
  });

  it('sugestão sem resultado ou com erro: lista normal, sem erro', async () => {
    list.mockImplementation(async (p: { q?: string }) => {
      if (p.q === 'Nada') throw new Error('x');
      return pagina([item(1)]);
    });
    render(<Host sugestaoQ="Nada" />);
    expect(await screen.findByRole('button', { name: /^Imóvel 1/ })).toBeInTheDocument();
    expect(screen.queryByText('Sugerido')).not.toBeInTheDocument();
    expect(screen.queryByText(/Não deu pra carregar/)).not.toBeInTheDocument();
  });

  it('erro na lista mostra a frase e não apaga os selecionados', async () => {
    list.mockRejectedValue(new Error('500'));
    get.mockResolvedValue(item(4, { title: 'Casa Quatro' }));
    render(<Host inicial={['p4']} />);
    expect(await screen.findByText('Não deu pra carregar os imóveis. Tente de novo.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('selecionados')).toHaveTextContent('Casa Quatro'));
  });

  it('disabled bloqueia clique e busca', async () => {
    list.mockResolvedValue(pagina([item(1)]));
    const aoMudar = vi.fn();
    render(<Host disabled aoMudar={aoMudar} />);
    const b = await screen.findByRole('button', { name: /^Imóvel 1/ });
    expect(b).toBeDisabled();
    expect(screen.getByPlaceholderText('Buscar por título ou código')).toBeDisabled();
    fireEvent.click(b);
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('nome comprido corta e não estica o layout', async () => {
    const longo = 'Residencial '.repeat(30);
    list.mockResolvedValue(pagina([item(1, { title: longo })]));
    render(<Host />);
    const b = await screen.findByRole('button', { name: /Residencial/ });
    expect(b.className).toContain('min-w-0');
    expect(b.querySelector('.truncate')).not.toBeNull();
  });
});
