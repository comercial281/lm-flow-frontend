// src/pages/SuperAdmin/PooledClients/QuadrosDeFuncoes.spec.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import QuadrosDeFuncoes from './QuadrosDeFuncoes';

const catalog = [
  { key: 'disparos', label: 'Disparos', group: 'disparos', theme: 'automacoes', theme_label: 'Automações' },
  { key: 'disparos_agendados', label: 'Agendar disparo', group: 'disparos', theme: 'automacoes', theme_label: 'Automações' },
  { key: 'conversations', label: 'Conversas', group: 'conversations', theme: 'atendimento', theme_label: 'Atendimento' },
];

describe('QuadrosDeFuncoes', () => {
  it('todos os temas abertos, com contagem; menu desligado apaga as funções dele', () => {
    const estado: Record<string, boolean> = { disparos: false, disparos_agendados: true, conversations: true };
    render(<QuadrosDeFuncoes catalog={catalog} ligada={(k) => estado[k]} aoMudar={vi.fn()} />);
    const automacoes = screen.getByRole('region', { name: /Automações/ });
    expect(within(automacoes).getByText('1 de 2 ligadas')).toBeInTheDocument();
    expect(within(automacoes).getByRole('switch', { name: 'Agendar disparo' })).toBeDisabled();
    expect(screen.getByRole('region', { name: /Atendimento/ })).toBeInTheDocument();
  });

  it('ligar tudo do tema é uma chamada só com todas as chaves', async () => {
    const aoMudar = vi.fn().mockResolvedValue(undefined);
    render(<QuadrosDeFuncoes catalog={catalog} ligada={() => false} aoMudar={aoMudar} />);
    fireEvent.click(within(screen.getByRole('region', { name: /Automações/ })).getByRole('button', { name: 'Ligar tudo' }));
    await waitFor(() => expect(aoMudar).toHaveBeenCalledTimes(1));
    expect(aoMudar).toHaveBeenCalledWith({ disparos: true, disparos_agendados: true }, { tema: 'Automações' });
  });

  it('marca ≠ pacote e filtra só o que difere', () => {
    render(<QuadrosDeFuncoes catalog={catalog} ligada={() => true} aoMudar={vi.fn()} diferentes={new Set(['conversations'])} somenteDiferentes />);
    expect(screen.getByText('≠ pacote')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Automações/ })).not.toBeInTheDocument();
  });

  it('busca por nome', () => {
    render(<QuadrosDeFuncoes catalog={catalog} ligada={() => true} aoMudar={vi.fn()} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar função' }), { target: { value: 'convers' } });
    expect(screen.queryByRole('region', { name: /Automações/ })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Conversas' })).toBeInTheDocument();
  });
});
