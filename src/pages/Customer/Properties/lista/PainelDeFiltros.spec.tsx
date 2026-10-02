// src/pages/Customer/Properties/lista/PainelDeFiltros.spec.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FILTROS_VAZIOS } from '@/features/properties/listingKind';
import PainelDeFiltros, { ATRASO_DO_PRECO } from './PainelDeFiltros';
import EtiquetasDosFiltros from './EtiquetasDosFiltros';

const facetas = { neighborhoods: ['Cambuí', 'Taquaral'], property_types: ['apartment'], captors: [{ id: 'u1', name: 'Ivan' }] };

describe('PainelDeFiltros', () => {
  it('Empreendimentos: marcar fase chama aoMudar com a fase', () => {
    const aoMudar = vi.fn();
    render(<PainelDeFiltros kind="development" filtros={FILTROS_VAZIOS.development} facetas={facetas}
      aoMudar={aoMudar} aoLimpar={vi.fn()} aoRecolher={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Em obra' }));
    expect(aoMudar).toHaveBeenCalledWith({ ...FILTROS_VAZIOS.development, fases: ['in_construction'] });
    expect(screen.queryByText('Finalidade')).toBeNull();
  });

  it('Revenda mostra finalidade e captador, sem fase', () => {
    render(<PainelDeFiltros kind="resale" filtros={FILTROS_VAZIOS.resale} facetas={facetas}
      aoMudar={vi.fn()} aoLimpar={vi.fn()} aoRecolher={vi.fn()} />);
    expect(screen.getByText('Finalidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Captador')).toBeInTheDocument();
    expect(screen.queryByText('Fase da obra')).toBeNull();
  });
});

describe('PainelDeFiltros: preço', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('só manda o preço depois da pausa, uma vez, só com dígitos', () => {
    vi.useFakeTimers();
    const aoMudar = vi.fn();
    render(<PainelDeFiltros kind="resale" filtros={FILTROS_VAZIOS.resale} facetas={facetas}
      aoMudar={aoMudar} aoLimpar={vi.fn()} aoRecolher={vi.fn()} />);
    const campo = screen.getByLabelText('Preço de');
    fireEvent.change(campo, { target: { value: '3' } });
    fireEvent.change(campo, { target: { value: '30' } });
    fireEvent.change(campo, { target: { value: '300.000' } });
    expect(campo).toHaveValue('300000');
    expect(aoMudar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ATRASO_DO_PRECO);
    expect(aoMudar).toHaveBeenCalledTimes(1);
    expect(aoMudar).toHaveBeenCalledWith({ ...FILTROS_VAZIOS.resale, precoMin: '300000' });
  });

  it('pílulas ficam num grupo com o nome do campo', () => {
    render(<PainelDeFiltros kind="resale" filtros={FILTROS_VAZIOS.resale} facetas={facetas}
      aoMudar={vi.fn()} aoLimpar={vi.fn()} aoRecolher={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Vagas' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Finalidade' })).toBeInTheDocument();
  });
});

describe('EtiquetasDosFiltros', () => {
  it('tira um filtro e mostra Limpar tudo com mais de um', () => {
    const aoTirar = vi.fn();
    render(<EtiquetasDosFiltros itens={[{ chave: 'bairro', rotulo: 'Bairro: Cambuí' }, { chave: 'quartos', rotulo: 'Dorms: 2' }]}
      aoTirar={aoTirar} aoLimparTudo={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tirar o filtro Bairro: Cambuí' }));
    expect(aoTirar).toHaveBeenCalledWith('bairro');
    expect(screen.getByRole('button', { name: 'Limpar tudo' })).toBeInTheDocument();
  });
});
