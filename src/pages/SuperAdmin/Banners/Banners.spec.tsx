import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { BannerAdmin } from '@/types/admin/dashboardBanners';

const svc = vi.hoisted(() => ({
  listar: vi.fn(), criar: vi.fn(), salvar: vi.fn(), enviarArte: vi.fn(), tirarArte: vi.fn(),
  contarPublico: vi.fn(), publicar: vi.fn(), tirarDoAr: vi.fn(), excluir: vi.fn(),
}));
vi.mock('@/services/superAdmin/dashboardBannersService', () => ({ dashboardBannersService: svc }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import Banners from './index';

const rascunho: BannerAdmin = {
  id: 'b1', name: 'Atualização · Mensagens prontas', status: 'draft', situation: 'draft', click_action: 'details',
  details_title: 'Mensagens prontas', details_body: 'Agora na lateral.', details_button_path: '/conversations',
  link_url: null, roles: ['admin', 'manager', 'agent'], tenant_slugs: [], starts_at: null,
  ends_at: '2026-10-26T23:59:59Z', published_at: null, created_at: '2026-10-12T20:00:00Z',
  desktop_url: 'https://x/d.png', mobile_url: 'https://x/m.png', details_image_url: null, seen_count: 0, clicked_count: 0,
};
const noAr: BannerAdmin = { ...rascunho, id: 'b2', name: 'Campanha', status: 'published', situation: 'live', seen_count: 280, clicked_count: 94 };

const abrir = () => render(<MemoryRouter><Banners /></MemoryRouter>);

describe('Comunicação → Banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.listar.mockResolvedValue({ banners: [rascunho, noAr], imobiliarias: [{ slug: 'casa-x', name: 'Casa X' }] });
  });

  it('lista com a situação e os números de quem viu', async () => {
    abrir();
    expect(await screen.findByText('Atualização · Mensagens prontas')).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText('No ar')).toBeInTheDocument();
    expect(screen.getByText('Apareceu para 280 pessoas · 94 clicaram')).toBeInTheDocument();
  });

  it('publicar confirma com o público contado pelo servidor e repergunta se a conta mudou', async () => {
    svc.salvar.mockResolvedValue(rascunho);
    svc.contarPublico.mockResolvedValue({ people: 340, tenants: 31, unreadable: [] });
    svc.publicar
      .mockRejectedValueOnce({ response: { status: 409, data: { audience: { people: 341, tenants: 31, unreadable: [] } } } })
      .mockResolvedValueOnce({ ...rascunho, status: 'published', situation: 'live' });
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Atualização · Mensagens prontas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByText('Mostrar para 340 pessoas de 31 imobiliárias?')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog', { name: /Mostrar para 340/ })).getByRole('button', { name: 'Publicar' }));
    expect(svc.publicar).toHaveBeenCalledWith('b1', 340);

    expect(await screen.findByText('Mostrar para 341 pessoas de 31 imobiliárias?')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog', { name: /Mostrar para 341/ })).getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(svc.publicar).toHaveBeenLastCalledWith('b1', 341));
    expect(toast.success).toHaveBeenCalledWith('Banner publicado.');
  });

  it('arte fora da medida mostra o motivo do servidor', async () => {
    svc.enviarArte.mockRejectedValue({ response: { data: { error: 'A arte do computador precisa ter 2800 × 560 px. Esta tem 1920 × 1080 px.' } } });
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Atualização · Mensagens prontas' }));
    const arquivo = new File(['x'], 'arte.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Escolher arquivo: Arte do computador'), arquivo);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('A arte do computador precisa ter 2800 × 560 px. Esta tem 1920 × 1080 px.'));
    expect(svc.enviarArte).toHaveBeenCalledWith('b1', 'desktop', arquivo);
  });

  it('banner novo só nasce no servidor ao salvar', async () => {
    svc.criar.mockResolvedValue({ ...rascunho, id: 'b3', name: 'Novo' });
    abrir();
    await screen.findByText('Campanha');
    await userEvent.click(screen.getByRole('button', { name: 'Novo banner' }));
    expect(svc.criar).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Nome interno'), 'Novo');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.criar).toHaveBeenCalledWith(expect.objectContaining({ name: 'Novo', tenant_slugs: [] })));
  });

  it('erro ao carregar mostra tentar de novo', async () => {
    svc.listar.mockRejectedValue(new Error('x'));
    abrir();
    expect(await screen.findByText('Não deu para carregar os banners')).toBeInTheDocument();
  });
});

describe('Comunicação → Banner · destino do clique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.listar.mockResolvedValue({ banners: [rascunho], imobiliarias: [] });
  });

  it('Ver agora escolhe a tela pelo nome do menu; outro endereço abre a caixa de digitar', async () => {
    svc.salvar.mockImplementation(async (_id: string, campos: Record<string, unknown>) => ({ ...rascunho, ...campos }));
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Atualização · Mensagens prontas' }));
    const destino = screen.getByLabelText('Botão Ver agora leva pra') as HTMLSelectElement;
    expect(destino.value).toBe('/conversations');

    fireEvent.change(destino, { target: { value: '/visits' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.salvar).toHaveBeenCalledWith('b1', expect.objectContaining({ details_button_path: '/visits' })));

    fireEvent.change(destino, { target: { value: '__outro' } });
    await userEvent.type(screen.getByLabelText('Botão Ver agora leva pra: endereço'), 'https://lealmidia.com.br');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.salvar).toHaveBeenLastCalledWith('b1', expect.objectContaining({ details_button_path: 'https://lealmidia.com.br' })));
  });
});
