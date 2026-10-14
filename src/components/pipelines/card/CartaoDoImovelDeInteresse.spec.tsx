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

  it('sem foto: quem pode editar ganha o atalho "Adicionar fotos" pra página de fotos do imóvel', () => {
    montar(com({ ...base.property, cover_photo_url: null, photos_count: 0 }), { podeEditar: true });
    expect(screen.getByRole('link', { name: 'Adicionar fotos' })).toHaveAttribute('href', '/properties/p1/fotos');
    expect(screen.queryByText('Sem foto')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/^\d+ fotos?$/)).toBeNull();
  });

  it('sem foto e sem poder editar: só o aviso "Sem foto", sem atalho', () => {
    montar(com({ ...base.property, cover_photo_url: null, photos_count: 0 }));
    expect(screen.getByText('Sem foto')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Adicionar fotos' })).toBeNull();
  });

  it('área no formato brasileiro: vírgula nas casas e inteiro sem casa', () => {
    montar(com({ ...base.property, useful_area_m2: 72.45 }));
    expect(screen.getByText(/72,45 m²/)).toBeInTheDocument();
    expect(screen.queryByText(/72\.45/)).toBeNull();
  });

  it('compacto (janela do card): capa mais baixa, sem a linha do lugar, com situação, título, preço e ações', () => {
    montar(base, { compacto: true });
    const capa = screen.getByRole('img').parentElement as HTMLElement;
    expect(capa.className).toContain('h-20');
    expect(capa.className).not.toContain('h-28');
    expect(screen.queryByText('Nova Campinas · Campinas')).toBeNull();
    expect(screen.getByText('Interessado')).toBeInTheDocument();
    expect(screen.getByText('Apartamento no Nova Campinas')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.000.000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações do imóvel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agendar visita/ })).toBeInTheDocument();
  });

  it('normal (página do card): capa h-28 e a linha do lugar', () => {
    montar();
    expect((screen.getByRole('img').parentElement as HTMLElement).className).toContain('h-28');
    expect(screen.getByText('Nova Campinas · Campinas')).toBeInTheDocument();
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
