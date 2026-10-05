import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { APARENCIA_FABRICA } from '@/features/siteBuilder/public/aparenciaConfig';

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

describe('TelaAparencia · visual do site (C3)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const casos: [string, string, string, Record<string, unknown>][] = [
    ['Fundo do site', 'Escuro', 'background', { background: 'dark' }],
    ['Estilo do topo', 'Na cor principal', 'header_style', { header_style: 'brand' }],
    ['Estilo do topo', 'Branco', 'header_style', { header_style: 'white' }],
    ['Faixa de cima', 'Telefone e redes (sem e-mail)', 'top_bar', { top_bar: 'one_phone' }],
    ['Faixa de cima', 'Só ícones', 'top_bar', { top_bar: 'icons' }],
    ['Faixa de cima', 'Esconder', 'top_bar', { top_bar: 'hidden' }],
    ['Altura do banner', 'Tela cheia', 'hero_height', { hero_height: 'full' }],
    ['Jeito do rodapé', 'Compacto', 'footer_layout', { footer_layout: 'compact' }],
  ];

  it.each(casos)('%s › %s troca o valor (com aria-pressed) e manda a aparência inteira', async (grupo, opcao, _chave, esperado) => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const botao = within(screen.getByRole('group', { name: grupo })).getByRole('button', { name: new RegExp(`^${opcao.replace(/[()]/g, '\\$&')}`) });
    expect(botao.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(botao);
    const enviado = espiao.mock.calls.at(-1)![0].appearance;
    expect(enviado).toMatchObject(esperado);
    // O objeto inteiro: as outras chaves continuam na fábrica.
    expect(Object.keys(enviado).sort()).toEqual(['background', 'footer_layout', 'footer_text', 'header_style',
      'hero_height', 'hero_overlay', 'logo_light_url', 'top_bar']);
    expect(botao.getAttribute('aria-pressed')).toBe('true');
  });

  it('a fábrica vem marcada e nada é gravado ao abrir', () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    expect(within(screen.getByRole('group', { name: 'Fundo do site' })).getByRole('button', { name: /^Claro/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(screen.getByRole('group', { name: 'Faixa de cima' })).getByRole('button', { name: /^Telefone, e-mail e redes/ }).getAttribute('aria-pressed')).toBe('true');
    expect(espiao).not.toHaveBeenCalled();
  });

  it('as opções da faixa de cima têm o nome do que o site faz (nunca "2 telefones")', () => {
    render(<Montar espiao={vi.fn()} />);
    const nomes = within(screen.getByRole('group', { name: 'Faixa de cima' })).getAllByRole('button').map(b => b.textContent);
    expect(nomes.map(n => n!.split(/O nome|Sem telefone|Telefone, e-mail e redes só|Sem a faixa/)[0])).toEqual([
      'Telefone, e-mail e redes', 'Telefone e redes (sem e-mail)', 'Só ícones', 'Esconder',
    ]);
    expect(screen.queryByText(/2 telefones|dois telefones/i)).toBeNull();
  });

  it('fundo escuro sem logo clara avisa em âmbar; com logo clara, não', () => {
    const { rerender } = render(<Montar espiao={vi.fn()} inicial={{
      logo_url: 'https://cdn/logo.png', appearance: { ...APARENCIA_FABRICA, background: 'dark' },
    }} />);
    expect(screen.getByText('Com fundo escuro, envie a logo clara: a logo normal pode sumir no topo e no rodapé.')).toBeTruthy();
    rerender(<Montar key="2" espiao={vi.fn()} inicial={{
      logo_url: 'https://cdn/logo.png', appearance: { ...APARENCIA_FABRICA, background: 'dark', logo_light_url: 'https://cdn/clara.png' },
    }} />);
    expect(screen.queryByText(/envie a logo clara/)).toBeNull();
  });

  it('enviar a logo clara grava logo_light_url', async () => {
    mocks.uploadAsset.mockResolvedValue({ url: 'https://cdn/clara.png' });
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    await userEvent.upload(screen.getByLabelText('Escolher arquivo: logo clara'), png('clara.png'));
    await waitFor(() => expect(espiao).toHaveBeenCalledWith({ appearance: expect.objectContaining({ logo_light_url: 'https://cdn/clara.png' }) }));
    expect(mocks.extractLogoColors).not.toHaveBeenCalled();
  });

  it('o filtro do banner mostra o valor em % e grava o número', () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const filtro = screen.getByLabelText('Filtro escuro sobre a foto') as HTMLInputElement;
    expect(filtro.value).toBe('45');
    expect(screen.getByText('45%')).toBeTruthy();
    fireEvent.change(filtro, { target: { value: '60' } });
    expect(espiao.mock.calls.at(-1)![0].appearance.hero_overlay).toBe(60);
    expect(screen.getByText('60%')).toBeTruthy();
  });

  it('frase do rodapé com contador de 200; em branco volta a null', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const campo = screen.getByLabelText('Frase do rodapé') as HTMLTextAreaElement;
    expect(campo.maxLength).toBe(200);
    await userEvent.type(campo, 'Desde 1998');
    expect(espiao.mock.calls.at(-1)![0].appearance.footer_text).toBe('Desde 1998');
    expect(screen.getByText(/^10 de 200 caracteres/)).toBeTruthy();
    await userEvent.clear(campo);
    expect(espiao.mock.calls.at(-1)![0].appearance.footer_text).toBeNull();
  });

  it('o rodapé compacto diz que não mostra telefone, e-mail, endereço nem redes', () => {
    render(<Montar espiao={vi.fn()} />);
    expect(screen.getByText(/Não mostra telefone, e-mail, endereço nem redes\./)).toBeTruthy();
  });

  it('avisa que o "feito com LM Flow" fica, discreto', () => {
    render(<Montar espiao={vi.fn()} />);
    expect(screen.getByText(/fica sempre, discreto, o “feito com LM Flow”/)).toBeTruthy();
  });

  it('a ajuda da cor principal lista o que o site pinta com ela', () => {
    render(<Montar espiao={vi.fn()} />);
    const ajuda = document.getElementById('aparencia-cor-principal-ajuda')!.textContent!;
    for (const parte of ['Tenho interesse', 'botão de busca', 'enviar dos formulários', 'passos do Anuncie',
      'aba escolhida na busca', 'selo da fase', 'preço das plantas', 'links', 'barrinha da página de manutenção']) {
      expect(ajuda).toContain(parte);
    }
  });
});
