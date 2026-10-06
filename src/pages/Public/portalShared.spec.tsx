import { cleanup, render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PropertyCard, PropertyRow, type PortalProperty } from './portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   Linha larga da lista (Meu site › Lista de imóveis › cartões em linhas): diz
   o mesmo que o cartão (selos, tipo, título, local, ícones, preço, botões) e
   usa só as cores do site (--brand/--ink), nunca as do sistema.
──────────────────────────────────────────────────────────────────────────── */

const IMOVEL: PortalProperty = {
  id: '1', code: 'AP10', title: 'Apartamento no Cambuí', transaction_type: 'rent', property_type: 'apartment',
  listing_kind: 'resale', exclusive: true, display_price: 'R$ 3.500/mês', cover_url: 'https://cdn.exemplo.com/capa.jpg',
  address: { city: 'Campinas', neighborhood: 'Cambuí' },
  icon_summary: { bedrooms: 3, suites: 2, parking: 2, useful_area_m2: 98 },
};

function desenhar(Comp: typeof PropertyCard, p: PortalProperty = IMOVEL, wa: string | null = '+55 (19) 99999-0000') {
  const { container, unmount } = render(
    <MemoryRouter><Comp tenant="imob" p={p} wa={wa} tab="rent" /></MemoryRouter>,
  );
  return { article: container.querySelector('article')!, unmount };
}

const DETALHES = 'Ver detalhes de Apartamento no Cambuí';

/** O que a pessoa lê e clica, na ordem em que aparece. */
function conteudo(article: HTMLElement) {
  const w = within(article);
  return {
    textos: ['Exclusivo', 'Apartamento', 'Apartamento no Cambuí', 'Cambuí, Campinas', '3', '2 suítes', '98 m²', 'R$ 3.500/mês']
      .filter(t => w.queryAllByText(t, { exact: false }).length > 0),
    detalhes: w.getByRole('link', { name: DETALHES }).getAttribute('href'),
    whatsapp: w.queryByRole('link', { name: 'Falar no WhatsApp' })?.getAttribute('href') ?? null,
    // A foto fica fora do leitor de tela (o link dela é escondido): procura pelo elemento.
    foto: article.querySelector('img[alt="Apartamento no Cambuí"]')?.getAttribute('src') ?? null,
  };
}

describe('PropertyRow', () => {
  it('mostra o mesmo que o cartão: selos, tipo, título, local, ícones, preço, foto e botões', () => {
    const card = desenhar(PropertyCard);
    const doCartao = conteudo(card.article);
    card.unmount();

    const linha = conteudo(desenhar(PropertyRow).article);

    expect(linha.textos).toEqual(['Exclusivo', 'Apartamento', 'Apartamento no Cambuí', 'Cambuí, Campinas', '3', '2 suítes', '98 m²', 'R$ 3.500/mês']);
    expect(linha).toEqual(doCartao);
    expect(linha.detalhes).toBe('/imovel/imob/AP10?finalidade=locacao');
    expect(linha.whatsapp).toMatch(/^https:\/\/wa\.me\/5519999990000\?text=/);
  });

  it('foto vem primeiro (à esquerda), dados e preço ao lado; no celular empilha', () => {
    const { article } = desenhar(PropertyRow);

    const [foto, dados, preco] = [...article.children] as HTMLElement[];
    expect(foto.querySelector('img')).not.toBeNull();
    expect(within(dados).getByRole('heading', { level: 3 })).toHaveTextContent('Apartamento no Cambuí');
    expect(within(preco).getByText('R$ 3.500/mês')).toBeInTheDocument();
    expect(within(preco).getByRole('link', { name: DETALHES })).toBeInTheDocument();
    // 1 coluna no celular; foto de 280 px ao lado no computador
    expect(article).toHaveClass('grid', 'lg:grid-cols-[280px_minmax(0,1fr)_220px]');
    expect(article.className).not.toMatch(/(^| )grid-cols-/);
  });

  it('cores do site: selo na --accent (texto pelo contraste), "Ver detalhes" na --solid; nada das cores do sistema', () => {
    const { article } = desenhar(PropertyRow);

    expect(within(article).getByText('Exclusivo')).toHaveStyle({ background: 'var(--accent)', color: 'var(--accent-ink)' });
    expect(within(article).getByRole('link', { name: DETALHES })).toHaveStyle({ background: 'var(--solid)' });
    expect(article.outerHTML).not.toMatch(/\b(bg-card|bg-muted|bg-primary|text-primary|text-muted-foreground|text-foreground|border-primary)\b/);
  });

  it('botão do WhatsApp só com ícone tem nome e dica', () => {
    const { article } = desenhar(PropertyRow);

    expect(within(article).getByRole('link', { name: 'Falar no WhatsApp' })).toHaveAttribute('title', 'Falar no WhatsApp');
  });

  it('sem foto, sem preço e sem WhatsApp: nada quebrado', () => {
    const { article } = desenhar(PropertyRow, { ...IMOVEL, cover_url: null, display_price: undefined }, null);

    expect(within(article).queryByRole('img')).toBeNull();
    expect(within(article).queryByText(/R\$/)).toBeNull();
    expect(within(article).queryByRole('link', { name: 'Falar no WhatsApp' })).toBeNull();
    expect(within(article).getByRole('link', { name: DETALHES })).toBeInTheDocument();
  });

  it('empreendimento mostra a fase no selo, como no cartão', () => {
    const { article } = desenhar(PropertyRow, { ...IMOVEL, listing_kind: 'development', stage: 'launch', exclusive: false });

    expect(within(article).getByText('Na planta')).toHaveStyle({ background: 'var(--brand)' });
  });
});

