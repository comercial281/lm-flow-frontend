import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Visit } from '@/services/visits/visitsService';
import { createRef } from 'react';
import { IconeDeQuemAgendou, PecaDaVisita } from './PecaDaVisita';

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
    expect(screen.getByRole('button', { name: /Agendada pela IA Vendedora/ })).toBeTruthy();
    expect(document.querySelector('svg[role="img"]')).toBeNull();
    expect(document.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('ícone avulso é uma imagem com nome', () => {
    render(<IconeDeQuemAgendou visita={{ booked_by: 'ia' }} />);
    expect(screen.getByRole('img', { name: 'Agendada pela IA Vendedora' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Agendada pela IA Vendedora' })).toHaveAttribute('title', 'Agendada pela IA Vendedora');
  });

  it('pessoa tem o ícone com o nome de quem agendou', () => {
    render(
      <PecaDaVisita
        visita={visita({ booked_by: 'pessoa', created_by: { id: 'u', name: 'Marina' } })}
        forma="pilula"
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Agendada por Marina/ })).toBeTruthy();
  });

  it('visita sem autor não tem ícone', () => {
    render(<PecaDaVisita visita={visita()} forma="pilula" onClick={() => {}} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button').getAttribute('aria-label')).not.toMatch(/Agendada (pela|por)/);
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
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('passou sem registro');
  });

  it('bloco mostra hora às fim, sem travessão', () => {
    render(<PecaDaVisita visita={visita()} forma="bloco" altura={60} duracaoMin={60} onClick={() => {}} />);
    expect(screen.getByRole('button').textContent).toMatch(/ às /);
    expect(screen.getByRole('button').textContent).not.toMatch(/[–—]/);
  });

  it('ref chega no botão e style do chamador junta com --st', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<PecaDaVisita ref={ref} visita={visita()} forma="bloco" style={{ top: 10, left: '5%', width: '40%' }} onClick={() => {}} />);
    expect(ref.current).toBe(screen.getByRole('button'));
    const st = ref.current!.style;
    expect(st.top).toBe('10px');
    expect(st.width).toBe('40%');
    expect(st.getPropertyValue('--st')).toBe('var(--visita-scheduled)');
  });

  it('chamador não sobrescreve id nem aria-label', () => {
    render(<PecaDaVisita visita={visita()} forma="pilula" onClick={() => {}} {...({ id: 'x', 'aria-label': 'y' } as object)} />);
    expect(screen.getByRole('button').id).toBe('visita-v1');
    expect(screen.getByRole('button').getAttribute('aria-label')).not.toBe('y');
  });

  it.each([
    ['Maria', 'Maria'],
    ['Maria de Souza', 'Maria S.'],
    ['  João   da Silva Lima ', 'João S.'],
    ['Ana e', 'Ana'],
  ])('nome curto de %s', (nome, esperado) => {
    render(<PecaDaVisita visita={visita({ contact: { id: 'c', name: nome } })} forma="pilula" onClick={() => {}} />);
    expect(screen.getByText(esperado)).toBeTruthy();
  });

  it('sem contato usa o imóvel inteiro; sem nada, "Visita"', () => {
    const { unmount } = render(
      <PecaDaVisita visita={visita({ contact: { id: 'c', name: '   ' }, property: { id: 'p', title: 'Apto dos Jardins Alto', code: 'A' } })} forma="pilula" onClick={() => {}} />,
    );
    expect(screen.getByText('Apto dos Jardins Alto')).toBeTruthy();
    unmount();
    render(<PecaDaVisita visita={visita({ contact: undefined, property: undefined })} forma="pilula" onClick={() => {}} />);
    expect(screen.getByText('Visita')).toBeTruthy();
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
