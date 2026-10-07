// src/pages/Customer/Properties/lista/Linhas.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Property } from '@/services/properties/propertiesService';
import LinhaRevenda from './LinhaRevenda';
import LinhaEmpreendimento from './LinhaEmpreendimento';
import CartaoGrade from './CartaoGrade';
import MenuDoImovel, { type AcoesDoImovel } from './MenuDoImovel';

const acoes = new Proxy({}, { get: () => vi.fn() }) as unknown as AcoesDoImovel;
const base = {
  id: '1', code: 'AP0461', title: 'x', transaction_type: 'sale', category_type: 'residential',
  property_type: 'apartment', status: 'active', stage: 'ready', created_at: '2026-10-01', updated_at: new Date().toISOString(),
} as Property;

describe('LinhaRevenda', () => {
  it('mostra bairro · tipo, preço, condomínio e Disponível', () => {
    render(<LinhaRevenda p={{ ...base, address_neighborhood: 'Cambuí', sale_price: 900000, condo_fee: 1080, useful_area_m2: 71, bedrooms: 2, captor: { id: 'u', name: 'Ivan Luiz' } }}
      acoes={acoes} permissoes={{ editar: true, excluir: true }} />);
    expect(screen.getByText('Cambuí · Apartamento')).toBeInTheDocument();
    expect(screen.getByText('Disponível')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?900\.000/)).toBeInTheDocument();
    expect(screen.getByText('Captador: Ivan Luiz')).toBeInTheDocument();
  });

  it('sem foto oferece Adicionar fotos', () => {
    const fotos = vi.fn();
    render(<LinhaRevenda p={{ ...base, cover_photo_url: null }} acoes={{ ...acoes, fotos }} permissoes={{ editar: true, excluir: false }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar fotos' }));
    expect(fotos).toHaveBeenCalled();
  });
});

describe('LinhaEmpreendimento', () => {
  it('mostra fase com entrega, tipologias, unidades e a partir de', () => {
    render(<LinhaEmpreendimento p={{
      ...base, listing_kind: 'development', title: 'Vista Taquaral', stage: 'in_construction', delivery_forecast: '2027-12-01',
      units_available_total: 14, sale_price: 389900,
      typologies: [{ bedrooms: 2, useful_area_m2: 58, sale_price: 389900 }, { bedrooms: 3, useful_area_m2: 98, sale_price: 720000 }],
    } as Property} acoes={acoes} permissoes={{ editar: true, excluir: true }} />);
    expect(screen.getByText('Em obra · entrega dez/2027')).toBeInTheDocument();
    expect(screen.getByText('2 tipologias · 2 a 3 dorms · 58 a 98 m²')).toBeInTheDocument();
    expect(screen.getByText('14 unidades disponíveis')).toBeInTheDocument();
    expect(screen.getByText('A partir de')).toBeInTheDocument();
  });
});

describe('detalhes da lista', () => {
  const pode = { editar: true, excluir: true };

  it('revenda sem bairro usa o título do cadastro', () => {
    render(<LinhaRevenda p={{ ...base, title: 'Casa térrea com quintal' }} acoes={acoes} permissoes={pode} />);
    expect(screen.getByRole('button', { name: 'Casa térrea com quintal' })).toBeInTheDocument();
  });

  it('área com vírgula e "área total" quando só ela existe', () => {
    render(<LinhaRevenda p={{ ...base, total_area_m2: 58.5 }} acoes={acoes} permissoes={pode} />);
    expect(screen.getByText('58,5').parentElement).toHaveTextContent('58,5 m² de área total');
  });

  it('revenda sem nenhum valor diz Sem preço cadastrado', () => {
    render(<LinhaRevenda p={base} acoes={acoes} permissoes={pode} />);
    expect(screen.getByText('Sem preço cadastrado')).toBeInTheDocument();
  });

  it('sem permissão de editar, o nome não abre o cadastro', () => {
    const editar = vi.fn();
    render(<LinhaEmpreendimento p={{ ...base, listing_kind: 'development', title: 'Vista Taquaral' } as Property}
      acoes={{ ...acoes, editar }} permissoes={{ editar: false, excluir: false }} />);
    expect(screen.queryByRole('button', { name: 'Vista Taquaral' })).toBeNull();
    fireEvent.click(screen.getByText('Vista Taquaral'));
    expect(editar).not.toHaveBeenCalled();
  });

  it('card da grade mostra a situação do empreendimento fora de venda', () => {
    render(<CartaoGrade p={{ ...base, listing_kind: 'development', title: 'Vista', status: 'sold' } as Property}
      acoes={acoes} permissoes={pode} />);
    expect(screen.getByText('Esgotado')).toBeInTheDocument();
  });

  it('uma foto no singular', () => {
    render(<LinhaRevenda p={{ ...base, cover_photo_url: 'https://x/capa.jpg', photos_count: 1 }} acoes={acoes} permissoes={pode} />);
    expect(screen.getByText('1 foto')).toBeInTheDocument();
  });

  it('Ver página no site só para quem está no site', async () => {
    const { unmount } = render(<MenuDoImovel p={{ ...base, published_on_site: true }} acoes={acoes} permissoes={pode} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ações do AP0461' }));
    expect(await screen.findByText('Ver página no site')).toBeInTheDocument();
    unmount();
    render(<MenuDoImovel p={{ ...base, status: 'sold', published_on_site: true }} acoes={acoes} permissoes={pode} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ações do AP0461' }));
    expect(await screen.findByText('Fotos e vídeos')).toBeInTheDocument();
    expect(screen.queryByText('Ver página no site')).toBeNull();
  });

  it('setinha ao lado do nome abre o site, só para quem está no site', () => {
    const site = vi.fn();
    const { unmount } = render(<LinhaRevenda p={{ ...base, published_on_site: true }} acoes={{ ...acoes, site }} permissoes={pode} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir no site' }));
    expect(site).toHaveBeenCalled();
    unmount();
    render(<CartaoGrade p={{ ...base, published_on_site: false }} acoes={acoes} permissoes={pode} />);
    expect(screen.queryByRole('button', { name: 'Abrir no site' })).toBeNull();
  });
});
