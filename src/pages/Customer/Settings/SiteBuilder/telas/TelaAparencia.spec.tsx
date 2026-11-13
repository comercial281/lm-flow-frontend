import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Site, SiteFormData } from '@/services/siteBuilder/siteBuilderService';
import { APARENCIA_FABRICA } from '@/features/siteBuilder/public/aparenciaConfig';

const mocks = vi.hoisted(() => ({ uploadAsset: vi.fn(), extractLogoColors: vi.fn() }));
vi.mock('@/services/siteBuilder/siteBuilderService', () => ({ siteBuilderService: { uploadAsset: mocks.uploadAsset } }));
vi.mock('@/utils/logoColors', () => ({ extractLogoColors: mocks.extractLogoColors }));
vi.mock('@/features/siteBuilder/HeroImagePicker', () => ({
  default: ({ open, onPick }: { open: boolean; onPick: (p: unknown) => void }) => open
    ? <button type="button" onClick={() => onPick({ property_id: 'im-7', photo_id: 'ft-7', url: 'https://cdn/im7.jpg', property_title: 'Collina' })}>Escolher no seletor</button>
    : null,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TelaAparencia from './TelaAparencia';
import { reordenarExtras } from './MaisFotosDoBanner';
import { toast } from 'sonner';

function Montar({ espiao, inicial = {}, site = null }: { espiao: (f: Partial<SiteFormData>) => void; inicial?: Partial<SiteFormData>; site?: Site | null }) {
  const [form, setForm] = useState<SiteFormData>({ name: 'Imobiliária Horizonte Azul', ...inicial });
  const setF = (f: Partial<SiteFormData>) => { espiao(f); setForm(prev => ({ ...prev, ...f })); };
  return <TelaAparencia site={site} siteForm={form} setF={setF} heroPickPreview={null} setHeroPickPreview={vi.fn()} />;
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
    ['Logo na página inicial', 'Em destaque na capa', 'logo_position', { logo_position: 'hero' }],
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
    expect(Object.keys(enviado).sort()).toEqual(['background', 'card_style', 'footer_layout', 'footer_text', 'header_style',
      'heading_font', 'heading_highlight', 'hero_height', 'hero_layout', 'hero_overlay', 'logo_light_url', 'logo_position', 'menu_style', 'style', 'top_bar']);
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

  it('o contador da frase do rodapé conta por caractere e corta no 200º (emoji inteiro)', () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} />);
    const campo = screen.getByLabelText('Frase do rodapé');
    fireEvent.change(campo, { target: { value: '🏠🏠' } });
    expect(screen.getByText(/^2 de 200 caracteres/)).toBeTruthy();
    fireEvent.change(campo, { target: { value: `${'a'.repeat(199)}🏠🏠` } });
    expect(espiao.mock.calls.at(-1)![0].appearance.footer_text).toBe(`${'a'.repeat(199)}🏠`);
    expect(screen.getByText(/^200 de 200 caracteres/)).toBeTruthy();
  });

  it('a miniatura "Na cor principal" desenha o texto com a cor legível sobre a marca', () => {
    render(<Montar espiao={vi.fn()} inicial={{ primary_color: '#FACC15' }} />);
    const botao = within(screen.getByRole('group', { name: 'Estilo do topo' })).getByRole('button', { name: /^Na cor principal/ });
    const barra = [...botao.querySelectorAll('span')].find(el => (el as HTMLElement).style.background === 'rgb(250, 204, 21)')!;
    expect((barra.firstElementChild as HTMLElement).style.background).toBe('rgb(23, 20, 15)');
  });
});

