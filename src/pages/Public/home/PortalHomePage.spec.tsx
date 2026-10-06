import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PortalHomePage from '../PortalHomePage';
import type { PortalProperty, SiteInfo } from '../portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Página inicial do site público montada por blocos (Meu site, projeto C):
   capa com busca configurável, vitrines, chamadas e mais buscados. O servidor
   é simulado pelo fetch: `/site` devolve o site e `/site/properties` o catálogo.
──────────────────────────────────────────────────────────────────────────── */

const imovel = (code: string, o: Partial<PortalProperty> = {}): PortalProperty => ({
  id: code, code, title: `Imóvel ${code}`, transaction_type: 'sale', property_type: 'apartment',
  listing_kind: 'resale', sale_price_from: 500000, rent_price_from: null,
  address: { city: 'Campinas', neighborhood: 'Centro' }, ...o,
});
const empreendimento = (code: string, o: Partial<PortalProperty> = {}) =>
  imovel(code, { listing_kind: 'development', stage: 'launch', ...o });

/** Destino da busca: mostra a URL a que a capa levou. */
function Busca() {
  const { search } = useLocation();
  return <p data-testid="busca">{search}</p>;
}

const resposta = (body: unknown) => ({ ok: true, json: async () => body });

function servidor(site: SiteInfo, items: PortalProperty[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/site/properties')) return resposta({ data: items, meta: { total: items.length } });
    if (url.includes('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(url)) return resposta({ data: site });
    return resposta({});
  }));
}

