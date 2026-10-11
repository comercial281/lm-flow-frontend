// Equipe → Times → abrir um time: a aba Membros mostra quantos são (perdeu o "(n)"
// na troca pras Abas da casa).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamDetails from './TeamDetails';

describe('TeamDetails · aba Membros', () => {
  it('mostra a contagem de membros na aba', () => {
    const team = { id: 't1', name: 'Plantão Centro', allow_auto_assign: true, members_count: 3 };
    render(<TeamDetails open onOpenChange={vi.fn()} team={team} onEdit={vi.fn()} onManageUsers={vi.fn()} />);
    const abas = screen.getAllByRole('tab');
    expect(abas[1]).toHaveTextContent(/3/);
    expect(abas[0]).not.toHaveTextContent(/3/);
  });
});
