import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';

const svc = vi.hoisted(() => ({
  list: vi.fn(), upload: vi.fn(), create: vi.fn(), update: vi.fn(),
  delete: vi.fn(), setAsCover: vi.fn(), reorder: vi.fn(),
}));
vi.mock('@/services/propertyPhotos/propertyPhotosService', async orig => ({
  ...(await orig<typeof import('@/services/propertyPhotos/propertyPhotosService')>()),
  propertyPhotosService: svc,
}));
const props = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async orig => ({
  ...(await orig<typeof import('@/services/properties/propertiesService')>()),
  propertiesService: props,
}));
const permitido = vi.hoisted(() => ({ fn: (_r: string, _a: string) => true }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => (r: string, a: string) => permitido.fn(r, a) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import FotosDoImovel from './FotosDoImovel';

const foto = (id: string, extra: Partial<PropertyPhoto> = {}) =>
  ({ id, property_id: 'p1', file_url: `https://x/${id}.jpg`, photo_type: 'main', content_type: 'image/jpeg',
     position: 0, is_cover: false, published: true, created_at: '', ...extra }) as PropertyPhoto;
const video = (id: string, extra: Partial<PropertyPhoto> = {}) =>
  foto(id, { photo_type: 'video', content_type: 'video/mp4', file_size_bytes: 5_000_000, file_name: `${id}.mp4`, ...extra });

function abrir(lista: PropertyPhoto[], endereco = '/properties/p1/fotos') {
  svc.list.mockResolvedValue(lista);
  props.get.mockResolvedValue({ id: 'p1', code: 'AP0566', title: 'Apto no Cambuí', listing_kind: 'resale' });
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/properties/:id/fotos" element={<FotosDoImovel />} />
        <Route path="/properties/:id/editar" element={<p>cadastro aberto</p>} />
        <Route path="/properties" element={<p>lista aberta</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(svc).forEach(f => f.mockReset());
  props.get.mockReset();
  permitido.fn = () => true;
});

describe('FotosDoImovel', () => {
  it('mostra título, imóvel, capa e as abas com contagem', async () => {
    abrir([foto('a'), foto('b', { published: false }), video('v')]);
    expect(await screen.findByText('AP0566 · Apto no Cambuí')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Fotos e vídeos/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Capa' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tudo 3' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Fotos 2' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Vídeos e áudios 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ocultas 1' })).toBeInTheDocument();
  });

  it('vindo do cadastro, volta pro cadastro', async () => {
    abrir([foto('a')], '/properties/p1/fotos?de=cadastro');
    await userEvent.click(await screen.findByRole('link', { name: /Voltar ao cadastro/ }));
    expect(screen.getByText('cadastro aberto')).toBeInTheDocument();
  });

  it('erro de leitura mostra Tentar de novo', async () => {
    svc.list.mockRejectedValue(new Error('x'));
    props.get.mockResolvedValue({ id: 'p1', code: 'AP0566', title: 'Apto', listing_kind: 'resale' });
    render(
      <MemoryRouter initialEntries={['/properties/p1/fotos']}>
        <Routes><Route path="/properties/:id/fotos" element={<FotosDoImovel />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('imóvel sem foto mostra o vazio', async () => {
    abrir([]);
    expect(await screen.findByText('Nenhuma foto ainda')).toBeInTheDocument();
  });

  it('capa oculta mostra o aviso', async () => {
    abrir([foto('a', { is_cover: true, published: false }), foto('b')]);
    expect(await screen.findByText('A capa está oculta. No site e nos portais aparece a próxima foto visível.')).toBeInTheDocument();
  });

  it('a capa não se oculta e as outras sim', async () => {
    abrir([foto('a'), foto('b')]);
    const ocultar = await screen.findAllByRole('button', { name: 'Ocultar' });
    expect(ocultar[0]).toBeDisabled();
    expect(ocultar[0]).toHaveAttribute('title', 'Escolha outra capa antes de ocultar esta.');
    expect(ocultar[1]).toBeEnabled();
  });

  it('corretor só ordena e escolhe capa', async () => {
    permitido.fn = (_r, a) => ['read', 'reorder', 'set_as_cover'].includes(a);
    abrir([foto('a'), foto('b')]);
    expect(await screen.findAllByRole('button', { name: /Arrastar a/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Usar como capa' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Ocultar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar fotos e vídeos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Selecionar' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Escolher fotos e vídeos')).not.toBeInTheDocument();
  });

  it('excluir pergunta antes', async () => {
    svc.delete.mockResolvedValue(undefined);
    abrir([foto('a'), foto('b')]);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Excluir' }))[1]);
    expect(svc.delete).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(svc.delete).toHaveBeenCalledWith('p1', 'b'));
  });

  it('subir arquivo pelo botão', async () => {
    svc.upload.mockResolvedValue([foto('n')]);
    abrir([foto('a')]);
    const campo = await screen.findByLabelText('Escolher fotos e vídeos');
    await userEvent.upload(campo, new File(['x'], 'n.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(svc.upload).toHaveBeenCalled());
  });

  it('a lista Categorizar como não existe mais', async () => {
    abrir([foto('a')]);
    await screen.findAllByRole('button', { name: 'Excluir' });
    expect(screen.queryByText(/Categorizar como/)).not.toBeInTheDocument();
    expect(screen.queryByText('Principal')).not.toBeInTheDocument();
  });

  it('cada vídeo diz se a IA manda', async () => {
    abrir([
      foto('a'),
      video('certo'),
      video('mov', { content_type: 'video/quicktime', file_name: 'mov.mov' }),
      video('grande', { file_size_bytes: 40 * 1024 * 1024 }),
    ]);
    expect(await screen.findByText('Este é o vídeo que a IA manda')).toBeInTheDocument();
    expect(screen.getByText('A IA não manda: o WhatsApp só toca MP4. No site aparece normal.')).toBeInTheDocument();
    expect(screen.getByText('A IA não manda: passa de 16 MB. No site aparece normal.')).toBeInTheDocument();
  });

  it('vídeo não tem coroa de capa', async () => {
    abrir([foto('a'), video('v')]);
    await screen.findByText('Este é o vídeo que a IA manda');
    expect(screen.getAllByRole('button', { name: 'Usar como capa' })).toHaveLength(1);
  });

  it('a aba Fotos esconde os vídeos', async () => {
    abrir([foto('a'), video('v')]);
    await userEvent.click(await screen.findByRole('tab', { name: 'Fotos 1' }));
    expect(screen.queryByText('Este é o vídeo que a IA manda')).not.toBeInTheDocument();
  });

  it('ocultar várias pula a capa e avisa', async () => {
    const { toast } = await import('sonner');
    svc.update.mockImplementation(async (_p: string, fid: string) => foto(fid, { published: false }));
    abrir([foto('a'), foto('b'), foto('c')]);
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Selecionar a 1ª foto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Selecionar a 2ª foto' }));
    svc.list.mockResolvedValue([foto('a'), foto('b', { published: false }), foto('c')]);
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledTimes(1));
    expect(svc.update).toHaveBeenCalledWith('p1', 'b', { published: false });
    expect(toast.success).toHaveBeenCalledWith('1 oculta. A capa não foi ocultada.');
  });

  it('excluir várias pergunta antes', async () => {
    svc.delete.mockResolvedValue(undefined);
    abrir([foto('a'), foto('b')]);
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Selecionar a 2ª foto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(svc.delete).not.toHaveBeenCalled();
    expect(within(screen.getByRole('dialog')).getByText('Excluir 1 item?')).toBeInTheDocument();
  });

  it('lote em andamento não deixa começar outro', async () => {
    let terminar: (v: PropertyPhoto) => void = () => {};
    svc.update.mockImplementation(() => new Promise<PropertyPhoto>(res => { terminar = res; }));
    abrir([foto('a'), foto('b')]);
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Selecionar a 2ª foto' }));
    const ocultar = screen.getByRole('button', { name: 'Ocultar' });
    await userEvent.click(ocultar);
    await userEvent.click(ocultar);
    expect(svc.update).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ocultar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Concluir seleção' })).toBeDisabled();
    terminar(foto('b', { published: false }));
    await screen.findByRole('button', { name: 'Selecionar' });
  });

  it('clicar na foto abre ela grande, com setas pelo teclado', async () => {
    abrir([foto('a'), foto('b')]);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir a 1ª foto' }));
    const janela = screen.getByRole('dialog');
    expect(within(janela).getByText('Foto 1 de 2')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(within(janela).getByText('Foto 2 de 2')).toBeInTheDocument();
    expect(within(janela).getByRole('button', { name: 'Usar como capa' })).toBeEnabled();
  });

  it('foto que sai da lista não reabre sozinha ao trocar de aba', async () => {
    svc.update.mockResolvedValue(foto('b', { published: true }));
    abrir([foto('a'), foto('b', { published: false })]);
    await userEvent.click(await screen.findByRole('tab', { name: 'Ocultas 1' }));
    await userEvent.click(await screen.findByRole('button', { name: /^Abrir a \d/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mostrar' }));
    await userEvent.click(await screen.findByRole('tab', { name: /^Tudo/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