async function abrirHome(site: SiteInfo, items: PortalProperty[]) {
  servidor({ name: 'Imob Teste', ...site }, items);
  render(
    <MemoryRouter initialEntries={['/portal/imob']}>
      <Routes>
        <Route path="/portal/:tenant" element={<PortalHomePage />} />
        <Route path="/portal/:tenant/imoveis" element={<Busca />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1 });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('PortalHomePage por blocos', () => {
  it('site que nunca abriu o Personalizar: capa de fábrica, vitrines de fábrica e só as abas com imóvel', async () => {
    await abrirHome({}, [imovel('R1', { featured: true, title: 'Casa destaque' }), empreendimento('E1', { title: 'Torre Nova' })]);

    expect(screen.getByRole('heading', { level: 1, name: 'O imóvel certo pra sua próxima fase.' })).toBeInTheDocument();

    const lanc = screen.getByRole('heading', { level: 2, name: 'Lançamentos' }).closest('section')!;
    expect(within(lanc).getByText('Torre Nova')).toBeInTheDocument();
    expect(within(lanc).queryByText('Casa destaque')).toBeNull();
    const dest = screen.getByRole('heading', { level: 2, name: 'Imóveis em destaque' }).closest('section')!;
    expect(within(dest).getByText('Casa destaque')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Comprar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lançamentos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alugar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Alugar' })).toBeNull();
  });

  it('título da capa trocado e aba Lançamentos desligada (some da capa e do topo)', async () => {
    await abrirHome(
      { home: { search: { title: 'Ache seu lar', tabs: { launch: false } } } },
      [imovel('R1'), empreendimento('E1')],
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Ache seu lar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lançamentos' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Lançamentos' })).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Comprar' }).length).toBeGreaterThan(0);
  });

  it('as duas vitrines de fábrica desligadas e nenhuma livre: nenhum título de vitrine', async () => {
    await abrirHome(
      { home: { showcases: [
        { id: 'launches', kind: 'launches', enabled: false, title: 'Lançamentos' },
        { id: 'featured', kind: 'featured', enabled: false, title: 'Imóveis em destaque' },
      ] } },
      [imovel('R1', { featured: true }), empreendimento('E1')],
    );

    expect(screen.queryByRole('heading', { level: 2, name: 'Lançamentos' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Imóveis em destaque' })).toBeNull();
    expect(screen.queryByText('Ver todos')).toBeNull();
  });

  it('chamadas em cartões com financiamento e anuncie ligados', async () => {
    await abrirHome(
      { financiamento: { enabled: true }, anuncie: { enabled: true }, home: { callouts: { layout: 'cards' } } },
      [imovel('R1')],
    );

    const faixa = screen.getByText('Faça uma simulação').closest('section')!;
    expect(within(faixa).getByRole('heading', { name: 'Financiamento' })).toBeInTheDocument();
    expect(within(faixa).getByRole('heading', { name: 'Anuncie seu imóvel' })).toBeInTheDocument();
    expect(within(faixa).getByRole('link', { name: /Faça uma simulação/ })).toHaveAttribute('href', '/portal/imob/financiamento');
    expect(within(faixa).getByRole('link', { name: /Cadastre seu imóvel/ })).toHaveAttribute('href', '/portal/imob/anuncie');
    // Cartões brancos, não a faixa escura.
    expect(within(faixa).getByRole('link', { name: /Faça uma simulação/ }).className).toContain('bg-white');
  });

  it('mais buscados automático: 3 apartamentos no Cambuí viram atalho', async () => {
    const cambui = { city: 'Campinas', neighborhood: 'Cambuí' };
    await abrirHome({}, [imovel('A1', { address: cambui }), imovel('A2', { address: cambui }), imovel('A3', { address: cambui })]);

    expect(screen.getByRole('heading', { level: 2, name: 'Mais buscados' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Apartamentos em Cambuí' }))
      .toHaveAttribute('href', '/portal/imob/imoveis?type=apartment&neighborhood=Cambu%C3%AD');
  });

  it('cartão de empreendimento mostra a fase e a entrega', async () => {
    await abrirHome({}, [empreendimento('E1', { stage: 'in_construction', delivery_forecast: '2027-12-01' })]);

    const lanc = screen.getByRole('heading', { level: 2, name: 'Lançamentos' }).closest('section')!;
    expect(within(lanc).getByText('Em obra · entrega dez/2027')).toBeInTheDocument();
  });

  it('busca da capa na aba Alugar leva faixa de preço (do aluguel) e suítes para a URL', async () => {
    await abrirHome(
      { home: { search: { fields: ['price', 'suites', 'stage'] } } },
      [imovel('R1'), imovel('L1', { transaction_type: 'rent', rent_price_from: 2000, sale_price_from: null })],
    );

    fireEvent.click(screen.getByRole('button', { name: 'Alugar' }));
    fireEvent.change(screen.getByDisplayValue('Faixa de preço'), { target: { value: '1500.01-3000' } });
    fireEvent.change(screen.getByDisplayValue('Suítes'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));

    expect((await screen.findByTestId('busca')).textContent).toBe('?tab=rent&price_min=1500.01&price_max=3000&suites=2');
  });

  it('catálogo vazio: sem fileira de abas, sem vitrines, e a busca cai em Comprar', async () => {
    await abrirHome({}, []);

    expect(screen.queryByRole('button', { name: 'Comprar' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Lançamentos' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('');
  });

  it('aba Lançamentos desligada: a vitrine continua, sem o "Ver todos" que levaria a uma aba escondida', async () => {
    await abrirHome(
      { home: { search: { tabs: { launch: false } } } },
      [imovel('R1', { featured: true }), empreendimento('E1', { title: 'Torre Nova' })],
    );

    const lanc = screen.getByRole('heading', { level: 2, name: 'Lançamentos' }).closest('section')!;
    expect(within(lanc).getByText('Torre Nova')).toBeInTheDocument();
    expect(within(lanc).queryByRole('link', { name: /Ver todos/ })).toBeNull();
    const dest = screen.getByRole('heading', { level: 2, name: 'Imóveis em destaque' }).closest('section')!;
    expect(within(dest).getAllByRole('link', { name: /Ver todos/ }).length).toBeGreaterThan(0);
  });

  it('chamadas com foto: só usa a foto se for http(s); o fundo escuro fica de reserva', async () => {
    const chamadas = (url: string) => ({ home: { callouts: { layout: 'photo', background_url: url, overlay: 40 } }, anuncie: { enabled: true } });
    await abrirHome(chamadas('javascript:alert(1)') as SiteInfo, [imovel('R1')]);
    const faixa = screen.getByRole('heading', { level: 3, name: 'Anuncie seu imóvel' }).closest('section') as HTMLElement;
    expect(faixa.style.backgroundImage).toBe('');
    expect(faixa.style.background).toContain('var(--solid)');
  });

  it('chamadas com foto https: a foto vira o fundo', async () => {
    await abrirHome({ home: { callouts: { layout: 'photo', background_url: 'https://x.com/f.jpg', overlay: 40 } }, anuncie: { enabled: true } } as SiteInfo, [imovel('R1')]);
    const faixa = screen.getByRole('heading', { level: 3, name: 'Anuncie seu imóvel' }).closest('section') as HTMLElement;
    expect(faixa.style.backgroundImage).toContain('https://x.com/f.jpg');
  });

  it('sem imóvel de compra, a vitrine de destaque some o "Ver todos" que cairia em Comprar', async () => {
    await abrirHome({}, [imovel('L1', { transaction_type: 'rent', rent_price_from: 3000, sale_price_from: null, featured: true })]);
    const dest = screen.getByRole('heading', { level: 2, name: 'Imóveis em destaque' }).closest('section')!;
    expect(within(dest).queryByRole('link', { name: /Ver todos/ })).toBeNull();
  });

  it('empreendimento exclusivo mostra os dois selos: fase e Exclusivo', async () => {
    await abrirHome({}, [empreendimento('E1', { stage: 'ready', exclusive: true }), imovel('R1', { exclusive: true, featured: true })]);

    const lanc = screen.getByRole('heading', { level: 2, name: 'Lançamentos' }).closest('section')!;
    expect(within(lanc).getByText('Pronto para morar')).toBeInTheDocument();
    expect(within(lanc).getByText('Exclusivo')).toBeInTheDocument();
    // Revenda: Exclusivo vence Destaque, um selo só.
    const dest = screen.getByRole('heading', { level: 2, name: 'Imóveis em destaque' }).closest('section')!;
    const cartaoR1 = within(dest).getByText('Imóvel R1').closest('article')!;
    expect(within(cartaoR1).getByText('Exclusivo')).toBeInTheDocument();
    expect(within(cartaoR1).queryByText('Destaque')).toBeNull();
  });

  it('vitrine de destaques: o botão diz "Ver todos os imóveis"', async () => {
    await abrirHome({}, [imovel('R1', { featured: true })]);

    const dest = screen.getByRole('heading', { level: 2, name: 'Imóveis em destaque' }).closest('section')!;
    const links = within(dest).getAllByRole('link', { name: /Ver todos os imóveis/ });
    expect(links[0]).toHaveAttribute('href', '/portal/imob/imoveis');
  });

  it('vitrine livre: "Ver todos" só quando a regra cabe na busca', async () => {
    const regra = (o: Record<string, unknown>) => ({ transaction: 'sale', listing_kind: null, property_types: [], cities: [], neighborhoods: [],
      price_min: null, price_max: null, stages: [], featured_only: false, ...o });
    await abrirHome({ home: { showcases: [
      { id: 'cabe', kind: 'custom', enabled: true, title: 'Em Campinas', rules: regra({ cities: ['campinas'] }) },
      { id: 'nao', kind: 'custom', enabled: true, title: 'Duas cidades', rules: regra({ cities: ['Campinas', 'Santos'] }) },
    ] } }, [imovel('R1')]);

    const cabe = screen.getByRole('heading', { level: 2, name: 'Em Campinas' }).closest('section')!;
    expect(within(cabe).getByText('Imóvel R1')).toBeInTheDocument();
    expect(within(cabe).getAllByRole('link', { name: /Ver todos/ })[0]).toHaveAttribute('href', '/portal/imob/imoveis?city=campinas');
    const nao = screen.getByRole('heading', { level: 2, name: 'Duas cidades' }).closest('section')!;
    expect(within(nao).getByText('Imóvel R1')).toBeInTheDocument();
    expect(within(nao).queryByRole('link', { name: /Ver todos/ })).toBeNull();
  });

  it('capa: o campo Fase some na aba Alugar e a fase escolhida não vai pra busca', async () => {
    await abrirHome(
      { home: { search: { fields: ['stage'] } } },
      [empreendimento('E1'), imovel('L1', { transaction_type: 'rent', rent_price_from: 2000, sale_price_from: null })],
    );

    fireEvent.change(screen.getByDisplayValue('Fase'), { target: { value: 'ready' } });
    fireEvent.click(screen.getByRole('button', { name: 'Alugar' }));
    expect(screen.queryByDisplayValue('Fase')).toBeNull();
    expect(screen.queryByRole('option', { name: 'Pronto para morar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    expect((await screen.findByTestId('busca')).textContent).toBe('?tab=rent');
  });
});

describe('PortalHomePage · ícone da aba', () => {
  it('o ícone enviado em Aparência vira o ícone da aba do site', async () => {
    const doLmFlow = Object.assign(document.createElement('link'), { rel: 'icon', href: '/favicon.ico' });
    document.head.appendChild(doLmFlow);
    await abrirHome({ branding: { favicon_url: 'https://cdn/icone.png' } }, [imovel('R1')]);
    expect(doLmFlow.getAttribute('href')).toBe('https://cdn/icone.png');
    cleanup();
    expect(doLmFlow.getAttribute('href')).toBe('/favicon.ico');
    doLmFlow.remove();
  });
});

describe('PortalHomePage · rodapé', () => {
  it('o endereço em duas linhas aparece em duas linhas no rodapé', async () => {
    await abrirHome({ contact: { address: 'Rua A, 10\nCentro, Campinas' } }, [imovel('R1')]);
    const endereco = screen.getByText((_, el) => el?.tagName === 'DIV' && el.children.length === 0 && el.textContent === 'Rua A, 10\nCentro, Campinas');
    expect(endereco.className).toContain('whitespace-pre-line');
  });

  it('a aba do navegador usa o nome do site com a frase padrão', async () => {
    await abrirHome({ name: 'Imob XYZ' }, [imovel('R1')]);
    expect(document.title).toBe('Imob XYZ — Encontre seu imóvel');
  });

  describe('Como funciona e Atendimento', () => {
    const passos = (n: number) => Array.from({ length: n }, (_, k) => ({ title: `Passo ${k + 1}`, text: `Texto ${k + 1}` }));

    it('sem as chaves ou desligadas: nenhuma das duas aparece', async () => {
      await abrirHome({ home: { steps: { enabled: false, items: passos(4) }, about: { enabled: false, title: 'Oi' } } } as SiteInfo, [imovel('R1')]);
      expect(screen.queryByRole('heading', { name: 'Como funciona' })).toBeNull();
      expect(screen.queryByText('Oi')).toBeNull();
      expect(document.getElementById('como-funciona')).toBeNull();
      expect(document.getElementById('atendimento')).toBeNull();
    });

    it('Como funciona: 4 passos numerados na ordem, entre as vitrines e as chamadas', async () => {
      await abrirHome({ home: { steps: { enabled: true, title: 'Como comprar', items: passos(4) } } } as SiteInfo, [imovel('R1')]);
      const sec = screen.getByRole('heading', { level: 2, name: 'Como comprar' }).closest('section')!;
      const itens = within(sec).getAllByRole('listitem');
      expect(itens.map(li => li.textContent)).toEqual(['1Passo 1Texto 1', '2Passo 2Texto 2', '3Passo 3Texto 3', '4Passo 4Texto 4']);
      expect(within(itens[0]).getByText('1').className).toContain('text-[var(--brand)]');
    });

    it('Como funciona ligado sem nenhum passo: não aparece', async () => {
      await abrirHome({ home: { steps: { enabled: true, items: [] } } } as SiteInfo, [imovel('R1')]);
      expect(screen.queryByRole('heading', { name: 'Como funciona' })).toBeNull();
    });

    it('Atendimento com foto: foto, texto e botão que leva ao link', async () => {
      await abrirHome({ home: { about: { enabled: true, eyebrow: 'Quem atende', title: 'Fale com a Ana', text: 'Corretora há 10 anos.',
        photo_url: 'https://x.com/ana.jpg', button_label: 'Ver o Instagram', button_link: 'https://insta.com/ana' } } } as SiteInfo, [imovel('R1')]);
      const sec = screen.getByRole('heading', { level: 2, name: 'Fale com a Ana' }).closest('section')!;
      expect(within(sec).getByText('Quem atende')).toBeInTheDocument();
      expect(within(sec).getByText('Corretora há 10 anos.')).toBeInTheDocument();
      expect(within(sec).getByRole('img').getAttribute('src')).toBe('https://x.com/ana.jpg');
      const botao = within(sec).getByRole('link', { name: 'Ver o Instagram' });
      expect(botao.getAttribute('href')).toBe('https://insta.com/ana');
      expect(botao.getAttribute('target')).toBe('_blank');
    });

    it('Atendimento: #contato rola até o formulário de contato (mesma aba)', async () => {
      await abrirHome({ home: { about: { enabled: true, title: 'Oi', button_label: 'Falar', button_link: '#contato' } } } as SiteInfo, [imovel('R1')]);
      const botao = screen.getByRole('link', { name: 'Falar' });
      expect(botao.getAttribute('href')).toBe('#contato');
      expect(botao.getAttribute('target')).toBeNull();
      expect(document.getElementById('contato')).not.toBeNull();
    });

    it('Atendimento sem foto: só o texto, centralizado', async () => {
      await abrirHome({ home: { about: { enabled: true, title: 'Oi', text: 'Texto' } } } as SiteInfo, [imovel('R1')]);
      const sec = screen.getByRole('heading', { level: 2, name: 'Oi' }).closest('section')!;
      expect(within(sec).queryByRole('img')).toBeNull();
      expect(sec.className).toContain('text-center');
    });

    it('Atendimento sem título e sem texto: não aparece', async () => {
      await abrirHome({ home: { about: { enabled: true, eyebrow: 'Só o selo', button_label: 'X', button_link: '#contato' } } } as SiteInfo, [imovel('R1')]);
      expect(document.getElementById('atendimento')).toBeNull();
    });

    it('ordem: vitrines, Como funciona, chamadas, Atendimento, mais buscados', async () => {
      await abrirHome({
        anuncie: { enabled: true }, financiamento: { enabled: true },
        home: { steps: { enabled: true, items: passos(2) }, about: { enabled: true, title: 'Oi' } },
      } as SiteInfo, [imovel('R1', { featured: true })]);
      const ordem = ['Imóveis em destaque', 'Como funciona', 'Financiamento', 'Oi'].map(n => screen.getByRole('heading', { name: n }));
      for (let k = 0; k < ordem.length - 1; k++) {
        expect(ordem[k].compareDocumentPosition(ordem[k + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });
  });
});
