// O link do "Mandar um aviso de teste" da IA: a mesma tela de aceite, com um lead
// de exemplo, e os botões explicam em vez de chamar o servidor.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const svc = vi.hoisted(() => ({ get: vi.fn(), accept: vi.fn(), refuse: vi.fn() }));
vi.mock('@/services/roletaConfig/brokerAssignmentsService', () => ({ brokerAssignmentsService: svc }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import AcceptLeadPage from './AcceptLeadPage';

const abrir = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/roleta/aceite/:assignmentId" element={<AcceptLeadPage />} /></Routes>
  </MemoryRouter>,
);

describe('aceite de teste', () => {
  it('roleta com prazo: cronômetro e a recusa passa pro próximo da fila, sem chamar o servidor', async () => {
    abrir('/roleta/aceite/teste?prazo=10&destino=roleta');
    expect(screen.getByText('TESTE')).toBeInTheDocument();
    expect(screen.getByText('Lead de teste')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Recusar/ }));
    expect(screen.getByText(/passaria pro próximo corretor da fila/)).toBeInTheDocument();
    expect(svc.get).not.toHaveBeenCalled();
    expect(svc.refuse).not.toHaveBeenCalled();
  });

  it('corretor fixo: sem prazo, aceitar explica que o lead vira seu', async () => {
    abrir('/roleta/aceite/teste?prazo=0&destino=fixo');
    expect(screen.getByText('Sem prazo de aceite')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Aceitar/ }));
    expect(screen.getByText(/o lead vira seu agora/)).toBeInTheDocument();
    expect(svc.accept).not.toHaveBeenCalled();
  });
});