describe.each([['PropertyCard', PropertyCard], ['PropertyRow', PropertyRow]] as const)('%s: foto e botões pra quem usa teclado ou leitor de tela', (_, Comp) => {
  it('o link da foto sai do Tab e do leitor de tela; "Ver detalhes" diz qual imóvel', () => {
    const { article } = desenhar(Comp);

    const fotoLink = article.querySelector('img')!.closest('a')!;
    expect(fotoLink).toHaveAttribute('tabindex', '-1');
    expect(fotoLink).toHaveAttribute('aria-hidden', 'true');
    expect(fotoLink).toHaveAttribute('href', '/imovel/imob/AP10?finalidade=locacao');

    const detalhes = within(article).getByRole('link', { name: DETALHES });
    expect(detalhes).toHaveAttribute('aria-label', DETALHES);
    expect(detalhes).toHaveTextContent('Ver detalhes');
    // Só a foto sai: título, "Ver detalhes" e WhatsApp continuam acessíveis.
    expect(within(article).getAllByRole('link').map(a => a.getAttribute('aria-label') ?? a.textContent))
      .toEqual(['Apartamento no Cambuí', DETALHES, 'Falar no WhatsApp']);
  });

  it('selos e preço por cima da foto continuam fora do trecho escondido', () => {
    const { article } = desenhar(Comp);

    expect(within(article).getByText('Exclusivo').closest('[aria-hidden]')).toBeNull();
    expect(within(article).getAllByText('R$ 3.500/mês').every(e => e.closest('[aria-hidden]') === null)).toBe(true);
  });
});

describe('selo MCMV', () => {
  const selos = (article: HTMLElement) => [...article.querySelectorAll('div.pointer-events-none.top-3 > span')].map(s => s.textContent);

  it.each([['PropertyCard', PropertyCard], ['PropertyRow', PropertyRow]] as const)('%s: imóvel MCMV ganha o selo na foto, depois do selo da fase', (_, Comp) => {
    const { article } = desenhar(Comp, { ...IMOVEL, listing_kind: 'development', stage: 'launch', exclusive: true, mcmv: true });

    expect(selos(article)).toEqual(['Na planta', 'MCMV', 'Exclusivo']);
    expect(within(article).getByText('MCMV')).toHaveStyle({ background: 'var(--brand)' });
    expect(within(article).getByText('MCMV').closest('[aria-hidden]')).toBeNull();
  });

  it('revenda MCMV: o selo sozinho (ou ao lado de Exclusivo)', () => {
    const { article } = desenhar(PropertyCard, { ...IMOVEL, exclusive: false, mcmv: true });
    expect(selos(article)).toEqual(['MCMV']);
  });

  it('sem mcmv (servidor velho), false ou null: nada de selo', () => {
    for (const mcmv of [undefined, false, null]) {
      const { article, unmount } = desenhar(PropertyCard, { ...IMOVEL, mcmv });
      expect(within(article).queryByText('MCMV')).toBeNull();
      unmount();
    }
  });
});

describe('cartão grande (Aparência › cartões grandes)', () => {
  const desenharCartao = (grande?: boolean) => render(
    <MemoryRouter><PropertyCard tenant="imob" p={IMOVEL} wa={null} tab="rent" grande={grande} /></MemoryRouter>,
  ).container.querySelector('article')!;

  it('foto 3:2 com pelo menos 300px e título na fonte dos títulos, 24px', () => {
    const article = desenharCartao(true);
    const fotoLink = article.querySelector('img')!.closest('a')!;
    expect(fotoLink).toHaveClass('aspect-[3/2]', 'min-h-[300px]');
    expect(fotoLink).not.toHaveClass('aspect-[4/3]');
    const titulo = within(article).getByRole('heading', { level: 3 });
    expect(titulo).toHaveClass('font-[var(--display)]', 'text-[24px]');
    expect(titulo).not.toHaveClass('text-[17px]');
  });

  it('padrão: o cartão de sempre (4:3, título de 17px)', () => {
    const padrao = desenharCartao(undefined);
    expect(padrao.querySelector('img')!.closest('a')).toHaveClass('aspect-[4/3]');
    expect(padrao.querySelector('img')!.closest('a')).not.toHaveClass('min-h-[300px]');
    expect(within(padrao).getByRole('heading', { level: 3 })).toHaveClass('text-[17px]');
    const html = padrao.outerHTML;
    cleanup();
    expect(desenharCartao(false).outerHTML).toBe(html);
  });
});
