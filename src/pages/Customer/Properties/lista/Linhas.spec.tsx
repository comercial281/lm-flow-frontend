// src/pages/Customer/Properties/lista/Linhas.spec.tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Property } from '@/services/properties/propertiesService';
import LinhaRevenda from './LinhaRevenda';
import LinhaEmpreendimento from './LinhaEmpreendimento';
import type { AcoesDoImovel } from './MenuDoImovel';

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
