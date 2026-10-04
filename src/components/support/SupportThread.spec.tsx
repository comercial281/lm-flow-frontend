import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupportThread from './SupportThread';
import type { SupportMessage } from '@/services/support/supportService';

const msgs: SupportMessage[] = [
  { id: '1', author_side: 'customer', author_name: 'Ana', body: 'Não salva', created_at: '2026-10-04T10:00:00Z', images: ['https://x/p.png?tenant=public'] },
  { id: '2', author_side: 'team', author_name: 'Tony', body: 'Corrigido', created_at: '2026-10-04T11:00:00Z', images: [] },
];

describe('SupportThread', () => {
  it('do lado do cliente, a resposta do time aparece só como Suporte, sem o nome de quem respondeu', () => {
    render(<SupportThread mensagens={msgs} eu="customer" />);
    expect(screen.getByText('Suporte')).toBeInTheDocument();
    expect(screen.queryByText(/Tony/)).toBeNull();
    expect(screen.getByText('Não salva').closest('[data-lado]')).toHaveAttribute('data-lado', 'eu');
  });

  it('do lado do time, o lado se inverte', () => {
    render(<SupportThread mensagens={msgs} eu="team" />);
    expect(screen.getByText('Corrigido').closest('[data-lado]')).toHaveAttribute('data-lado', 'eu');
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('imagem abre grande em outra aba', () => {
    render(<SupportThread mensagens={msgs} eu="customer" />);
    expect(screen.getByRole('link', { name: 'Abrir imagem 1' })).toHaveAttribute('target', '_blank');
  });
});
