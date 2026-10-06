// src/components/roleta/OfferPopup.spec.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { BrokerAssignmentDetail } from '@/services/roletaConfig/brokerAssignmentsService';

const navegar = vi.fn();
vi.mock('react-router-dom', async orig => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navegar,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

let ofertas: BrokerAssignmentDetail[] = [];
const accept = vi.fn();
const refuse = vi.fn();
const refresh = vi.fn(async () => undefined);
vi.mock('@/contexts/PendingOffersContext', () => ({
  usePendingOffers: () => ({ offers: ofertas, accept, refuse, refresh }),
}));

import OfferPopup from './OfferPopup';
import { CHAVE_OFERTAS_VISTAS } from './offerPopupState';

// O pop-up de aceite abre sobre qualquer tela quando chega uma oferta que o
// corretor ainda não viu. O que este spec trava: abre com oferta nova; "Ver
// depois" não reabre a mesma oferta; Aceitar e Recusar são as MESMAS chamadas
// da tela de aceite (a lista de ofertas do app); Aceitar leva ao lead; várias
// ofertas mostram a mais antiga com "+N esperando".
const oferta = (id: string, extra: Partial<BrokerAssignmentDetail> = {}): BrokerAssignmentDetail => ({
  id,
  status: 'pending',
  lead_name: `Lead ${id}`,
  lead_phone: null,
  assigned_at: '2026-10-06T12:00:00Z',
  deadline: null,
  minutes_remaining: null,
  timeout_minutes: 0,
  no_deadline: true,
  round: 1,
  corretor: 'Corretor Teste',
  conversation_id: null,
  conversation_display_id: null,
  contact_id: `contato-${id}`,
  ...extra,
});

const montar = (rota = '/pipelines') =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <OfferPopup />
    </MemoryRouter>,
  );

const play = vi.fn(() => Promise.resolve());

describe('OfferPopup', () => {
  beforeEach(() => {
    ofertas = [];
    navegar.mockReset();
    accept.mockReset();
    refuse.mockReset();
    play.mockClear();
    try { sessionStorage.clear(); } catch { /* sem armazenamento */ }
    vi.stubGlobal('Audio', vi.fn(() => ({ play, volume: 1 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('não desenha nada sem oferta', () => {
    montar();
    expect(screen.queryByText('Lead novo pra você')).not.toBeInTheDocument();
  });

  it('abre com uma oferta nova, com nome, roleta, origem e prazo, e toca o som', () => {
    ofertas = [oferta('a', { lead_name: 'Maria Fictícia', roleta_name: 'Roleta Centro', origin_label: 'Formulário do anúncio' })];
    montar();
    expect(screen.getByText('Lead novo pra você')).toBeInTheDocument();
    expect(screen.getByText('Maria Fictícia')).toBeInTheDocument();
    expect(screen.getByText('Roleta Centro')).toBeInTheDocument();
    expect(screen.getByText('Formulário do anúncio')).toBeInTheDocument();
    // deadline nulo NÃO é "prazo esgotado".
    expect(screen.getByText('Sem prazo de aceite')).toBeInTheDocument();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('mostra a contagem do prazo quando a roleta tem prazo', () => {
    const daqui12 = new Date(Date.now() + 12 * 60_000 - 1_000).toISOString();
    ofertas = [oferta('a', { deadline: daqui12, minutes_remaining: 12, timeout_minutes: 30, no_deadline: false })];
    montar();
    expect(screen.getByText('Aceite em até 12 min')).toBeInTheDocument();
  });

  it('não abre na própria tela de aceite', () => {
    ofertas = [oferta('a')];
    montar('/roleta/aceite/a');
    expect(screen.queryByText('Lead novo pra você')).not.toBeInTheDocument();
  });

  it('"Ver depois" fecha e não reabre a mesma oferta', () => {
    ofertas = [oferta('a')];
    const { unmount } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver depois' }));
    expect(screen.queryByText('Lead novo pra você')).not.toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(CHAVE_OFERTAS_VISTAS) ?? '[]')).toEqual(['a']);

    // Recarregar a tela na mesma aba não reabre.
    unmount();
    montar();
    expect(screen.queryByText('Lead novo pra você')).not.toBeInTheDocument();
  });

  it('oferta nova abre mesmo depois de "Ver depois" em outra', () => {
    ofertas = [oferta('a')];
    const { rerender } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver depois' }));

    ofertas = [oferta('a'), oferta('b', { assigned_at: '2026-10-06T12:05:00Z' })];
    rerender(
      <MemoryRouter initialEntries={['/pipelines']}>
        <OfferPopup />
      </MemoryRouter>,
    );
    expect(screen.getByText('Lead b')).toBeInTheDocument();
  });

  it('Aceitar chama o aceite da lista de ofertas e leva à conversa do lead', async () => {
    ofertas = [oferta('a')];
    accept.mockResolvedValue(oferta('a', { status: 'accepted', conversation_id: 'conv-uuid', conversation_display_id: 42 }));
    montar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aceitar' })); });
    expect(accept).toHaveBeenCalledWith('a');
    expect(navegar).toHaveBeenCalledWith('/conversations/42');
  });

  it('Aceitar lead sem conversa leva ao card do lead', async () => {
    ofertas = [oferta('a')];
    accept.mockResolvedValue(oferta('a', { status: 'accepted', contact_id: 'contato-x' }));
    montar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aceitar' })); });
    expect(navegar).toHaveBeenCalledWith('/contacts/contato-x');
  });

  it('Recusar chama a recusa da lista de ofertas e não navega', async () => {
    ofertas = [oferta('a')];
    refuse.mockResolvedValue(oferta('a', { status: 'passed' }));
    montar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Recusar' })); });
    expect(refuse).toHaveBeenCalledWith('a');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('várias ofertas: mostra a mais antiga e "+N esperando"', () => {
    ofertas = [
      oferta('nova', { assigned_at: '2026-10-06T12:10:00Z' }),
      oferta('antiga', { assigned_at: '2026-10-06T12:00:00Z' }),
      oferta('meio', { assigned_at: '2026-10-06T12:05:00Z' }),
    ];
    montar();
    expect(screen.getByText('Lead antiga')).toBeInTheDocument();
    expect(screen.getByText('+2 esperando')).toBeInTheDocument();
  });

  it('depois de "Ver depois", passa para a próxima e o "+N" desconta a vista', async () => {
    ofertas = [
      oferta('antiga', { assigned_at: '2026-10-06T12:00:00Z' }),
      oferta('meio', { assigned_at: '2026-10-06T12:05:00Z' }),
    ];
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver depois' }));
    await waitFor(() => expect(screen.getByText('Lead meio')).toBeInTheDocument());
    expect(screen.queryByText(/esperando/)).not.toBeInTheDocument();
  });

  it('sessionStorage quebrado não derruba o pop-up', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    ofertas = [oferta('a')];
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver depois' }));
    expect(screen.queryByText('Lead novo pra você')).not.toBeInTheDocument();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
