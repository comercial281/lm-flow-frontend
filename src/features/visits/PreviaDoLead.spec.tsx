import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { LeadSummary } from '@/services/visits/visitsService';

const leadSummary = vi.fn();
vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return { ...real, visitsService: { ...real.visitsService, leadSummary: (id: string) => leadSummary(id) } };
});

import { PreviaDoLead } from './PreviaDoLead';
import { posicaoDaPrevia } from './posicaoDaPrevia';
import { esquecerResumos } from './guardaDoResumo';

const RESUMO = {
  contact: { id: 'ct-1', name: 'Mariana Souza', phone_number: null },
  card: null, origin_label: null, owner: null, labels: [], last_message: null,
  conversation_id: null, ia: null, previous_visits_count: 0, lead_created_at: null, card_entered_at: null,
} satisfies LeadSummary;

// O jsdom não tem PointerEvent: o tipo do ponteiro vai pendurado num MouseEvent.
const ponteiro = (el: Element, tipo: 'pointerover' | 'pointerout' | 'pointerdown', pointerType = 'mouse') =>
  fireEvent(el, Object.assign(new MouseEvent(tipo, { bubbles: true }), { pointerType }));
const entrar = (el: Element, t = 'mouse') => ponteiro(el, 'pointerover', t);
const sair = (el: Element) => ponteiro(el, 'pointerout');

const montar = () =>
  render(
    <MemoryRouter>
      <PreviaDoLead visitaId="v1"><button type="button" className="peca">Peça</button></PreviaDoLead>
    </MemoryRouter>,
  );

const passar = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); }); };

beforeEach(() => {
  vi.useFakeTimers();
  esquecerResumos();
  leadSummary.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('PreviaDoLead', () => {
  it('não pede antes do atraso', async () => {
    montar();
    const peca = screen.getByRole('button', { name: 'Peça' });
    entrar(peca);
    await passar(300);
    sair(peca);
    await passar(1000);
    expect(leadSummary).not.toHaveBeenCalled();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('abre depois de 450 ms parado, com esqueleto e depois o resumo', async () => {
    let soltar: (r: LeadSummary) => void = () => {};
    leadSummary.mockReturnValue(new Promise<LeadSummary>((r) => { soltar = r; }));
    montar();
    const peca = screen.getByRole('button', { name: 'Peça' });
    entrar(peca);
    expect(peca).toHaveClass('armando');
    expect(peca).toHaveClass('peca'); // a classe de quem chama continua
    await passar(450);
    expect(peca).not.toHaveClass('armando');
    expect(leadSummary).toHaveBeenCalledWith('v1');
    const cartao = screen.getByRole('region', { name: 'Resumo do lead' });
    expect(cartao.querySelector('[data-esqueleto]')).not.toBeNull();
    await act(async () => { soltar(RESUMO); });
    expect(screen.getByText('Mariana Souza')).toBeInTheDocument();
    expect(screen.getByText('Clique para abrir a visita')).toBeInTheDocument();
    // abrir a prévia não rouba o foco da página
    expect(document.activeElement).toBe(document.body);
  });

  it('erro mostra o aviso da casa', async () => {
    leadSummary.mockRejectedValue(new Error('404'));
    montar();
    entrar(screen.getByRole('button', { name: 'Peça' }));
    await passar(450);
    expect(screen.getByText('Não deu para carregar o resumo do lead.')).toBeInTheDocument();
  });

  it('toque não abre a prévia', async () => {
    montar();
    entrar(screen.getByRole('button', { name: 'Peça' }), 'touch');
    await passar(1000);
    expect(leadSummary).not.toHaveBeenCalled();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('Esc fecha', async () => {
    leadSummary.mockResolvedValue(RESUMO);
    montar();
    entrar(screen.getByRole('button', { name: 'Peça' }));
    await passar(450);
    expect(screen.getByRole('region')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('o resumo guardado abre sem esqueleto e sem pedir de novo', async () => {
    leadSummary.mockResolvedValue(RESUMO);
    montar();
    const peca = screen.getByRole('button', { name: 'Peça' });
    entrar(peca);
    await passar(450);
    sair(peca);
    await passar(200);
    entrar(peca);
    await passar(450);
    expect(leadSummary).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region').querySelector('[data-esqueleto]')).toBeNull();
  });
});

describe('posicaoDaPrevia', () => {
  const tela = { largura: 1200, altura: 800 };
  const cartao = { largura: 320, altura: 300 };

  it('abre à direita da visita', () => {
    expect(posicaoDaPrevia({ left: 100, right: 200, top: 100 }, tela, cartao)).toEqual({ left: 210, top: 94 });
  });

  it('sem espaço à direita, abre à esquerda', () => {
    expect(posicaoDaPrevia({ left: 900, right: 1000, top: 100 }, tela, cartao).left).toBe(570);
  });

  it('nunca sai da tela', () => {
    const p = posicaoDaPrevia({ left: 0, right: 1190, top: 780 }, tela, cartao);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.top).toBe(800 - 300 - 8);
  });
});
