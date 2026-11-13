import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SiteInfo } from '../portalShared';
import { APARENCIA_FABRICA, type Aparencia } from '@/features/siteBuilder/public/aparenciaConfig';
import { abrirHome, empreendimento, imovel } from '../home/servidorDeTeste';
import { BR_PHONE_PLACEHOLDER } from '@/lib/brPhone';

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

  it('setas só quando o carrossel tem o que rolar (cartões que cabem na largura: sem setas)', async () => {
    const itens = ['R1', 'R2'].map(c => imovel(c, { featured: true }));
    const largura = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1120);
    const conteudo = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(614);
    try {
      await abrirHome(moderno(), itens);
      const sec = (await screen.findByRole('heading', { level: 2, name: 'Imóveis em destaque' })).closest('section')!;
      expect(within(sec).getAllByRole('article')).toHaveLength(2);
      await waitFor(() => expect(within(sec).queryByRole('button', { name: 'Próximo' })).toBeNull());
      cleanup();

      conteudo.mockReturnValue(1690);
      await abrirHome(moderno(), itens);
      const sec2 = (await screen.findByRole('heading', { level: 2, name: 'Imóveis em destaque' })).closest('section')!;
      await new Promise(r => setTimeout(r, 0));
      expect(within(sec2).getByRole('button', { name: 'Próximo' })).toBeInTheDocument();
    } finally {
      largura.mockRestore(); conteudo.mockRestore();
    }
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

  it('Atendimento sem foto e sem selo: uma coluna só, sem a coluna da esquerda vazia', async () => {
    await abrirHome(moderno({ home: { about: { enabled: true, title: 'Fale com a gente', text: 'Atendimento humano.' } } } as SiteInfo), [imovel('R1')]);

    const grade = document.getElementById('atendimento')!.firstElementChild!;
    expect(grade.children).toHaveLength(1);
    expect(grade.className).not.toContain('md:grid-cols-');
    expect(within(grade as HTMLElement).getByRole('heading', { level: 2, name: 'Fale com a gente' })).toBeInTheDocument();
  });

  it('Atendimento sem foto e com selo: o selo à esquerda e o título à direita, como no protótipo', async () => {
    await abrirHome(moderno({ home: { about: { enabled: true, eyebrow: 'Atendimento', title: 'Fale com a gente' } } } as SiteInfo), [imovel('R1')]);

    const grade = document.getElementById('atendimento')!.firstElementChild!;
    expect(grade.children).toHaveLength(2);
    expect(grade.children[0].textContent).toBe('Atendimento');
    expect(grade.className).toContain('md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]');
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

  it('logo em destaque: os tamanhos do Clássico, e no computador centrado no bloco do título, na borda direita da busca', async () => {
    await abrirHome(moderno({ branding: { logo_url: 'https://cdn.x/logo.png' } }, { logo_position: 'hero' }), [imovel('R1')]);
    const [celular, computador] = Array.from(document.querySelectorAll<HTMLImageElement>('#topo img[data-logo-da-capa]'));
    const cls = (el: Element) => el.className.split(/\s+/);

    expect(cls(celular)).toEqual(expect.arrayContaining(['h-20', 'sm:h-24', 'max-w-[75%]', 'lg:hidden']));
    expect(cls(computador)).toEqual(expect.arrayContaining(['h-[126px]', 'max-w-[420px]', 'object-right', 'hidden', 'lg:block', 'self-center']));
    // A fileira do texto centra o logo no bloco título + subtítulo (não no pé dele)…
    const fileira = computador.parentElement!;
    expect(fileira.hasAttribute('data-capa-texto')).toBe(true);
    expect(cls(fileira)).toContain('items-center');
    expect(cls(fileira)).not.toContain('items-end');
    // …e o recuo da direita no computador é o mesmo da margem da busca.
    expect(cls(fileira)).toContain('lg:pr-[clamp(12px,3vw,32px)]');
    expect(cls(document.querySelector('form[role="search"]')!)).toContain('mx-[clamp(12px,3vw,32px)]');
    // O título e o subtítulo ficam juntos na coluna da esquerda.
    expect(fileira.firstElementChild!.querySelector('h1')).not.toBeNull();
  });

  it('busca com 6 campos: 6 caixinhas iguais em 3 colunas, e o Buscar numa coluna própria no pé da última linha', async () => {
    await abrirHome(
      moderno({ home: { search: { fields: ['type', 'city', 'neighborhood', 'price', 'bedrooms', 'parking', 'code'] } } } as SiteInfo),
      [imovel('R1')],
    );
    const grade = document.querySelector<HTMLElement>('[data-campos-da-busca]')!;
    const caixas = grade.querySelectorAll('[data-campo-da-busca]');
    expect(caixas).toHaveLength(6);
    expect(grade.className.split(/\s+/)).toContain('lg:grid-cols-3');
    // Toda caixinha com a mesma classe (sem linha solta entre campos).
    expect(new Set(Array.from(caixas, c => c.className)).size).toBe(1);
    expect(caixas[0].className).not.toMatch(/border-l/);

    const buscar = screen.getByRole('button', { name: /Buscar/ });
    expect(grade.contains(buscar)).toBe(false);
    expect(grade.nextElementSibling).toBe(buscar);
    expect(buscar.className.split(/\s+/)).toEqual(expect.arrayContaining(['lg:self-end', 'min-h-[60px]', 'w-full']));
    expect(caixas[0].className.split(/\s+/)).toContain('min-h-[60px]');
    // Código continua na fileira das abas.
    expect(screen.getByLabelText('Código do imóvel')).toBeTruthy();
  });

  it('busca com 4 campos: 4 caixinhas numa linha só e o Buscar ao lado; com 5, o Buscar ocupa a vaga no fim da última linha', async () => {
    await abrirHome(moderno({ home: { search: { fields: ['type', 'city', 'price', 'bedrooms', 'code'] } } } as SiteInfo), [imovel('R1')]);
    let grade = document.querySelector<HTMLElement>('[data-campos-da-busca]')!;
    expect(grade.querySelectorAll('[data-campo-da-busca]')).toHaveLength(4);
    expect(grade.className.split(/\s+/)).toContain('lg:grid-cols-4');
    expect(grade.nextElementSibling).toBe(screen.getByRole('button', { name: /Buscar/ }));
    cleanup();

    await abrirHome(moderno({ home: { search: { fields: ['type', 'city', 'neighborhood', 'price', 'bedrooms'] } } } as SiteInfo), [imovel('R1')]);
    grade = document.querySelector<HTMLElement>('[data-campos-da-busca]')!;
    expect(grade.querySelectorAll('[data-campo-da-busca]')).toHaveLength(5);
    expect(grade.className.split(/\s+/)).toContain('lg:grid-cols-3');
    expect(grade.lastElementChild).toBe(screen.getByRole('button', { name: /Buscar/ }));
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

  it('ordem: capa, vitrines, Como funciona, chamadas, Atendimento, Mais buscados, números, "Não achou?"', async () => {
    await abrirHome(moderno({
      financiamento: { enabled: true }, anuncie: { enabled: true },
      home: { steps: { enabled: true, items: [{ title: 'Um', text: '' }] }, about: { enabled: true, title: 'Oi' },
        most_searched: { mode: 'manual', items: [{ label: 'Casas', transaction: 'sale', property_type: 'apartment' }] } },
    } as SiteInfo), [imovel('R1', { featured: true })]);
    const ordem = [
      document.getElementById('topo')!, screen.getByRole('heading', { level: 2, name: 'Imóveis em destaque' }),
      document.getElementById('como-funciona')!, document.querySelector('[data-chamadas]')!, document.getElementById('atendimento')!,
      document.querySelector('[data-mais-buscados]')!, document.getElementById('sobre')!, document.getElementById('contato')!,
    ];
    ordem.forEach(el => expect(el).toBeTruthy());
    for (let k = 0; k < ordem.length - 1; k++) {
      expect(ordem[k].compareDocumentPosition(ordem[k + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   Início do Moderno, parte 2: chamadas nos 3 jeitos, Mais buscados em
   mosaico e "Não achou?". Mesmas chamadas, atalhos e envio do Clássico.
──────────────────────────────────────────────────────────────────────────── */

const TITULOS_DE_FABRICA = ['Financiamento', 'Anuncie seu imóvel', 'Imóvel sob encomenda'];
const comChamadas = (callouts: Record<string, unknown>, extra: Partial<SiteInfo> = {}) =>
  moderno({ financiamento: { enabled: true }, anuncie: { enabled: true }, ...extra, home: { callouts } } as SiteInfo);
const chamadas = () => document.querySelector<HTMLElement>('[data-chamadas]')!;

describe('Início do Moderno: chamadas', () => {
  it.each(['band', 'photo', 'cards'])('jeito %s: os 3 títulos de fábrica, sem asterisco', async layout => {
    await abrirHome(comChamadas({ layout }), [imovel('R1')]);
    const sec = chamadas();
    expect(sec.getAttribute('data-chamadas')).toBe(layout);
    for (const t of TITULOS_DE_FABRICA) expect(within(sec).getAllByText(t).length).toBeGreaterThan(0);
  });

  it('Faixa e Cartões: cada chamada com o botão e o destino de hoje', async () => {
    await abrirHome(comChamadas({ layout: 'band' }), [imovel('R1')]);
    const sec = chamadas();
    expect(within(sec).getAllByRole('heading', { level: 3 }).map(h => h.textContent)).toEqual(TITULOS_DE_FABRICA);
    expect(within(sec).getByRole('link', { name: /Faça uma simulação/ })).toHaveAttribute('href', '/portal/imob/financiamento');
    expect(within(sec).getByRole('link', { name: /Cadastre seu imóvel/ })).toHaveAttribute('href', '/portal/imob/anuncie');
    expect(within(sec).getByRole('link', { name: /Encomende seu imóvel/ })).toHaveAttribute('href', '#contato');
  });

  it('Cartões: o primeiro na cor principal, os outros claros', async () => {
    await abrirHome(comChamadas({ layout: 'cards' }), [imovel('R1')]);
    const cartoes = within(chamadas()).getAllByRole('link');
    expect(cartoes).toHaveLength(3);
    expect(cartoes[0].getAttribute('data-principal')).toBe('');
    expect(cartoes[1].getAttribute('data-principal')).toBeNull();
  });

  it('Foto: "Como podemos ajudar?" lista as chamadas; clicar em "Imóvel sob encomenda" troca título, texto, botão e contador', async () => {
    await abrirHome(comChamadas({ layout: 'photo' }), [imovel('R1')]);
    const sec = chamadas();
    expect(within(sec).getByText('Como podemos ajudar?')).toBeInTheDocument();
    expect(within(sec).getByRole('heading', { level: 3, name: 'Financiamento' })).toBeInTheDocument();
    expect(within(sec).getByText('01 / 03')).toBeInTheDocument();

    fireEvent.click(within(sec).getByRole('button', { name: 'Imóvel sob encomenda' }));
    expect(within(sec).getByRole('heading', { level: 3, name: 'Imóvel sob encomenda' })).toBeInTheDocument();
    expect(within(sec).getByText('Descreva o que você procura e avisamos assim que encontrarmos.')).toBeInTheDocument();
    expect(within(sec).getByRole('link', { name: /Encomende seu imóvel/ })).toHaveAttribute('href', '#contato');
    expect(within(sec).getByText('03 / 03')).toBeInTheDocument();
    expect(within(sec).getByRole('button', { name: 'Imóvel sob encomenda' })).toHaveAttribute('aria-pressed', 'true');

    // As setas andam em volta.
    fireEvent.click(within(sec).getByRole('button', { name: 'Próximo' }));
    expect(within(sec).getByRole('heading', { level: 3, name: 'Financiamento' })).toBeInTheDocument();
  });

  it('Foto: a opção marcada usa branco literal (a regra do fundo escuro repinta .bg-white e deixaria texto escuro sobre quase preto)', async () => {
    await abrirHome(comChamadas({ layout: 'photo' }), [imovel('R1')]);
    const marcada = within(chamadas()).getAllByRole('button').find(b => b.getAttribute('aria-pressed') === 'true')!;
    expect(marcada.className).toContain('bg-[#FFFFFF]');
    expect(marcada.className.split(/\s+/)).not.toContain('bg-white');
  });

  it('Foto: a foto é a do fundo das chamadas; sem ela, a foto da capa', async () => {
    await abrirHome(comChamadas({ layout: 'photo', background_url: 'https://x.com/fundo.jpg', overlay: 40 },
      { hero: { image_url: 'https://x.com/capa.jpg' } }), [imovel('R1')]);
    expect(chamadas().querySelector('img')!.getAttribute('src')).toBe('https://x.com/fundo.jpg');
    cleanup();
    await abrirHome(comChamadas({ layout: 'photo' }, { hero: { image_url: 'https://x.com/capa.jpg' } }), [imovel('R1')]);
    expect(chamadas().querySelector('img')!.getAttribute('src')).toBe('https://x.com/capa.jpg');
  });

  it('título de chamada com asterisco: destaque no Moderno', async () => {
    await abrirHome(moderno({ financiamento: { enabled: true }, home: { callouts: { layout: 'band', defaults: {
      financing: { enabled: true, title: 'Financie *fácil*' } } } } } as SiteInfo), [imovel('R1')]);
    const h3 = within(chamadas()).getByRole('heading', { level: 3, name: 'Financie fácil' });
    expect(h3.querySelector('[data-destaque="accent"]')?.textContent).toBe('fácil');
  });

  it('menos de 2 chamadas: a faixa some (regra do Clássico)', async () => {
    await abrirHome(moderno({ sections: { lead_capture: true } } as SiteInfo), [imovel('R1')]);
    expect(document.querySelector('[data-chamadas]')).toBeNull();
  });
});

describe('Início do Moderno: Mais buscados em mosaico', () => {
  const manual = (...labels: [string, string][]) => ({ home: { most_searched: { mode: 'manual', items: labels.map(([label, property_type]) => ({
    label, transaction: 'sale', property_type, city: null, neighborhood: null, price_max: null })) } } }) as SiteInfo;
  const mosaico = () => document.querySelector<HTMLElement>('[data-mais-buscados]')!;

  it('atalho com foto vira bloco (foto do mais recente, rótulo e contagem); sem foto vira pílula; sem bloco vazio', async () => {
    await abrirHome(moderno(manual(['Apartamentos', 'apartment'], ['Casas', 'house'])), [
      imovel('A1', { cover_url: 'https://x.com/a1.jpg', created_at: '2026-01-01T00:00:00Z' }),
      imovel('A2', { cover_url: 'https://x.com/a2.jpg', created_at: '2026-06-01T00:00:00Z' }),
      imovel('C1', { property_type: 'house', cover_url: null }),
    ]);
    const sec = mosaico();
    const blocos = sec.querySelectorAll('[data-bloco]');
    expect(blocos).toHaveLength(1);
    const bloco = blocos[0] as HTMLElement;
    expect(bloco.querySelector('img')!.getAttribute('src')).toBe('https://x.com/a2.jpg');
    expect(bloco).toHaveAttribute('href', '/portal/imob/imoveis?type=apartment');
    expect(bloco.textContent).toContain('Apartamentos');
    expect(bloco.textContent).toContain('2');

    const pilula = within(sec).getByRole('link', { name: 'Casas' });
    expect(pilula).toHaveAttribute('href', '/portal/imob/imoveis?type=house');
    expect(pilula.querySelector('img')).toBeNull();
    expect(pilula.hasAttribute('data-bloco')).toBe(false);
  });

  it('nenhum atalho com foto: só pílulas, sem o mosaico', async () => {
    await abrirHome(moderno(manual(['Apartamentos', 'apartment'])), [imovel('A1')]);
    const sec = mosaico();
    expect(sec.querySelector('[data-mosaico]')).toBeNull();
    expect(sec.querySelectorAll('img')).toHaveLength(0);
    expect(within(sec).getByRole('link', { name: 'Apartamentos' })).toBeInTheDocument();
  });

  it('até 4 blocos; o quinto atalho com foto vira pílula', async () => {
    const tipos = ['apartment', 'house', 'lot', 'commercial', 'farm'];
    await abrirHome(moderno(manual(...tipos.map(t => [t, t] as [string, string]))),
      tipos.map(t => imovel(t, { property_type: t, cover_url: `https://x.com/${t}.jpg` })));
    const sec = mosaico();
    expect(sec.querySelectorAll('[data-bloco]')).toHaveLength(4);
    expect(within(sec).getByRole('link', { name: 'farm' }).querySelector('img')).toBeNull();
  });

  it('site só de aluguel no automático: o mosaico segue a aba da busca e mostra o bloco', async () => {
    const aluguel = (code: string) => imovel(code, { transaction_type: 'rent', rent_price_from: 2000, sale_price_from: null,
      cover_url: `https://x.com/${code}.jpg`, address: { city: 'Campinas', neighborhood: 'Cambuí' } });
    await abrirHome(moderno(), [aluguel('L1'), aluguel('L2')]);
    const blocos = mosaico().querySelectorAll('[data-bloco]');
    expect(blocos.length).toBeGreaterThanOrEqual(1);
    expect(blocos[0].textContent).toContain('2');
  });

  it('Mais buscados desligado: a seção some', async () => {
    await abrirHome(moderno({ home: { most_searched: { enabled: false } } } as SiteInfo), [imovel('A1'), imovel('A2')]);
    expect(document.querySelector('[data-mais-buscados]')).toBeNull();
  });
});

describe('Início do Moderno: "Não achou?"', () => {
  const contato = { whatsapp: '5511987654321', phone: '(11) 3333-4444', email: 'contato@imob.com.br' };

  it('mesmo envio do Clássico: POST /site/leads com form_type home, e o obrigado', async () => {
    await abrirHome(moderno({ contact: contato } as SiteInfo), [imovel('R1')]);
    const sec = document.getElementById('contato')!;
    await userEvent.type(within(sec).getByPlaceholderText('Como podemos te chamar?'), 'Maria');
    await userEvent.type(within(sec).getByPlaceholderText(BR_PHONE_PLACEHOLDER), '11987654321');
    await userEvent.click(within(sec).getByRole('button', { name: 'Quero ajuda pra encontrar' }));

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/site/leads'))).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([u]) => String(u).includes('/site/leads'))!;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ lead: {
      name: 'Maria', phone: '11987654321', source: 'portal', form_type: 'home', finalidade: 'venda',
      message: 'Quero ajuda pra encontrar um imóvel (portal home).',
    } });
    expect(await screen.findByText('Recebemos seu contato!')).toBeInTheDocument();
  });

  it('título com o destaque, "Quero comprar / Quero alugar" e o painel com WhatsApp, telefone e e-mail do site', async () => {
    await abrirHome(moderno({ contact: contato } as SiteInfo), [imovel('R1')]);
    const sec = document.getElementById('contato')!;
    expect(within(sec).getByRole('heading', { level: 2, name: 'Não achou? A gente encontra pra você.' })).toBeInTheDocument();
    expect(within(sec).getByRole('radiogroup', { name: 'O que você procura' })).toBeInTheDocument();
    fireEvent.click(within(sec).getByLabelText('Quero alugar'));
    expect(within(sec).getByLabelText('Quero alugar')).toBeChecked();
    expect(within(sec).getByRole('link', { name: /\(11\) 98765-4321/ })).toHaveAttribute('href', 'https://wa.me/5511987654321');
    expect(within(sec).getByRole('link', { name: /\(11\) 3333-4444/ })).toHaveAttribute('href', 'tel:1133334444');
    expect(within(sec).getByRole('link', { name: /contato@imob\.com\.br/ })).toHaveAttribute('href', 'mailto:contato@imob.com.br');
  });

  it('telefone inválido: avisa e não envia', async () => {
    await abrirHome(moderno(), [imovel('R1')]);
    const sec = document.getElementById('contato')!;
    await userEvent.type(within(sec).getByPlaceholderText('Como podemos te chamar?'), 'Maria');
    await userEvent.type(within(sec).getByPlaceholderText(BR_PHONE_PLACEHOLDER), '1198');
    await userEvent.click(within(sec).getByRole('button', { name: 'Quero ajuda pra encontrar' }));
    expect(within(sec).getByText('Digite um telefone válido com DDD.')).toBeInTheDocument();
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([u]) => String(u).includes('/site/leads'))).toBe(false);
  });

  it('sem nenhum contato no site: sem o painel, e o título e o formulário numa coluna de até 720px (não esticam até 1120px)', async () => {
    await abrirHome(moderno({ contact: { whatsapp: '', phone: '', email: '' } } as SiteInfo), [imovel('R1')]);
    const grade = document.getElementById('contato')!.firstElementChild as HTMLElement;
    expect(grade.querySelector('aside')).toBeNull();
    // Duas larguras máximas na mesma caixa: o Tailwind decide pela ordem do CSS e a de 1120px vencia.
    expect(grade.className.match(/max-w-\[/g)).toHaveLength(1);
    expect((grade.firstElementChild as HTMLElement).className).toContain('max-w-[720px]');
  });

  it('sections.lead_capture desligado: sem o "Não achou?"', async () => {
    await abrirHome(moderno({ sections: { lead_capture: false } } as SiteInfo), [imovel('R1')]);
    expect(document.getElementById('contato')).toBeNull();
  });
});
