import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';

const mocks = vi.hoisted(() => ({ uploadAsset: vi.fn(), extractLogoColors: vi.fn() }));
vi.mock('@/services/siteBuilder/siteBuilderService', () => ({ siteBuilderService: { uploadAsset: mocks.uploadAsset } }));
vi.mock('@/utils/logoColors', () => ({ extractLogoColors: mocks.extractLogoColors }));
vi.mock('@/features/siteBuilder/HeroImagePicker', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TelaAparencia from './TelaAparencia';

function Montar({ espiao, inicial = {} }: { espiao: (f: Partial<SiteFormData>) => void; inicial?: Partial<SiteFormData> }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imobiliária Horizonte Azul', ...inicial });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaAparencia site={null} siteForm={form} setF={setF} heroPickPreview={null} setHeroPickPreview={vi.fn()} />;
}

const png = (nome: string) => new File(['x'], nome, { type: 'image/png' });

describe('TelaAparencia · Logotipos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractLogoColors.mockResolvedValue(null);
  });

  it('as duas caixas aparecem sem campo de link', () => {
    render(<Montar espiao={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Logotipos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar logo do site' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar ícone da aba' })).toBeTruthy();
    // O único campo de link que sobra na tela é o do vídeo do banner.
    expect(screen.getAllByPlaceholderText('https://... ou envie o arquivo')).toHaveLength(1);
  });

  it('enviar o ícone grava favicon_url', async () => {
    mocks.uploadAsset.mockResolvedValue({ url: 'https://cdn/icone.png' });
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.upload(screen.getByLabelText('Escolher arquivo: ícone da aba'), png('icone.png'));
    await waitFor(() => expect(espiao).toHaveBeenCalledWith({ favicon_url: 'https://cdn/icone.png' }));
    expect(mocks.extractLogoColors).not.toHaveBeenCalled();
    expect((screen.getByRole('img', { name: 'Ícone da aba' }) as HTMLImageElement).src).toBe('https://cdn/icone.png');
  });

  it('enviar o logo grava logo_url e as cores tiradas dele', async () => {
    mocks.uploadAsset.mockResolvedValue({ url: 'https://cdn/logo.png' });
    mocks.extractLogoColors.mockResolvedValue({ primary: '#112233', accent: '#445566' });
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.upload(screen.getByLabelText('Escolher arquivo: logo do site'), png('logo.png'));
    await waitFor(() => expect(espiao).toHaveBeenCalledWith({
      logo_url: 'https://cdn/logo.png', primary_color: '#112233', accent_color: '#445566',
    }));
  });

  it('remover o ícone pede confirmação e grava null', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} inicial={{ favicon_url: 'https://cdn/icone.png' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remover ícone da aba' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }));
    expect(espiao).toHaveBeenCalledWith({ favicon_url: null });
  });

  it('a prévia da aba mostra o mesmo título do site e o ícone', () => {
    render(<Montar espiao={vi.fn()} inicial={{ favicon_url: 'https://cdn/icone.png' }} />);
    const aba = screen.getByTestId('previa-da-aba');
    expect(within(aba).getByText('Imobiliária Horizonte Azul — Encontre seu imóvel')).toBeTruthy();
    expect(aba.querySelector('img')?.getAttribute('src')).toBe('https://cdn/icone.png');
  });

  it('com título de Aparecer no Google, a prévia usa ele', () => {
    render(<Montar espiao={vi.fn()} inicial={{ seo_title: 'Horizonte Azul | Imóveis em Campinas' }} />);
    expect(within(screen.getByTestId('previa-da-aba')).getByText('Horizonte Azul | Imóveis em Campinas')).toBeTruthy();
  });

  it('a escolha da foto do banner é um grupo com nome', () => {
    render(<Montar espiao={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Foto' })).toBeTruthy();
  });

  it('sem ícone, a prévia avisa do ícone padrão', () => {
    render(<Montar espiao={vi.fn()} />);
    expect(screen.getByText('Sem ícone, o navegador mostra um ícone padrão.')).toBeTruthy();
    expect(screen.getByTestId('previa-da-aba').querySelector('img')).toBeNull();
  });
});
