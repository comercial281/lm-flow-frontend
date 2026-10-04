import { render, within } from '@testing-library/react';
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

/** O que a pessoa lê e clica, na ordem em que aparece. */
function conteudo(article: HTMLElement) {
  const w = within(article);
  return {
    textos: ['Exclusivo', 'Apartamento', 'Apartamento no Cambuí', 'Cambuí, Campinas', '3', '2 suítes', '98 m²', 'R$ 3.500/mês']
      .filter(t => w.queryAllByText(t, { exact: false }).length > 0),
    detalhes: w.getByRole('link', { name: 'Ver detalhes' }).getAttribute('href'),
    whatsapp: w.queryByRole('link', { name: 'Falar no WhatsApp' })?.getAttribute('href') ?? null,
    foto: w.queryByRole('img', { name: 'Apartamento no Cambuí' })?.getAttribute('src') ?? null,
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
    expect(within(preco).getByRole('link', { name: 'Ver detalhes' })).toBeInTheDocument();
    // 1 coluna no celular; foto de 280 px ao lado no computador
    expect(article).toHaveClass('grid', 'lg:grid-cols-[280px_minmax(0,1fr)_220px]');
    expect(article.className).not.toMatch(/(^| )grid-cols-/);
  });

  it('cores do site: selo na --brand, "Ver detalhes" na --ink; nada das cores do sistema', () => {
    const { article } = desenhar(PropertyRow);

    expect(within(article).getByText('Exclusivo')).toHaveStyle({ background: 'var(--brand)' });
    expect(within(article).getByRole('link', { name: 'Ver detalhes' })).toHaveStyle({ background: 'var(--ink)' });
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
    expect(within(article).getByRole('link', { name: 'Ver detalhes' })).toBeInTheDocument();
  });

  it('empreendimento mostra a fase no selo, como no cartão', () => {
    const { article } = desenhar(PropertyRow, { ...IMOVEL, listing_kind: 'development', stage: 'launch', exclusive: false });

    expect(within(article).getByText('Na planta')).toHaveStyle({ background: 'var(--brand)' });
  });
});
