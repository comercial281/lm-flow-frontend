// src/components/roleta/OfferPopup.spec.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { BrokerAssignmentDetail } from '@/services/roletaConfig/brokerAssignmentsService';

const navegar = vi.fn();
vi.mock('react-router-dom', async orig => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navegar,
}));

const toastErro = vi.fn();
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: (m: string) => toastErro(m) } }));

let ofertas: BrokerAssignmentDetail[] = [];
const accept = vi.fn();
const refuse = vi.fn();
const refresh = vi.fn(async () => undefined);
vi.mock('@/contexts/PendingOffersContext', () => ({
  usePendingOffers: () => ({ offers: ofertas, accept, refuse, refresh }),
}));

import OfferPopup, { TRAVA_MS } from './OfferPopup';
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

// Aceitar/Recusar nascem travados por TRAVA_MS (ver C1 no topo do componente).
const destravar = () => act(() => { vi.advanceTimersByTime(TRAVA_MS); });
const aberto = () => screen.queryByText('Lead novo pra você') !== null;

describe('OfferPopup', () => {
  beforeEach(() => {
    ofertas = [];
    navegar.mockReset();
    accept.mockReset();
    refuse.mockReset();
    play.mockClear();
    toastErro.mockReset();
    refresh.mockClear();
    vi.useFakeTimers();
    try { sessionStorage.clear(); } catch { /* sem armazenamento */ }
    vi.stubGlobal('Audio', vi.fn(() => ({ play, volume: 1 })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('não desenha nada sem oferta', () => {
    montar();
    expect(screen.queryByText('Lead novo pra você')).not.toBeInTheDocument();
  });

  it('abre com uma oferta nova, com nome, roleta, origem e prazo, e toca o som', () => {
    ofertas = [oferta('som', { lead_name: 'Maria Fictícia', roleta_name: 'Roleta Centro', origin_label: 'Formulário do anúncio' })];
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
    destravar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aceitar' })); });
    expect(accept).toHaveBeenCalledWith('a');
    expect(navegar).toHaveBeenCalledWith('/conversations/42');
  });

  it('Aceitar lead sem conversa leva ao card do lead', async () => {
    ofertas = [oferta('a')];
    accept.mockResolvedValue(oferta('a', { status: 'accepted', contact_id: 'contato-x' }));
    montar();
    destravar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aceitar' })); });
    expect(navegar).toHaveBeenCalledWith('/contacts/contato-x');
  });

  it('Recusar chama a recusa da lista de ofertas e não navega', async () => {
    ofertas = [oferta('a')];
    refuse.mockResolvedValue(oferta('a', { status: 'passed' }));
    montar();
    destravar();
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

  it('depois de "Ver depois", passa para a próxima e o "+N" desconta a vista', () => {
    ofertas = [
      oferta('antiga', { assigned_at: '2026-10-06T12:00:00Z' }),
      oferta('meio', { assigned_at: '2026-10-06T12:05:00Z' }),
    ];
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver depois' }));
    expect(screen.getByText('Lead meio')).toBeInTheDocument();
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

  // C1: o pop-up abre no meio da digitação do chat. O foco não pode cair num
  // botão de ação, e Aceitar/Recusar ficam travados por um instante — senão o
  // Enter/espaço seguinte recusa o lead sem volta.
  it('ao abrir, o foco vai para o título, nunca para Aceitar ou Recusar', () => {
    ofertas = [oferta('a')];
    montar();
    const foco = document.activeElement as HTMLElement;
    expect(foco).toHaveTextContent('Lead novo pra você');
    expect(foco).not.toBe(screen.getByRole('button', { name: 'Recusar' }));
    expect(foco).not.toBe(screen.getByRole('button', { name: 'Aceitar' }));
  });

  it('Enter e espaço logo depois de abrir não recusam nem aceitam', async () => {
    ofertas = [oferta('a')];
    montar();
    await act(async () => {
      for (const key of ['Enter', ' ']) {
        fireEvent.keyDown(document.activeElement!, { key });
        fireEvent.keyUp(document.activeElement!, { key });
      }
      // Mesmo um clique que já estava a caminho cai na trava.
      fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));
    });
    expect(refuse).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
    expect(aberto()).toBe(true);
  });

  it('trava de novo ao trocar para a próxima oferta', () => {
    ofertas = [oferta('a'), oferta('b', { assigned_at: '2026-10-06T12:05:00Z' })];
    const { rerender } = montar();
    destravar();
    expect(screen.getByRole('button', { name: 'Recusar' })).toBeEnabled();

    // A oferta "a" saiu da lista (prazo, aceite em outro lugar): entra a "b".
    ofertas = [oferta('b', { assigned_at: '2026-10-06T12:05:00Z' })];
    rerender(
      <MemoryRouter initialEntries={['/pipelines']}>
        <OfferPopup />
      </MemoryRouter>,
    );
    expect(screen.getByText('Lead b')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recusar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeDisabled();
  });

  // I1: clique fora não adia a oferta; Esc adia (= Ver depois), mas não com
  // Aceitar/Recusar em curso.
  it('clique fora não fecha nem adia a oferta', () => {
    ofertas = [oferta('a')];
    montar();
    act(() => { vi.advanceTimersByTime(1); });
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);
    expect(aberto()).toBe(true);
    expect(sessionStorage.getItem(CHAVE_OFERTAS_VISTAS)).toBeNull();
  });

  it('Esc sem nada em curso vale como "Ver depois"', () => {
    ofertas = [oferta('a')];
    montar();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(aberto()).toBe(false);
    expect(JSON.parse(sessionStorage.getItem(CHAVE_OFERTAS_VISTAS) ?? '[]')).toEqual(['a']);
  });

  it('Esc com o aceite em curso não fecha', async () => {
    ofertas = [oferta('a')];
    accept.mockReturnValue(new Promise(() => {}));
    montar();
    destravar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aceitar' })); });
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(aberto()).toBe(true);
    expect(sessionStorage.getItem(CHAVE_OFERTAS_VISTAS)).toBeNull();
  });

  it('aceite que falha mostra o motivo, relê a lista e mantém a oferta', async () => {
    ofertas = [oferta('a')];
    accept.mockRejectedValue({ response: { data: { error: 'Este lead já foi aceito.' } } });
    montar();
    destravar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aceitar' })); });
    expect(toastErro).toHaveBeenCalledWith('Este lead já foi aceito.');
    expect(refresh).toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();
    expect(screen.getByText('Lead a')).toBeInTheDocument();
  });
});
