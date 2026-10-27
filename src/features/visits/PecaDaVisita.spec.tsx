import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Visit } from '@/services/visits/visitsService';
import { PecaDaVisita } from './PecaDaVisita';

function visita(extra: Partial<Visit> = {}): Visit {
  return {
    id: 'v1',
    property_id: 'p1',
    contact_id: 'c1',
    status: 'scheduled',
    scheduled_at: '2099-01-10T17:00:00.000Z',
    contact: { id: 'c1', name: 'Maria Souza' },
    property: { id: 'p1', title: 'Apto Jardins', code: 'AP1' },
    created_at: '2099-01-01T00:00:00Z',
    updated_at: '2099-01-01T00:00:00Z',
    ...extra,
  };
}

describe('PecaDaVisita', () => {
  it('pílula da IA tem o robô com o nome certo', () => {
    render(<PecaDaVisita visita={visita({ booked_by: 'ia' })} forma="pilula" onClick={() => {}} />);
    expect(screen.getByRole('img', { name: 'Agendada pela IA Vendedora' })).toBeTruthy();
  });

  it('pessoa tem o ícone com o nome de quem agendou', () => {
    render(
      <PecaDaVisita
        visita={visita({ booked_by: 'pessoa', created_by: { id: 'u', name: 'Marina' } })}
        forma="pilula"
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole('img', { name: 'Agendada por Marina' })).toBeTruthy();
  });

  it('visita sem autor não tem ícone', () => {
    render(<PecaDaVisita visita={visita()} forma="pilula" onClick={() => {}} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('cancelada fica riscada', () => {
    render(<PecaDaVisita visita={visita({ status: 'cancelled' })} forma="pilula" onClick={() => {}} />);
    expect(screen.getByText('Maria S.').className).toContain('line-through');
  });

  it('atrasada mostra o aviso', () => {
    render(
      <PecaDaVisita visita={visita({ scheduled_at: '2000-01-10T17:00:00.000Z' })} forma="pilula" onClick={() => {}} />,
    );
    expect(screen.getByTitle('Passou e ninguém registrou')).toBeTruthy();
  });

  it('bloco baixo esconde o imóvel', () => {
    const { rerender } = render(<PecaDaVisita visita={visita()} forma="bloco" altura={30} onClick={() => {}} />);
    expect(screen.queryByText('Apto Jardins')).toBeNull();
    rerender(<PecaDaVisita visita={visita()} forma="bloco" altura={60} onClick={() => {}} />);
    expect(screen.getByText('Apto Jardins')).toBeTruthy();
  });

  it('mantém id, clique e handlers da prévia', () => {
    const onClick = vi.fn();
    const onPointerEnter = vi.fn();
    render(<PecaDaVisita visita={visita()} forma="pilula" onClick={onClick} onPointerEnter={onPointerEnter} destacada />);
    const b = screen.getByRole('button');
    expect(b.id).toBe('visita-v1');
    expect(b.className).toContain('ring-2');
    fireEvent.pointerEnter(b);
    fireEvent.click(b);
    expect(onPointerEnter).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1' }));
  });
});
