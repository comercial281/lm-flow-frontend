import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

const list = vi.fn();
const get = vi.fn();
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: (...a: unknown[]) => list(...a), get: (...a: unknown[]) => get(...a) } }));

import { CampoDeImovel } from './BuscaDeImovel';

function Campo({ inicial = '', aoMudar = () => {} }: { inicial?: string; aoMudar?: (id: string) => void }) {
  const [id, setId] = useState(inicial);
  return <CampoDeImovel id="imovel" propertyId={id} aoMudar={novo => { setId(novo); aoMudar(novo); }} />;
}

describe('CampoDeImovel', () => {
  beforeEach(() => { list.mockReset(); get.mockReset(); });

  it('mostra o imóvel já vinculado pelo id, sem depender de lista carregada', async () => {
    get.mockResolvedValue({ id: 'p150', title: 'Residencial Capri', code: 'EM0150' });
    render(<Campo inicial="p150" />);
    expect(await screen.findByText('Residencial Capri')).toBeInTheDocument();
    expect(screen.getByText('EM0150')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('p150');
    expect(list).not.toHaveBeenCalled();
  });

  it('busca no servidor pelo texto e liga o escolhido', async () => {
    list.mockResolvedValue({ data: [{ id: 'p7', title: 'Apto Centro', code: 'AP0007' }] });
    const aoMudar = vi.fn();
    render(<Campo aoMudar={aoMudar} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar por título ou código'), { target: { value: 'centro' } });
    fireEvent.click(await screen.findByRole('button', { name: /Apto Centro/ }));
    expect(aoMudar).toHaveBeenCalledWith('p7');
    expect(list.mock.calls[0][0]).toMatchObject({ q: 'centro' });
    expect(screen.getByText('AP0007')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('a lixeira tira o imóvel e volta a busca', async () => {
    get.mockResolvedValue({ id: 'p1', title: 'Casa Jardim', code: 'CA0001' });
    const aoMudar = vi.fn();
    render(<Campo inicial="p1" aoMudar={aoMudar} />);
    await screen.findByText('Casa Jardim');
    fireEvent.click(screen.getByRole('button', { name: 'Tirar o imóvel' }));
    expect(aoMudar).toHaveBeenCalledWith('');
    await waitFor(() => expect(screen.getByPlaceholderText('Buscar por título ou código')).toBeInTheDocument());
  });

  it('imóvel apagado aparece como não encontrado, com a lixeira', async () => {
    get.mockRejectedValue(new Error('404'));
    render(<Campo inicial="sumiu" />);
    expect(await screen.findByText('Imóvel não encontrado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tirar o imóvel' })).toBeInTheDocument();
  });
});