describe('TelaAparencia · logo na página inicial', () => {
  const LOGO = 'https://cdn/logo.png';
  const ap = (extra: Partial<typeof APARENCIA_FABRICA>) => ({ ...APARENCIA_FABRICA, ...extra });

  it('no topo (fábrica) vem marcado, sem explicação nem aviso', () => {
    render(<Montar espiao={vi.fn()} inicial={{ logo_url: LOGO }} />);
    const grupo = screen.getByRole('group', { name: 'Logo na página inicial' });
    expect(within(grupo).getByRole('button', { name: /^No topo/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText(/No celular, o logo fica em cima do título/)).toBeNull();
  });

  it('em destaque: explica o celular e as outras páginas', () => {
    render(<Montar espiao={vi.fn()} inicial={{ logo_url: LOGO, appearance: ap({ logo_position: 'hero' }) }} />);
    expect(screen.getByText(/No celular, o logo fica em cima do título/)).toBeTruthy();
    expect(screen.queryByText(/Com a capa dividida/)).toBeNull();
    expect(screen.queryByText(/Envie o logo em Logotipos/)).toBeNull();
  });

  it('em destaque com a capa dividida: avisa que o logo continua no topo', () => {
    render(<Montar espiao={vi.fn()} inicial={{ logo_url: LOGO, appearance: ap({ logo_position: 'hero', hero_layout: 'split' }) }} />);
    expect(screen.getByText(/Com a capa dividida \(modelos Editorial e Popular\)/)).toBeTruthy();
  });

  it('em destaque sem logo enviado: pede o logo', () => {
    render(<Montar espiao={vi.fn()} inicial={{ appearance: ap({ logo_position: 'hero' }) }} />);
    expect(screen.getByText(/Envie o logo em Logotipos/)).toBeTruthy();
  });
});

describe('TelaAparencia · Mais fotos do banner', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const upload = (n: number) => ({ mode: 'upload' as const, url: `https://cdn/${n}.jpg` });

  it('no automático não mostra Mais fotos', () => {
    render(<Montar espiao={vi.fn()} inicial={{ hero_image: { mode: 'auto' }, hero_image_extras: [upload(1)] }} />);
    expect(screen.queryByText('Mais fotos')).toBeNull();
  });

  it('adicionar foto enviada entra em hero_image_extras', async () => {
    mocks.uploadAsset.mockResolvedValue({ url: 'https://cdn/extra.jpg' });
    const espiao = vi.fn();
    render(<Montar espiao={espiao} inicial={{ hero_image: { mode: 'upload', url: 'https://cdn/1.jpg' }, hero_image_extras: [] }} />);
    expect(screen.getByText('Mais fotos')).toBeTruthy();
    expect(screen.getByText('Com 2 fotos ou mais, o banner troca de foto a cada 6 segundos.')).toBeTruthy();
    await userEvent.upload(screen.getByLabelText('Escolher arquivo: mais fotos do banner'), png('extra.png'));
    await waitFor(() => expect(espiao).toHaveBeenCalledWith({ hero_image_extras: [{ mode: 'upload', url: 'https://cdn/extra.jpg' }] }));
  });

  it('com 5 extras os botões de adicionar somem', () => {
    render(<Montar espiao={vi.fn()} inicial={{ hero_image: { mode: 'upload', url: 'https://cdn/1.jpg' }, hero_image_extras: [1, 2, 3, 4, 5].map(upload) }} />);
    const bloco = screen.getByRole('group', { name: 'Mais fotos' });
    expect(within(bloco).queryByRole('button', { name: 'Enviar foto' })).toBeNull();
    expect(within(bloco).queryByRole('button', { name: 'Foto de um imóvel' })).toBeNull();
    expect(within(bloco).getAllByRole('button', { name: /^Remover a \d/ })).toHaveLength(5);
  });

  it('remover tira a foto da lista', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} inicial={{ hero_image: { mode: 'upload', url: 'https://cdn/1.jpg' }, hero_image_extras: [upload(1), upload(2)] }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remover a 1ª foto extra' }));
    expect(espiao).toHaveBeenCalledWith({ hero_image_extras: [upload(2)] });
  });

  it('extra de imóvel despublicado mostra o aviso', () => {
    const site = { hero_image_extras: [{
      mode: 'property', property_id: 'im-9', photo_id: 'ft-9', url: null,
      property: { id: 'im-9', title: 'Collina', code: 'AP9' }, reason: 'imovel_despublicado',
    }] } as unknown as Site;
    render(<Montar espiao={vi.fn()} site={site}
      inicial={{ hero_image: { mode: 'upload', url: 'https://cdn/1.jpg' }, hero_image_extras: [{ mode: 'property', property_id: 'im-9', photo_id: 'ft-9' }] }} />);
    expect(screen.getByText('Esta foto saiu do banner: o imóvel foi despublicado.')).toBeTruthy();
    expect(screen.queryByText(/voltou ao automático/)).toBeNull();
  });

  it('foto 1 despublicada com extra válida: o aviso diz que o banner segue com as outras fotos', () => {
    const site = {
      hero_image: {
        mode: 'property', property_id: 'im-1', photo_id: null, url: null,
        property: { id: 'im-1', title: 'Collina', code: 'AP1' }, reason: 'imovel_despublicado',
      },
      hero_image_extras: [{ mode: 'upload', url: 'https://cdn/2.jpg' }],
    } as unknown as Site;
    render(<Montar espiao={vi.fn()} site={site}
      inicial={{ hero_image: { mode: 'property', property_id: 'im-1', photo_id: null }, hero_image_extras: [{ mode: 'upload', url: 'https://cdn/2.jpg' }] }} />);
    expect(screen.getByText('A foto principal saiu do banner: o imóvel «Collina» não está mais publicado no site. O banner segue com as outras fotos.')).toBeTruthy();
    expect(screen.queryByText(/voltou ao automático/)).toBeNull();
  });

  it('escolher a foto de um imóvel entra em hero_image_extras e mostra a prévia', async () => {
    const espiao = vi.fn();
    render(<Montar espiao={espiao} inicial={{ hero_image: { mode: 'upload', url: 'https://cdn/1.jpg' }, hero_image_extras: [] }} />);
    const bloco = screen.getByRole('group', { name: 'Mais fotos' });
    await userEvent.click(within(bloco).getByRole('button', { name: 'Foto de um imóvel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Escolher no seletor' }));
    expect(espiao).toHaveBeenCalledWith({ hero_image_extras: [{ mode: 'property', property_id: 'im-7', photo_id: 'ft-7' }] });
    expect((bloco.querySelector('img') as HTMLImageElement).src).toBe('https://cdn/im7.jpg');
    expect(within(bloco).getByText('Collina')).toBeTruthy();
  });

  it('falha no envio mostra erro e não adiciona a foto', async () => {
    mocks.uploadAsset.mockRejectedValue(new Error('boom'));
    const espiao = vi.fn();
    render(<Montar espiao={espiao} inicial={{ hero_image: { mode: 'upload', url: 'https://cdn/1.jpg' }, hero_image_extras: [] }} />);
    await userEvent.upload(screen.getByLabelText('Escolher arquivo: mais fotos do banner'), png('x.png'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falha no upload da foto.'));
    expect(espiao).not.toHaveBeenCalledWith(expect.objectContaining({ hero_image_extras: expect.anything() }));
  });

  it('reordenar move a foto para o lugar da outra', () => {
    const lista = ['a', 'b', 'c'];
    expect(reordenarExtras(lista, ['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
    expect(reordenarExtras(lista, ['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(reordenarExtras(lista, ['a', 'b', 'c'], 'a', 'a')).toBe(lista);
    expect(reordenarExtras(lista, ['a', 'b', 'c'], 'a', 'zz')).toBe(lista);
  });
});

describe('TelaAparencia · Destaque nos títulos', () => {
  it('só aparece no Moderno e grava heading_highlight', async () => {
    const espiao = vi.fn();
    const { unmount } = render(<Montar espiao={espiao} />);
    expect(screen.queryByRole('heading', { name: 'Destaque nos títulos' })).toBeNull();
    unmount();
    render(<Montar espiao={espiao} inicial={{ appearance: { ...APARENCIA_FABRICA, style: 'modern' } }} />);
    expect(screen.getByRole('heading', { name: 'Destaque nos títulos' })).toBeTruthy();
    const grupo = screen.getByRole('group', { name: 'Destaque nos títulos' });
    expect(within(grupo).getByRole('button', { name: /Cor de destaque/ }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(within(grupo).getByRole('button', { name: /Itálico/ }));
    expect(espiao.mock.calls.at(-1)![0].appearance.heading_highlight).toBe('italic');
    await userEvent.click(within(grupo).getByRole('button', { name: /Nenhum/ }));
    expect(espiao.mock.calls.at(-1)![0].appearance.heading_highlight).toBe('none');
  });
});
