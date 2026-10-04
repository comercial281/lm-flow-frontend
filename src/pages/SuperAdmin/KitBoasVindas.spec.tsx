import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const kit = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('@/services/superAdmin/welcomeKitService', () => ({ welcomeKitService: kit }));

const inst = vi.hoisted(() => ({ centralInstances: vi.fn() }));
vi.mock('@/services/clientInstances/clientInstancesService', () => ({ default: inst }));

const site = vi.hoisted(() => ({ uploadAsset: vi.fn() }));
vi.mock('@/services/siteBuilder/siteBuilderService', () => ({ siteBuilderService: site }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import KitBoasVindas from './KitBoasVindas';

const MEDIA = 'https://api.lmflow.com.br/rails/active_storage/blobs/redirect/x/';
const payload = (images = [{ url: `${MEDIA}1.png`, caption: 'Passo 1' }]) => ({
  kit: {
    configured: true, template: 'Oi {nome}: {link}', raw_template: 'Oi {nome}: {link}',
    instance: 'Operacional (LM01)', video: { url: `${MEDIA}app.mp4`, name: 'app.mp4', size: 1024 * 1024 }, images,
  },
  default_template: 'Padrão {nome} {link}',
  vars: ['nome', 'link'],
});

describe('Plataforma → Kit de boas-vindas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kit.get.mockResolvedValue(payload());
    kit.save.mockImplementation(async (k) => ({ ...payload(k.images), kit: { ...payload(k.images).kit, ...k, raw_template: k.template } }));
    inst.centralInstances.mockResolvedValue({ data: { data: [{ name: 'Operacional (LM01)', connected: true }] } });
  });

  it('erro ao carregar mostra o motivo e não deixa salvar por cima', async () => {
    kit.get.mockRejectedValueOnce({ response: { data: { error: 'servidor fora' } } });
    render(<KitBoasVindas />);
    expect(await screen.findByText('servidor fora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Mensagem')).not.toBeInTheDocument();
  });

  it('mexer no texto mostra a barra, e salvar manda o kit inteiro', async () => {
    render(<KitBoasVindas />);
    const campo = await screen.findByLabelText('Mensagem');
    expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).not.toBeInTheDocument();
    fireEvent.change(campo, { target: { value: 'Olá {nome}! {link}' } });
    expect(screen.getByRole('region', { name: 'Alterações não salvas' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(kit.save).toHaveBeenCalledWith({
      template: 'Olá {nome}! {link}',
      instance: 'Operacional (LM01)',
      video: { url: `${MEDIA}app.mp4`, name: 'app.mp4', size: 1024 * 1024 },
      images: [{ url: `${MEDIA}1.png`, caption: 'Passo 1' }],
    }));
  });

  it('a prévia mostra o texto com o cliente de exemplo', async () => {
    render(<KitBoasVindas />);
    expect(await screen.findByText('Oi Imobiliária Exemplo: https://cliente.lmflow.com.br')).toBeInTheDocument();
  });

  it('com 6 imagens, "Adicionar imagem" some', async () => {
    kit.get.mockResolvedValue(payload(Array.from({ length: 6 }, (_, i) => ({ url: `${MEDIA}${i}.png`, caption: '' }))));
    render(<KitBoasVindas />);
    await screen.findByLabelText('Mensagem');
    expect(screen.queryByRole('button', { name: /Adicionar imagem/ })).not.toBeInTheDocument();
  });

  it('vídeo que não é MP4 é recusado antes de subir', async () => {
    render(<KitBoasVindas />);
    await screen.findByLabelText('Mensagem');
    const input = screen.getByTestId('kit-video-input');
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.mov', { type: 'video/quicktime' })] } });
    expect(toast.error).toHaveBeenCalledWith('Envie o vídeo em MP4.');
    expect(site.uploadAsset).not.toHaveBeenCalled();
  });
});
