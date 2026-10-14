import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CartaoDoImovelDeInteresse from './CartaoDoImovelDeInteresse';
import { linkDoImovel } from './linkDoImovel';
import type { PropertyInterest } from '@/services/propertyInterests/propertyInterestsService';

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const base = { id: 'i1', contact_id: 'c1', property_id: 'p1', interest_stage: 'interested', match_score: 0, created_at: '', updated_at: '',
  property: { id: 'p1', code: 'DEMO-0032', title: 'Apartamento no Nova Campinas', display_price: 'R$ 1.000.000', city: 'Campinas', neighborhood: 'Nova Campinas',
    cover_photo_url: 'https://cdn/x.jpg', photos_count: 14, bedrooms: 3, suites: 1, parking_spaces: 2, useful_area_m2: 118, price_per_m2: 8475 } } as PropertyInterest;

function montar(interesse: PropertyInterest = base, extra: Partial<Parameters<typeof CartaoDoImovelDeInteresse>[0]> = {}) {
  const props = { aoAgendarVisita: vi.fn(), aoMudarSituacao: vi.fn(), aoRemover: vi.fn(), ...extra };
  render(
    <MemoryRouter>
      <CartaoDoImovelDeInteresse interesse={interesse} podeEditar={false} {...props} />
    </MemoryRouter>,
  );
  return props;
}
const com = (property: Record<string, unknown>) => ({ ...base, property } as PropertyInterest);

describe('CartaoDoImovelDeInteresse', () => {
  it('mostra capa, código, situação, título, lugar, preço, preço/m² e características', () => {
    montar();
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText('DEMO-0032')).toBeInTheDocument();
    expect(screen.getByText('Interessado')).toBeInTheDocument();
    expect(screen.getByText('14 fotos')).toBeInTheDocument();
    expect(screen.getByText('Apartamento no Nova Campinas')).toBeInTheDocument();
    expect(screen.getByText('Nova Campinas · Campinas')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.000.000')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s8\.475\/m²/)).toBeInTheDocument();
    for (const t of ['3 dorms', '1 suíte', '2 vagas', '118 m²']) {
      expect(screen.getByText(new RegExp(t))).toBeInTheDocument();
    }
  });

  it('sem foto: espaço da capa com "Sem foto" e sem contagem de fotos', () => {
    montar(com({ ...base.property, cover_photo_url: null, photos_count: 0 }));
    expect(screen.getByText('Sem foto')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/^\d+ fotos?$/)).toBeNull();
  });

  it('servidor antigo (sem os campos novos): mostra título e preço e esconde características e preço/m²', () => {
    montar(com({ id: 'p1', code: 'DEMO-0032', title: 'Casa velha', display_price: 'R$ 500.000' }));
    expect(screen.getByText('Casa velha')).toBeInTheDocument();
    expect(screen.getByText('R$ 500.000')).toBeInTheDocument();
    expect(screen.queryByText(/\/m²/)).toBeNull();
    expect(screen.queryByText(/dorm|vaga|suíte/)).toBeNull();
    expect(screen.getByText('Sem foto')).toBeInTheDocument();
  });

  it('não mostra característica zerada (0 vagas) nem preço/m² nulo', () => {
    montar(com({ ...base.property, parking_spaces: 0, suites: 0, price_per_m2: null, useful_area_m2: null }));
    expect(screen.queryByText(/vaga/)).toBeNull();
    expect(screen.queryByText(/suíte/)).toBeNull();
    expect(screen.queryByText(/\/m²/)).toBeNull();
    expect(screen.getByText('3 dorms')).toBeInTheDocument();
  });

  it('Abrir leva pro cadastro se pode editar e pra lista filtrada se não', () => {
    expect(linkDoImovel({ id: 'p1', code: 'DEMO-0032' }, true)).toBe('/properties/p1/editar');
    expect(linkDoImovel({ id: 'p1', code: 'DEMO 32' }, false)).toBe('/properties?q=DEMO%2032');
    montar();
    expect(screen.getByRole('link', { name: /Abrir/ })).toHaveAttribute('href', '/properties?q=DEMO-0032');
  });

  it('Agendar visita chama com o imóvel', async () => {
    const { aoAgendarVisita } = montar();
    await userEvent.click(screen.getByRole('button', { name: /Agendar visita/ }));
    expect(aoAgendarVisita).toHaveBeenCalledWith({ id: 'p1', title: 'Apartamento no Nova Campinas', code: 'DEMO-0032' });
  });

  it('⋮ tem Mudar situação e Remover', async () => {
    const { aoRemover, aoMudarSituacao } = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações do imóvel' }));
    expect(await screen.findByText('Mudar situação')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Remover'));
    expect(aoRemover).toHaveBeenCalledWith('i1');
    expect(aoMudarSituacao).not.toHaveBeenCalled();
  });
});
