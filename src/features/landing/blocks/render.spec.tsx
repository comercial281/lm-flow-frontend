import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlockRenderer } from './BlockRenderer';
import { createBlock } from './registry';
import type { LandingProperty } from './render-types';

const property: LandingProperty = {
  code: 'AP-001',
  title: 'The White Palace',
  stage: 'pre_launch',
  salePrice: 800000,
  bedrooms: 3,
  parkingSpaces: 2,
  usefulAreaM2: 95,
  city: 'Porto Belo',
  neighborhood: 'Perequê',
  state: 'SC',
  photos: [{ url: 'https://x/cover.jpg', isCover: true }],
};

describe('BlockRenderer', () => {
  it('renders hero with auto-filled property data and stage badge', () => {
    render(<BlockRenderer blocks={[createBlock('hero')]} property={property} />);
    expect(screen.getByText('The White Palace')).toBeInTheDocument();
    expect(screen.getByText('PRÉ LANÇAMENTO')).toBeInTheDocument();
  });

  it('renders tech sheet values from the property', () => {
    render(<BlockRenderer blocks={[createBlock('tech_sheet')]} property={property} />);
    expect(screen.getByText('Ficha Técnica')).toBeInTheDocument();
    expect(screen.getByText('Dormitórios')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('95 m²')).toBeInTheDocument();
  });

  it('finance simulator computes a monthly value from sale price', () => {
    render(<BlockRenderer blocks={[createBlock('finance_simulator')]} property={property} />);
    expect(screen.getByText('Simulador de Financiamento')).toBeInTheDocument();
    // base 800k, entrada 10% default -> entrada 80.000
    expect(screen.getByText('R$ 80.000')).toBeInTheDocument();
  });

  it('hidden blocks are not rendered by default', () => {
    const block = { ...createBlock('price_band'), visible: false };
    block.config.text = 'NAO DEVE APARECER';
    render(<BlockRenderer blocks={[block]} property={property} />);
    expect(screen.queryByText('NAO DEVE APARECER')).not.toBeInTheDocument();
  });

  it('renders nothing-but-survives when a block has empty data', () => {
    render(<BlockRenderer blocks={[createBlock('amenities')]} property={property} />);
    // amenities with no items renders null; no crash
    expect(screen.queryByText('Infraestrutura')).not.toBeInTheDocument();
  });
});
