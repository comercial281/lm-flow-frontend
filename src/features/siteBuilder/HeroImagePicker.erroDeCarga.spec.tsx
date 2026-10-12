import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroImagePicker from './HeroImagePicker';

const list = vi.hoisted(() => vi.fn());
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list } }));
vi.mock('@/services/propertyPhotos/propertyPhotosService', () => ({ propertyPhotosService: { list: vi.fn() } }));

const imovel = { id: 'p1', title: 'Casa Azul', code: 'CA1', published_on_site: true, photos_count: 2, cover_photo_url: null };
const abrir = () => render(<HeroImagePicker open onClose={() => {}} onPick={() => {}} />);

beforeEach(() => list.mockReset());

describe('HeroImagePicker · erro de carga', () => {
  it('lista que falha mostra o erro com Tentar de novo, não o vazio', async () => {
    list.mockRejectedValueOnce(new Error('rede'));
    abrir();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/^Nenhum imóvel/)).toBeNull();
    list.mockResolvedValueOnce({ data: [imovel] });
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Casa Azul')).toBeInTheDocument();
  });

  it('Tentar de novo duas vezes seguidas não duplica a lista', async () => {
    list.mockRejectedValueOnce(new Error('rede'));
    abrir();
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    list.mockResolvedValue({ data: [imovel] });
    await userEvent.dblClick(botao);
    expect(await screen.findAllByText('Casa Azul')).toHaveLength(1);
  });
});
