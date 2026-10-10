// Raio-X do celular (10/10/2026): no celular, a tela de Imóveis não oferece o
// "Gerar descrições com IA" em lote. O "Novo imóvel" continua. No computador
// nada muda.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Property } from '@/services/properties/propertiesService';
import { simularCelular } from '@/test/telaDeCelular';

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  contarPorTipo: vi.fn(),
  facets: vi.fn(),
}));

vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...svc } };
});
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));
vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: { getLabels: () => Promise.resolve({ data: [] }) },
}));
vi.mock('@/services/users/usersService', () => ({
  default: { getUsers: () => Promise.resolve({ data: [] }) },
}));
vi.mock('../PropertyImportDialog', () => ({ default: () => null }));
vi.mock('@/services/propertyPhotos/propertyPhotosService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/propertyPhotos/propertyPhotosService')>();
  return { ...real, propertyPhotosService: { ...real.propertyPhotosService, list: () => Promise.resolve([]) } };
});
vi.mock('./VisaoMapa', () => ({ default: () => null }));

import Properties from '../Properties';

const imovel = {
  id: 'r1', code: 'AP0461', title: 'Apartamento', transaction_type: 'sale', category_type: 'residential',
  property_type: 'apartment', status: 'active', stage: 'ready', created_at: '2026-10-01',
  updated_at: new Date().toISOString(), listing_kind: 'resale', address_neighborhood: 'Cambuí',
} as Property;

let tela: ReturnType<typeof simularCelular> | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  svc.facets.mockResolvedValue({ neighborhoods: [], property_types: [], captors: [] });
  svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 1 });
  svc.list.mockResolvedValue({ data: [imovel], meta: { total: 1, page: 1, per_page: 50 } });
});
afterEach(() => {
  tela?.restaurar();
  tela = null;
});

const abrir = () => render(<MemoryRouter initialEntries={['/properties']}><Properties /></MemoryRouter>);

describe('Imóveis no celular', () => {
  it('celular: sem "Gerar descrições com IA", com "Novo imóvel"', async () => {
    tela = simularCelular();
    abrir();
    expect(await screen.findByRole('button', { name: /Novo imóvel/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar descrições com IA/ })).toBeNull();
  });

  it('computador: "Gerar descrições com IA" continua no topo', async () => {
    tela = simularCelular(false);
    abrir();
    expect(await screen.findByRole('button', { name: /Gerar descrições com IA/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo imóvel/ })).toBeInTheDocument();
  });
});
