import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SiteInfo } from '../portalShared';
import { APARENCIA_FABRICA, type Aparencia } from '@/features/siteBuilder/public/aparenciaConfig';
import { abrirHome, empreendimento, imovel } from '../home/servidorDeTeste';

/* ────────────────────────────────────────────────────────────────────────────
   Início do Moderno, parte 1 (spec 6.1, 6.2, 6.4 e 7 "Início"): capa em
   cartão com a busca de hoje, vitrines em cartões de foto inteira, Como
   funciona em cartões numerados, Atendimento e a faixa de números de hoje.
   Mesmos dados e mesmos destinos do Clássico; muda só o desenho.
──────────────────────────────────────────────────────────────────────────── */

const moderno = (extra: Partial<SiteInfo> = {}, ap: Partial<Aparencia> = {}): SiteInfo => ({
  ...extra, appearance: { ...APARENCIA_FABRICA, style: 'modern', heading_highlight: 'accent', ...ap },
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('Início do Moderno', () => {
  it('capa: o título da busca no h1, com o trecho entre asteriscos em destaque', async () => {
    await abrirHome(moderno({ home: { search: { title: 'Seu lar *aqui*' } } } as SiteInfo), [imovel('R1')]);

    const h1 = screen.getByRole('heading', { level: 1, name: 'Seu lar aqui' });
    expect(h1.querySelector('span[data-destaque="accent"]')?.textContent).toBe('aqui');
    expect(screen.queryByText(/\*/)).toBeNull();
    // A capa do Clássico não sai junto.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('busca da capa na aba Alugar leva faixa de preço (do aluguel) e suítes para a URL, igual ao Clássico', async () => {
    await abrirHome(
      moderno({ home: { search: { fields: ['price', 'suites', 'stage'] } } } as SiteInfo),
      [imovel('R1'), imovel('L1', { transaction_type: 'rent', rent_price_from: 2000, sale_price_from: null })],
    );

    fireEvent.click(screen.getByRole('button', { name: 'Alugar' }));
    expect(screen.queryByLabelText('Fase')).toBeNull();
    fireEvent.change(screen.getByLabelText('Faixa de preço'), { target: { value: '1500.01-3000' } });
    fireEvent.change(screen.getByLabelText('Suítes'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));

    expect((await screen.findByTestId('busca')).textContent).toBe('?tab=rent&price_min=1500.01&price_max=3000&suites=2');
  });

  it('busca por código leva o código pra URL', async () => {
    await abrirHome(moderno({ home: { search: { fields: ['code'] } } } as SiteInfo), [imovel('R1')]);

    fireEvent.change(screen.getByLabelText('Código do imóvel'), { target: { value: 'AP0566' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?code=AP0566');
  });

  it('vitrine com 3 imóveis: 3 cartões de foto inteira com preço e "Ver detalhes" levando à ficha', async () => {
    const itens = ['R1', 'R2', 'R3'].map(c => imovel(c, { featured: true, display_price: `R$ ${c}`, cover_url: `https://x.com/${c}.jpg` }));
    await abrirHome(moderno(), itens);

    const sec = screen.getByRole('heading', { level: 2, name: 'Imóveis em destaque' }).closest('section')!;
    const cartoes = within(sec).getAllByRole('article');
    expect(cartoes).toHaveLength(3);
    cartoes.forEach((c, k) => {
      const code = itens[k].code;
      expect(within(c).getByText(`R$ ${code}`)).toBeInTheDocument();
      expect(within(c).getByRole('link', { name: /Ver detalhes/ })).toHaveAttribute('href', `/imovel/imob/${code}`);
    });
    expect(within(sec).getByRole('link', { name: /Ver todos os imóveis/ })).toHaveAttribute('href', '/portal/imob/imoveis');
    // Setas do carrossel (com mais de um cartão).
    expect(within(sec).getByRole('button', { name: 'Próximo' })).toBeInTheDocument();
  });

  it('cartões grandes: duas colunas, sem as setas do carrossel', async () => {
    await abrirHome(moderno({}, { card_style: 'large' }), [imovel('R1', { featured: true }), imovel('R2', { featured: true })]);

    const sec = screen.getByRole('heading', { level: 2, name: 'Imóveis em destaque' }).closest('section')!;
    expect(within(sec).getAllByRole('article')).toHaveLength(2);
    expect(within(sec).queryByRole('button', { name: 'Próximo' })).toBeNull();
  });

  it('cartão de empreendimento mostra a fase e a entrega', async () => {
    await abrirHome(moderno(), [empreendimento('E1', { stage: 'in_construction', delivery_forecast: '2027-12-01' })]);

    const lanc = screen.getByRole('heading', { level: 2, name: 'Lançamentos' }).closest('section')!;
    expect(within(lanc).getByText('Em obra · entrega dez/2027')).toBeInTheDocument();
  });

  it('faixa de números: aparece em #sobre com os números de hoje e some com sections.stats desligado', async () => {
    await abrirHome(moderno(), [imovel('R1'), imovel('R2')]);
    const sobre = document.getElementById('sobre')!;
    expect(within(sobre).getByText('2')).toBeInTheDocument();
    expect(within(sobre).getByText('imóveis disponíveis')).toBeInTheDocument();
    expect(within(sobre).getByText('24h')).toBeInTheDocument();
  });

  it('sections.stats desligado: sem a faixa de números', async () => {
    await abrirHome(moderno({ sections: { stats: false } } as SiteInfo), [imovel('R1')]);
    expect(document.getElementById('sobre')).toBeNull();
  });

  it('Como funciona: passos 01 a 04 em cartões; desligado, não aparece', async () => {
    const passos = Array.from({ length: 4 }, (_, k) => ({ title: `Passo ${k + 1}`, text: `Texto ${k + 1}` }));
    await abrirHome(moderno({ home: { steps: { enabled: true, title: 'Do primeiro passo à *chave na mão*', items: passos } } } as SiteInfo), [imovel('R1')]);

    const sec = document.getElementById('como-funciona')!;
    expect(within(sec).getByRole('heading', { level: 2, name: 'Do primeiro passo à chave na mão' })).toBeInTheDocument();
    expect(within(sec).getAllByRole('listitem').map(li => li.textContent)).toEqual(
      ['01Passo 1Texto 1', '02Passo 2Texto 2', '03Passo 3Texto 3', '04Passo 4Texto 4'],
    );
  });

  it('steps.enabled desligado: sem Como funciona', async () => {
    await abrirHome(moderno({ home: { steps: { enabled: false, items: [{ title: 'Passo', text: '' }] } } } as SiteInfo), [imovel('R1')]);
    expect(document.getElementById('como-funciona')).toBeNull();
  });

  it('Atendimento com foto: título, texto, foto e botão que rola até o contato', async () => {
    await abrirHome(moderno({ home: { about: { enabled: true, eyebrow: 'Quem atende', title: 'Fale com a *Ana*', text: 'Corretora há 10 anos.',
      photo_url: 'https://x.com/ana.jpg', button_label: 'Falar', button_link: '#contato' } } } as SiteInfo), [imovel('R1')]);

    const sec = document.getElementById('atendimento')!;
    expect(within(sec).getByRole('heading', { level: 2, name: 'Fale com a Ana' })).toBeInTheDocument();
    expect(within(sec).getByText('Corretora há 10 anos.')).toBeInTheDocument();
    expect(within(sec).getByRole('img').getAttribute('src')).toBe('https://x.com/ana.jpg');
    const botao = within(sec).getByRole('link', { name: 'Falar' });
    expect(botao.getAttribute('href')).toBe('#contato');
    expect(botao.getAttribute('target')).toBeNull();
  });

  it('Atendimento sem título e sem texto: não aparece', async () => {
    await abrirHome(moderno({ home: { about: { enabled: true, eyebrow: 'Só o selo' } } } as SiteInfo), [imovel('R1')]);
    expect(document.getElementById('atendimento')).toBeNull();
  });

  it('destaque "Nenhum": nenhum trecho marcado em nenhum título, e sem asterisco', async () => {
    await abrirHome(
      moderno({ home: { search: { title: 'Seu lar *aqui*' }, showcases: [{ id: 'featured', kind: 'featured', enabled: true, title: 'Destaques *da semana*' }] } } as SiteInfo,
        { heading_highlight: 'none' }),
      [imovel('R1', { featured: true })],
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Seu lar aqui' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Destaques da semana' })).toBeInTheDocument();
    expect(document.querySelector('[data-destaque]')).toBeNull();
    expect(screen.queryByText(/\*/)).toBeNull();
  });

  it('logo em destaque na capa: o logo grande sai na capa com a marca do pouso', async () => {
    await abrirHome(moderno({ branding: { logo_url: 'https://cdn.x/logo.png' } }, { logo_position: 'hero' }), [imovel('R1')]);
    const capa = document.getElementById('topo')!;
    expect(capa.querySelectorAll('img[data-logo-da-capa]').length).toBeGreaterThan(0);
  });

  it('topo transparente flutua sobre o cartão da capa: o cartão deixa o espaço dele em cima; topo branco não', async () => {
    const respiro = () => document.querySelector('[data-capa-moderna] > div:nth-child(2)')!.className;
    await abrirHome(moderno({}, { header_style: 'transparent' }), [imovel('R1')]);
    expect(respiro()).toContain('pt-[96px]');
    cleanup();
    await abrirHome(moderno({}, { header_style: 'white' }), [imovel('R1')]);
    expect(respiro()).not.toContain('pt-[96px]');
  });

  it('capa dividida: título no claro e a foto num cartão ao lado, depois do texto', async () => {
    await abrirHome(moderno({ hero: { image_url: 'https://x.com/capa.jpg' } } as SiteInfo, { hero_layout: 'split' }), [imovel('R1')]);
    const capa = document.getElementById('topo')!;
    const h1 = within(capa).getByRole('heading', { level: 1 });
    const foto = capa.querySelector('img[src="https://x.com/capa.jpg"]')!;
    expect(h1.compareDocumentPosition(foto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ordem: capa, vitrines, Como funciona, Atendimento, números', async () => {
    await abrirHome(moderno({ home: { steps: { enabled: true, items: [{ title: 'Um', text: '' }] }, about: { enabled: true, title: 'Oi' } } } as SiteInfo),
      [imovel('R1', { featured: true })]);
    const ordem = [
      document.getElementById('topo')!, screen.getByRole('heading', { level: 2, name: 'Imóveis em destaque' }),
      document.getElementById('como-funciona')!, document.getElementById('atendimento')!, document.getElementById('sobre')!,
    ];
    for (let k = 0; k < ordem.length - 1; k++) {
      expect(ordem[k].compareDocumentPosition(ordem[k + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
