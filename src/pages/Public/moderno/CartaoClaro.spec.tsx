import { render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PropertyCard, type PortalProperty } from '../portalShared';
import CartaoClaro, { CartaoClaroDeitado } from './CartaoClaro';

/* Cartão claro da lista do Moderno: mesmo endereço da ficha e mesmo WhatsApp
   do cartão do Clássico; sem foto, "Fotos em breve"; deitado no md. */

const IMOVEL: PortalProperty = {
  id: '1', code: 'AP10', title: 'Apartamento no Cambuí', transaction_type: 'rent', property_type: 'apartment',
  listing_kind: 'resale', exclusive: true, display_price: 'R$ 3.500/mês', cover_url: 'https://cdn.exemplo.com/capa.jpg',
  address: { city: 'Campinas', neighborhood: 'Cambuí' },
  icon_summary: { bedrooms: 3, suites: 2, parking: 2, useful_area_m2: 98 },
};
const WA = '+55 (19) 99999-0000';

function desenhar(Comp: typeof PropertyCard, p: PortalProperty = IMOVEL) {
  const { container } = render(<MemoryRouter><Comp tenant="imob" p={p} wa={WA} tab="rent" /></MemoryRouter>);
  return container.querySelector('article')!;
}
const links = (article: HTMLElement) => ({
  detalhes: within(article).getByRole('link', { name: 'Ver detalhes de Apartamento no Cambuí' }).getAttribute('href'),
  whatsapp: within(article).getByRole('link', { name: 'Falar no WhatsApp' }).getAttribute('href'),
});

describe('CartaoClaro', () => {
  it('leva pra mesma ficha e pro mesmo WhatsApp do cartão do Clássico', () => {
    const classico = links(desenhar(PropertyCard));
    document.body.innerHTML = '';
    expect(links(desenhar(CartaoClaro))).toEqual(classico);
  });

  it('mostra tipo · código, título, local, números, preço e selo', () => {
    const w = within(desenhar(CartaoClaro));
    expect(w.getByText('Apartamento · AP10')).toBeTruthy();
    expect(w.getByRole('heading', { level: 3, name: 'Apartamento no Cambuí' })).toBeTruthy();
    expect(w.getByText('Cambuí, Campinas')).toBeTruthy();
    expect(w.getByText('3 dorm.')).toBeTruthy();
    expect(w.getByText('2 suítes')).toBeTruthy();
    expect(w.getByText('2 vagas')).toBeTruthy();
    expect(w.getByText('98 m²')).toBeTruthy();
    expect(w.getByText('R$ 3.500/mês')).toBeTruthy();
    expect(w.getByText('Exclusivo')).toBeTruthy();
  });

  it('sem foto: "Fotos em breve" no lugar da imagem', () => {
    const article = desenhar(CartaoClaro, { ...IMOVEL, cover_url: null });
    expect(within(article).getByText('Fotos em breve')).toBeTruthy();
    expect(article.querySelector('img')).toBeNull();
  });

  it('sem WhatsApp do site: sem o botão redondo', () => {
    const { container } = render(<MemoryRouter><CartaoClaro tenant="imob" p={IMOVEL} wa={null} /></MemoryRouter>);
    expect(within(container).queryByRole('link', { name: 'Falar no WhatsApp' })).toBeNull();
  });

  it('deitado: linha a partir do md (foto à esquerda), em pé no celular', () => {
    const article = desenhar(CartaoClaroDeitado);
    expect(article.className).toContain('md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]');
    expect(desenhar(CartaoClaro).className).not.toContain('md:grid-cols');
  });
});
