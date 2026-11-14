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

  it('busca por código: o código de um imóvel publicado digitado na barra grande vai pra URL', async () => {
    await abrirHome(moderno({ home: { search: { fields: ['code'] } } } as SiteInfo), [imovel('R1'), imovel('AP0566')]);

    fireEvent.change(screen.getByRole('combobox', { name: 'Condomínio, bairro, cidade ou código' }), { target: { value: 'AP0566' } });
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

  it('Atendimento sem foto: selo e título à esquerda, texto e botão à direita no pé do título (duas colunas equilibradas)', async () => {
    await abrirHome(moderno({ home: { about: { enabled: true, eyebrow: 'Atendimento', title: 'Fale com a gente', text: 'Atendimento humano.',
      button_label: 'Falar', button_link: 'https://wa.me/5511' } } } as SiteInfo), [imovel('R1')]);

    const grade = document.getElementById('atendimento')!.firstElementChild as HTMLElement;
    expect(grade.children).toHaveLength(2);
    expect(grade.className.split(/\s+/)).toEqual(expect.arrayContaining(['md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]', 'md:items-end']));
    const [esquerda, direita] = Array.from(grade.children) as HTMLElement[];
    expect(esquerda.firstElementChild!.textContent).toBe('Atendimento');
    expect(within(esquerda).getByRole('heading', { level: 2, name: 'Fale com a gente' })).toBeInTheDocument();
    expect(within(direita).getByText('Atendimento humano.')).toBeInTheDocument();
    const botao = within(direita).getByRole('link', { name: 'Falar' });
    expect(botao.getAttribute('target')).toBe('_blank');
  });

  it('Atendimento sem foto e sem selo: o mesmo desenho, sem o selo', async () => {
    await abrirHome(moderno({ home: { about: { enabled: true, title: 'Fale com a gente', text: 'Atendimento humano.' } } } as SiteInfo), [imovel('R1')]);

    const grade = document.getElementById('atendimento')!.firstElementChild as HTMLElement;
    expect(grade.children).toHaveLength(2);
    expect(grade.className).toContain('md:items-end');
    expect((grade.children[0] as HTMLElement).firstElementChild!.tagName).toBe('H2');
  });

  it('Atendimento sem foto e só com selo e título: uma coluna só (sem coluna vazia)', async () => {
    await abrirHome(moderno({ home: { about: { enabled: true, eyebrow: 'Atendimento', title: 'Fale com a gente' } } } as SiteInfo), [imovel('R1')]);

    const grade = document.getElementById('atendimento')!.firstElementChild!;
    expect(grade.children).toHaveLength(1);
    expect(grade.className).not.toContain('md:grid-cols-');
    expect(grade.children[0].firstElementChild!.textContent).toBe('Atendimento');
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
    // …e texto, logo e busca dividem a mesma coluna, sem recuo próprio: a borda
    // direita do logo é a da busca.
    const coluna = fileira.parentElement!;
    expect(coluna.contains(document.querySelector('form[role="search"]'))).toBe(true);
    expect(fileira.className).not.toMatch(/\b(lg:)?p[xlr]-/);
    expect(document.querySelector('form[role="search"]')!.className).not.toMatch(/\bmx-/);
    // O título e o subtítulo ficam juntos na coluna da esquerda.
    expect(fileira.firstElementChild!.querySelector('h1')).not.toBeNull();
  });

  it('busca com 4 campos e Código: abas em cima (sem o código pequeno), a barra grande com o Buscar e os 4 filtros numa linha embaixo', async () => {
    await abrirHome(
      moderno({ home: { search: { fields: ['type', 'city', 'neighborhood', 'bedrooms', 'code'] } } } as SiteInfo),
      [imovel('R1'), imovel('L1', { transaction_type: 'rent', rent_price_from: 2000, sale_price_from: null })],
    );
    const form = document.querySelector<HTMLElement>('form[role="search"]')!;
    expect(within(form).queryByLabelText('Código do imóvel')).toBeNull();

    const barra = form.querySelector<HTMLElement>('[data-barra-da-busca]')!;
    const campo = within(barra).getByRole('combobox', { name: 'Condomínio, bairro, cidade ou código' });
    expect(campo.getAttribute('placeholder')).toBe('Digite condomínio, bairro, cidade ou código');
    // O campo de lugar de sempre, crescido pela barra (altura 62px por cima do visual dele).
    expect(campo.className.split(/\s+/)).toContain('w-full');
    expect(campo.parentElement!.className.split(/\s+/)).toEqual(expect.arrayContaining(['[&_input]:h-[62px]', 'flex-1']));
    const buscar = within(barra).getByRole('button', { name: /Buscar/ });
    expect(buscar.className.split(/\s+/)).toEqual(expect.arrayContaining(['h-[62px]', 'bg-[var(--brand)]', 'text-[var(--brand-ink)]']));
    // Celular: o botão largo embaixo da barra; a partir de 640px, ao lado.
    expect(barra.className.split(/\s+/)).toEqual(expect.arrayContaining(['flex-col', 'sm:flex-row']));
    // As abas vêm antes da barra.
    expect(within(form).getByRole('button', { name: 'Alugar' }).compareDocumentPosition(barra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const linha = form.querySelector<HTMLElement>('[data-campos-da-busca]')!;
    expect(barra.compareDocumentPosition(linha) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const campos = linha.querySelectorAll('[data-campo-da-busca]');
    expect(campos).toHaveLength(4);
    expect(within(linha).queryByRole('button')).toBeNull();
    // Computador: uma linha (flex), cada campo com a mesma parte da largura e podendo encolher.
    expect(linha.className.split(/\s+/)).toEqual(expect.arrayContaining(['lg:flex', 'sm:grid-cols-3', 'grid-cols-1']));
    expect(new Set(Array.from(campos, c => c.className)).size).toBe(1);
    expect(campos[0].className.split(/\s+/)).toEqual(expect.arrayContaining(['lg:flex-1', 'lg:basis-0', 'min-w-0', 'lg:[&:not(:first-child)]:border-l', 'max-sm:[&:not(:first-child)]:border-t']));
    expect(campos[0].className).not.toMatch(/rounded|bg-\[var\(--m-ground\)\]/);
  });

  it('busca com 2 campos: no máximo 2 por linha até 1023px', async () => {
    await abrirHome(moderno({ home: { search: { fields: ['type', 'city'] } } } as SiteInfo), [imovel('R1')]);
    const linha = document.querySelector<HTMLElement>('[data-campos-da-busca]')!;
    expect(linha.querySelectorAll('[data-campo-da-busca]')).toHaveLength(2);
    expect(linha.className.split(/\s+/)).toContain('sm:grid-cols-2');
  });

  it('capa de fábrica não mostra Mais filtros', async () => {
    await abrirHome(moderno(), [imovel('R1')]);
    expect(screen.queryByRole('button', { name: /Mais filtros/ })).toBeNull();
  });

  it('6 campos: 3 na barra, e Mais filtros abre a segunda linha com Área', async () => {
    await abrirHome(
      moderno({ home: { search: { fields: ['type', 'city', 'neighborhood', 'price', 'bedrooms', 'area'] } } } as SiteInfo),
      [imovel('R1')],
    );
    expect(document.querySelector('[data-campos-da-busca]')!.querySelectorAll('[data-campo-da-busca]')).toHaveLength(3);
    expect(screen.queryByLabelText('Área')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mais filtros' }));
    expect(document.querySelector('[data-campos-da-busca-mais]')!.querySelectorAll('[data-campo-da-busca]')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Área'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?area=100');
  });

  it('escolher o Collina na barra grande e buscar vai para /imoveis?condominium=…', async () => {
    await abrirHome(
      moderno({ home: { search: { fields: ['place'] } } } as SiteInfo),
      [imovel('R1', { condominium_name: 'Collina' })],
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Condomínio, bairro, cidade ou código' }), { target: { value: 'coll' } });
    fireEvent.click(await screen.findByRole('option', { name: /Collina/ }));
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?condominium=Collina');
  });

  it('Enter na barra grande, só com texto digitado, faz a busca (place=…)', async () => {
    await abrirHome(moderno({ home: { search: { fields: ['place'] } } } as SiteInfo), [imovel('R1')]);
    const campo = screen.getByRole('combobox', { name: 'Condomínio, bairro, cidade ou código' });
    await userEvent.type(campo, 'Centro{Enter}');
    expect((await screen.findByTestId('busca')).textContent).toBe('?place=Centro');
  });

  it('lugar ligado no Personalizar: a barra é ele (sem célula de lugar) e ele não conta pro Mais filtros', async () => {
    await abrirHome(
      moderno({ home: { search: { fields: ['type', 'place', 'city', 'neighborhood', 'price'] } } } as SiteInfo),
      [imovel('R1')],
    );
    const linha = document.querySelector<HTMLElement>('[data-campos-da-busca]')!;
    expect(Array.from(linha.querySelectorAll('[data-campo-da-busca] label'), l => l.textContent))
      .toEqual(['Tipo', 'Cidade', 'Bairro', 'Faixa de preço']);
    expect(screen.queryByRole('button', { name: /Mais filtros/ })).toBeNull();
    expect(screen.getAllByRole('combobox', { name: /Condomínio, bairro/ })).toHaveLength(1);
  });

  it('a barra grande aparece mesmo sem nenhum campo ligado', async () => {
    await abrirHome(moderno({ home: { search: { fields: [] } } } as SiteInfo), [imovel('R1')]);
    expect(screen.getByRole('combobox', { name: 'Condomínio, bairro, cidade ou código' })).toBeInTheDocument();
    expect(document.querySelector('[data-campos-da-busca]')).toBeNull();
  });

  it('capa sobre a foto de ponta a ponta: sem recuo nem cantos, com a altura da tela em Tela cheia; o conteúdo na coluna da página', async () => {
    await abrirHome(moderno({}, { hero_height: 'full' }), [imovel('R1')]);
    let capa = document.querySelector<HTMLElement>('[data-capa-moderna]')!;
    expect(capa.id).toBe('topo');
    expect(capa.hasAttribute('data-capa-de-ponta-a-ponta')).toBe(true);
    expect(capa.className).not.toMatch(/rounded|\bp[xt]-|max-w-/);
    expect(capa.className).toContain('min-h-[max(580px,100svh)]');
    const coluna = capa.children[1] as HTMLElement;
    expect(coluna.className.split(/\s+/)).toEqual(expect.arrayContaining(['mx-auto', 'max-w-[1120px]', 'px-4']));
    cleanup();

    await abrirHome(moderno({}, { hero_height: 'half' }), [imovel('R1')]);
    capa = document.querySelector<HTMLElement>('[data-capa-moderna]')!;
    expect(capa.className).toContain('min-h-[580px]');
    expect(capa.className).not.toContain('100svh');
  });

  it('capa dividida continua com a foto num cartão arredondado (não vira ponta a ponta)', async () => {
    await abrirHome(moderno({ hero: { image_url: 'https://x.com/capa.jpg' } } as SiteInfo, { hero_layout: 'split' }), [imovel('R1')]);
    expect(document.querySelector('[data-capa-de-ponta-a-ponta]')).toBeNull();
    const cartao = document.querySelector('#topo img[src="https://x.com/capa.jpg"]')!.closest('.rounded-\\[28px\\]');
    expect(cartao).not.toBeNull();
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
    const zap = new URL(within(sec).getByRole('link', { name: /\(11\) 98765-4321/ }).getAttribute('href')!);
    expect(`${zap.origin}${zap.pathname}`).toBe('https://wa.me/5511987654321');
    expect(zap.searchParams.get('text')).toMatch(/^Olá! Vim pelo site .+ e quero saber mais sobre os imóveis disponíveis\.$/);
    expect(within(sec).getByRole('link', { name: /\(11\) 3333-4444/ })).toHaveAttribute('href', 'tel:1133334444');
    expect(within(sec).getByRole('link', { name: /contato@imob\.com\.br/ })).toHaveAttribute('href', 'mailto:contato@imob.com.br');
  });

  it('o painel tem o tamanho do que mostra: não estica até a altura do formulário, e os contatos vêm logo abaixo do logo', async () => {
    await abrirHome(moderno({ contact: contato } as SiteInfo), [imovel('R1')]);
    const painel = document.querySelector<HTMLElement>('#contato [data-painel-de-contato]')!;
    expect(painel.className.split(/\s+/)).toEqual(expect.arrayContaining(['self-start', 'gap-8']));
    expect(painel.querySelector('ul')!.className).not.toContain('mt-auto');
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

/* ────────────────────────────────────────────────────────────────────────────
   Barra de pesquisa grande da capa do Moderno: é o campo de lugar do site
   (decisão do Tony em 13/11: um campo só). Sugestões agrupadas em Condomínio,
   Bairro e Cidade enquanto digita; escolher não busca; no Buscar, a sugestão
   vai com os filtros dela, o código de um imóvel publicado vira `code` e o
   resto vira `place`.
──────────────────────────────────────────────────────────────────────────── */

describe('Início do Moderno: barra de pesquisa grande', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  const itens = () => [
    imovel('R1', { address: { city: 'Santos', neighborhood: 'Gonzaga' } }),
    imovel('R2', { address: { city: 'Santo André', neighborhood: 'Santa Teresinha' } }),
    imovel('R3', { address: { city: 'São Paulo', neighborhood: 'Santana' } }),
    imovel('R4', { condominium_name: 'Residencial Santorini', address: { city: 'Santos', neighborhood: 'Gonzaga' } }),
  ];
  const abrir = (fields: string[] = ['city', 'neighborhood']) =>
    abrirHome(moderno({ home: { search: { fields } } } as SiteInfo), itens());
  const barra = () => screen.getByRole('combobox', { name: 'Condomínio, bairro, cidade ou código' });
  const digitar = (v: string) => { fireEvent.focus(barra()); fireEvent.change(barra(), { target: { value: v } }); };
  const opcoesDaLista = () => within(screen.getByRole('listbox')).getAllByRole('option');

  it('digitando "san": condomínios, bairros e cidades do site que casam (sem acento), agrupados', async () => {
    await abrir();
    expect(screen.queryByRole('listbox')).toBeNull();
    digitar('san');
    expect(barra()).toHaveAttribute('aria-expanded', 'true');
    expect(barra().getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
    expect(opcoesDaLista().map(o => o.textContent))
      .toEqual(['Residencial Santorini (Santos)', 'Santa Teresinha', 'Santana', 'Santo André', 'Santos']);
    const lista = screen.getByRole('listbox');
    for (const g of ['Condomínio', 'Bairro', 'Cidade']) expect(within(lista).getByText(g)).toBeInTheDocument();
    // Sem acento: "sao" acha São Paulo.
    digitar('SAO');
    expect(opcoesDaLista().map(o => o.textContent)).toEqual(['São Paulo']);
  });

  it('escolher uma sugestão guarda a escolha e não busca sozinho; o Buscar leva os filtros dela', async () => {
    await abrir();
    digitar('teres');
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Santa Teresinha/ }));

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(barra()).toHaveValue('Santa Teresinha');
    expect(screen.queryByTestId('busca')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?neighborhood=Santa+Teresinha');
  });

  it('condomínio aparece em "co" e vai pro Buscar como condomínio', async () => {
    await abrirHome(moderno(), [imovel('R1', { condominium_name: 'Collina' })]);
    digitar('co');
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Collina/ }));
    expect(screen.queryByTestId('busca')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?condominium=Collina');
  });

  it('teclado: ↓ e ↑ andam pela lista (aria-activedescendant), Enter escolhe sem buscar, Esc fecha', async () => {
    await abrir();
    digitar('san');
    fireEvent.keyDown(barra(), { key: 'ArrowDown' });
    expect(barra().getAttribute('aria-activedescendant')).toBe(opcoesDaLista()[0].id);
    expect(opcoesDaLista()[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(barra(), { key: 'ArrowDown' });
    expect(barra().getAttribute('aria-activedescendant')).toBe(opcoesDaLista()[1].id);
    fireEvent.keyDown(barra(), { key: 'ArrowUp' });
    fireEvent.keyDown(barra(), { key: 'ArrowUp' });
    // Do primeiro, ↑ volta pro último.
    expect(barra().getAttribute('aria-activedescendant')).toBe(opcoesDaLista()[4].id);
    fireEvent.keyDown(barra(), { key: 'ArrowDown' });
    fireEvent.keyDown(barra(), { key: 'Enter' });
    expect(barra()).toHaveValue('Residencial Santorini (Santos)');
    expect(screen.queryByTestId('busca')).toBeNull();

    digitar('gon');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(barra(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(barra()).toHaveAttribute('aria-expanded', 'false');
    expect(barra()).toHaveValue('gon');
  });

  it('texto livre no Buscar: código de imóvel publicado vira código (sem acento nem maiúscula); o resto vira place', async () => {
    await abrir();
    digitar('r2');
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?code=r2');
    cleanup();

    await abrir();
    digitar('GONZAGA');
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?place=GONZAGA');
    cleanup();

    // Parece código, mas nenhum imóvel publicado tem: vai como texto (a página procura em condomínio, bairro e cidade).
    await abrir();
    digitar('AP0566');
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?place=AP0566');
  });

  it('código de um imóvel de outra aba: vai com o código e a aba dele', async () => {
    await abrirHome(moderno(), [
      imovel('R1'),
      imovel('L77', { transaction_type: 'rent', rent_price_from: 2000, sale_price_from: null }),
    ]);
    digitar('l77');
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?tab=rent&code=l77');
  });

  it('sugestão de bairro e a célula Bairro: a sugestão vale com a célula vazia; com a célula preenchida, vale a célula', async () => {
    await abrir();
    digitar('teres');
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Santa Teresinha/ }));
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?neighborhood=Santa+Teresinha');
    cleanup();

    await abrir();
    digitar('teres');
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Santa Teresinha/ }));
    fireEvent.change(screen.getByLabelText('Bairro'), { target: { value: 'Gonzaga' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?neighborhood=Gonzaga');
  });

  it('sugestão escolhida e depois editada vira texto livre', async () => {
    await abrir();
    digitar('teres');
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Santa Teresinha/ }));
    fireEvent.change(barra(), { target: { value: 'Santa Teresinha 2' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?place=Santa+Teresinha+2');
  });

  it('o endereço sai na ordem dos campos de sempre: o texto da barra e os filtros embaixo', async () => {
    await abrir(['type', 'city', 'neighborhood', 'bedrooms']);
    fireEvent.change(screen.getByLabelText('Dormitórios'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Santos' } });
    digitar('gonzaga');
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?place=gonzaga&city=Santos&bedrooms=2');
  });
});
