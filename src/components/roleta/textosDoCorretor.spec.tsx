// Textos do corretor (roleta nova, 06/10/2026): a tela de aceite e a faixa
// amarela falam como o pop-up de aceite ("Lead novo pra você") e não prometem
// conversa no número dele (corretor sem número próprio recebe os dados).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const ofertas = vi.hoisted(() => ({ lista: [] as unknown[] }));
vi.mock('@/contexts/PendingOffersContext', () => ({ usePendingOffers: () => ({ offers: ofertas.lista }) }));
const svc = vi.hoisted(() => ({ get: vi.fn(), accept: vi.fn(), refuse: vi.fn() }));
vi.mock('@/services/roletaConfig/brokerAssignmentsService', () => ({ brokerAssignmentsService: svc }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import PendingOffersBanner from './PendingOffersBanner';
import AcceptLeadPage from '@/pages/Customer/Roleta/AcceptLeadPage';
import { dataHora } from '@/lib/formato';

const oferta = (extra: Record<string, unknown> = {}) => ({
  id: 'ba-1', status: 'pending', lead_name: 'Maria Teste', lead_phone: null,
  assigned_at: '2026-10-06T12:00:00Z', deadline: null, conversation_id: null, ...extra,
});

beforeEach(() => {
  ofertas.lista = [];
  svc.get.mockReset();
  svc.accept.mockReset();
  toast.success.mockReset();
});

describe('faixa amarela', () => {
  it('fala "Lead novo pra você", com o prazo e quantos esperam', () => {
    ofertas.lista = [
      oferta({ deadline: new Date(Date.now() + 11 * 60_000 + 30_000).toISOString(), timeout_minutes: 15 }),
      oferta({ id: 'ba-2' }), oferta({ id: 'ba-3' }),
    ];
    render(<MemoryRouter><PendingOffersBanner /></MemoryRouter>);
    const faixa = screen.getByText(/Lead novo pra você/);
    expect(faixa).toHaveTextContent('Lead novo pra você: Maria Teste · 12 min pra aceitar · +2 esperando');
  });

  it('sem prazo diz "sem prazo"', () => {
    ofertas.lista = [oferta()];
    render(<MemoryRouter><PendingOffersBanner /></MemoryRouter>);
    expect(screen.getByText(/Lead novo pra você/)).toHaveTextContent('Lead novo pra você: Maria Teste · sem prazo');
  });
});

describe('tela de aceite', () => {
  const abrir = () => render(
    <MemoryRouter initialEntries={['/roleta/aceite/ba-1']}>
      <Routes>
        <Route path="/roleta/aceite/:assignmentId" element={<AcceptLeadPage />} />
        <Route path="/conversations" element={<p>Conversas</p>} />
      </Routes>
    </MemoryRouter>,
  );

  it('título "Lead novo pra você" e não promete conversa no número do corretor', async () => {
    svc.get.mockResolvedValue(oferta());
    abrir();
    expect(await screen.findByRole('heading', { name: 'Lead novo pra você' })).toBeInTheDocument();
    expect(screen.getByText(/Ao aceitar, o lead é seu\./)).toBeInTheDocument();
    expect(screen.queryByText(/sai pelo seu número/)).toBeNull();
    // Pelo formato da casa, em qualquer fuso da máquina que roda o teste.
    expect(screen.getByText(`Chegou em ${dataHora('2026-10-06T12:00:00Z')}`)).toBeInTheDocument();
  });

  it('aceitar avisa "Lead aceito! Ele é seu."', async () => {
    svc.get.mockResolvedValue(oferta());
    svc.accept.mockResolvedValue(oferta({ status: 'accepted' }));
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: /Aceitar/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Lead aceito! Ele é seu.'));
  });

  it('oferta cancelada pela gestão diz isso, sem falar em prazo', async () => {
    svc.get.mockResolvedValue(oferta({ status: 'cancelled' }));
    abrir();
    expect(await screen.findByText('A gestão mudou o destino deste lead.')).toBeInTheDocument();
  });
});
