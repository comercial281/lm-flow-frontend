import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { limparPendentes, marcarPendente } from '@/hooks/useAlteracoesNaoSalvas';

// vi.mock sobe pro topo do arquivo: o marcador precisa subir junto (vi.hoisted) e
// pegar o React por import dinâmico.
const { marcador } = vi.hoisted(() => ({
  marcador: async (texto: string) => {
    const { createElement } = await import('react');
    return { default: () => createElement('p', null, texto) };
  },
}));
vi.mock('./passos/Passo1QuemEla', () => marcador('passo 1 aberto'));
vi.mock('./passos/Passo2Objetivo', () => marcador('passo 2 aberto'));
vi.mock('./passos/Passo3Roteiro', () => marcador('passo 3 aberto'));
vi.mock('./passos/Passo4Visita', () => marcador('passo 4 aberto'));
vi.mock('./passos/Passo5Vende', () => marcador('passo 5 aberto'));
vi.mock('./passos/Passo6Atendimento', () => marcador('passo 6 aberto'));
vi.mock('./passos/Passo7VoltarAChamar', () => marcador('passo 7 aberto'));
vi.mock('./passos/Passo8TestarLigar', () => marcador('passo 8 aberto'));
vi.mock('./Avancado', () => marcador('avançado aberto'));

import PassoAPasso from './PassoAPasso';

function Endereco() {
  return <p data-testid="endereco">{useLocation().search}</p>;
}

// Uma IA sem pendência nenhuma além das que cada teste põe.
const completa = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({
  lead_facing_name: 'Bia', persona_kind: 'owner', handoff_target: 'inbox_roleta', handoff_user_id: null,
  transfer_config: { mode: 'checklist', required_questions: ['Renda'] }, ...extra,
});

const abrir = (agent: SalesAgent, url = '/ia-vendedora?ia=ia-1&tela=configurar') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/ia-vendedora" element={<><PassoAPasso agent={agent} inboxes={[]} aoSalvo={vi.fn()} /><Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => limparPendentes());

describe('PassoAPasso', () => {
  it('sem ?passo=, abre direto no passo com pendência e escreve no endereço', async () => {
    abrir(completa({ inbox_id: null }));
    expect(await screen.findByText('passo 6 aberto')).toBeTruthy();
    expect(screen.getByTestId('endereco').textContent).toContain('passo=6');
  });

  it('sem pendência, abre no passo 1', async () => {
    abrir(completa());
    expect(await screen.findByText('passo 1 aberto')).toBeTruthy();
  });

  it('?passo=3 abre o 3', () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&passo=3');
    expect(screen.getByText('passo 3 aberto')).toBeTruthy();
  });

  it('o trilho é clicável e mantém a IA e a tela no endereço', async () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&passo=1');
    await userEvent.click(screen.getByRole('button', { name: /Objetivo/ }));
    expect(screen.getByText('passo 2 aberto')).toBeTruthy();
    expect(screen.getByTestId('endereco').textContent).toBe('?ia=ia-1&tela=configurar&passo=2');
  });

  it('Visita fica travada quando ela só qualifica', () => {
    abrir(completa({ reach: 'qualify' }), '/ia-vendedora?ia=ia-1&tela=configurar&passo=1');
    expect(screen.getByRole('button', { name: /Visita/ })).toBeDisabled();
  });

  it('o passo com pendência é marcado no trilho', () => {
    abrir(completa({ inbox_id: null }), '/ia-vendedora?ia=ia-1&tela=configurar&passo=1');
    expect(screen.getByRole('button', { name: /Atendimento.*tem pendência/ })).toBeTruthy();
  });

  it('?passo=avancado abre o Avançado', () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&passo=avancado');
    expect(screen.getByText('avançado aberto')).toBeTruthy();
  });

  it('com alteração não salva, trocar de passo pergunta antes', async () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&passo=1');
    marcarPendente('teste', true);
    await userEvent.click(screen.getByRole('button', { name: /Roteiro/ }));
    expect(screen.getByText('Sair sem salvar?')).toBeTruthy();
    expect(screen.getByText('passo 1 aberto')).toBeTruthy();
  });
});
