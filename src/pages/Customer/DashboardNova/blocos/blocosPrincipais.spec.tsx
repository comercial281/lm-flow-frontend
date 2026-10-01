// src/pages/Customer/DashboardNova/blocos/blocosPrincipais.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const offers = vi.hoisted(() => ({ list: [] as { id: string }[] }));
vi.mock('@/contexts/PendingOffersContext', () => ({ usePendingOffers: () => ({ offers: offers.list }) }));

const navegar = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async orig => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navegar }));

import { Imoveis } from './Imoveis';
import { Numeros } from './Numeros';
import { Pendencias } from './Pendencias';
import { diaDoPeriodo } from './comum';
import type { ContextoBloco } from '../usePodeAbrir';

const pode = { imoveis: true, agenda: true, propostas: true, funil: true, roleta: true };
const periodo = { preset: 'last_7_days', since: '2026-09-24T00:00:00-03:00', until: '2026-09-30T23:59:59-03:00', granularity: 'day', days: 7, previous: { since: '', until: '' } };

function ctx(over: Partial<ContextoBloco> = {}, dados: Record<string, unknown> = {}): ContextoBloco {
  return {
    dados: { period: periodo, scope: { mode: 'all', locked: false, available_modes: ['all'], blocks: { media_spend: false, operations: false } }, ...dados } as never,
    carregando: false, visao: 'gestor', pode, abrirLista: vi.fn(), mudarFunil: vi.fn(), ...over,
  };
}

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  navegar.mockReset();
});

describe('diaDoPeriodo', () => {
  it('pega o dia do período no fuso do servidor', () => {
    expect(diaDoPeriodo('2026-09-24T00:00:00-03:00')).toBe('2026-09-24');
    expect(diaDoPeriodo('')).toBeUndefined();
    expect(diaDoPeriodo(null)).toBeUndefined();
    expect(diaDoPeriodo('ontem')).toBeUndefined();
  });
});

describe('bloco Imóveis', () => {
  const properties = { active: 415, new: 9, exclusive: 38, on_sign: 19, without_photos: 3, off_site: 8, stale: 296, stale_after_days: 60 };

  it('cada linha leva a Imóveis filtrado', () => {
    wrap(<Imoveis {...ctx({}, { properties })} />);
    fireEvent.click(screen.getByRole('button', { name: /Sem fotos/ }));
    expect(navegar).toHaveBeenCalledWith('/properties?recorte=sem_fotos');
  });

  it('Novos leva o período inteiro, do primeiro ao último dia', () => {
    wrap(<Imoveis {...ctx({}, { properties })} />);
    fireEvent.click(screen.getByRole('button', { name: /Novos no período/ }));
    expect(navegar).toHaveBeenLastCalledWith('/properties?recorte=novos&desde=2026-09-24&ate=2026-09-30');
  });

  it('o corretor vai para os imóveis dele', () => {
    wrap(<Imoveis {...ctx({ visao: 'corretor' }, { properties })} />);
    fireEvent.click(screen.getByRole('button', { name: /Desatualizados/ }));
    expect(navegar).toHaveBeenLastCalledWith('/properties?recorte=desatualizados&meus=1');
  });

  it('sem permissão de Imóveis, as linhas não são links', () => {
    wrap(<Imoveis {...ctx({ pode: { ...pode, imoveis: false } }, { properties })} />);
    expect(screen.queryByRole('button', { name: /Sem fotos/ })).not.toBeInTheDocument();
    expect(screen.getByText('Sem fotos')).toBeInTheDocument();
  });
});

describe('bloco Números', () => {
  const kpis = {
    leads: { value: 195, previous: 172, delta: 13.4 },
    conversations: { value: 312, previous: 300, delta: 4 },
    visits_scheduled: { value: 28, previous: 30, delta: -6.7 },
    proposals: { value: 9, previous: 6, delta: 50 },
  };

  it('Leads e Conversas abrem a lista rápida; Visitas vai para a Agenda no período', () => {
    const abrirLista = vi.fn();
    wrap(<Numeros {...ctx({ abrirLista }, { kpis })} />);
    fireEvent.click(screen.getByRole('button', { name: /Leads captados/ }));
    expect(abrirLista).toHaveBeenCalledWith('leads_periodo', 'Leads captados');
    fireEvent.click(screen.getByRole('button', { name: /Conversas/ }));
    expect(abrirLista).toHaveBeenLastCalledWith('conversas_periodo', 'Conversas');
    fireEvent.click(screen.getByRole('button', { name: /Visitas agendadas/ }));
    expect(navegar).toHaveBeenLastCalledWith('/visits?desde=2026-09-24&ate=2026-09-30');
  });

  it('Propostas vai para Propostas no período', () => {
    wrap(<Numeros {...ctx({}, { kpis })} />);
    fireEvent.click(screen.getByRole('button', { name: /Propostas/ }));
    expect(navegar).toHaveBeenLastCalledWith('/proposals?desde=2026-09-24&ate=2026-09-30');
  });

  it('Propostas sem o menu liberado aparece, mas não é link', () => {
    wrap(<Numeros {...ctx({ pode: { ...pode, propostas: false } }, { kpis })} />);
    expect(screen.queryByRole('button', { name: /Propostas/ })).not.toBeInTheDocument();
    expect(screen.getByText('Propostas')).toBeInTheDocument();
  });

  it('o corretor lê "Leads recebidos"', () => {
    wrap(<Numeros {...ctx({ visao: 'corretor' }, { kpis })} />);
    expect(screen.getByText('Leads recebidos')).toBeInTheDocument();
  });

  it('para o corretor, Propostas é só o número: a lista ainda não separa por corretor', () => {
    wrap(<Numeros {...ctx({ visao: 'corretor' }, { kpis })} />);
    expect(screen.queryByRole('button', { name: /Propostas/ })).not.toBeInTheDocument();
    expect(screen.getByText('Propostas')).toBeInTheDocument();
  });
});

describe('bloco Pendências', () => {
  const pending = {
    rows: [
      { key: 'sem_responsavel', total: 4, older: 3 },
      { key: 'esperando_resposta', total: 7, older: 0, capped: false },
      { key: 'sem_contato', total: 0, older: 0 },
      { key: 'visitas_a_confirmar', total: 3, older: 1 },
      { key: 'visitas_sem_feedback', total: 2, older: 2 },
    ],
  };

  it('mostra o total, os parados desde ontem e abre a lista da linha', () => {
    const abrirLista = vi.fn();
    wrap(<Pendencias {...ctx({ abrirLista }, { pending })} />);
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText(/3 desde ontem ou antes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Leads sem responsável/ }));
    expect(abrirLista).toHaveBeenCalledWith('sem_responsavel', 'Leads sem responsável');
  });

  it('"Esperando resposta" no teto mostra 500+', () => {
    const rows = [{ key: 'esperando_resposta', total: 500, older: 120, capped: true }];
    wrap(<Pendencias {...ctx({}, { pending: { rows } })} />);
    expect(screen.getAllByText('500+').length).toBeGreaterThan(0);
  });

  it('o corretor vê as ofertas esperando o aceite dele', () => {
    offers.list = [{ id: 'o1' }, { id: 'o2' }];
    wrap(<Pendencias {...ctx({ visao: 'corretor' }, { pending: { rows: pending.rows.slice(1) } })} />);
    fireEvent.click(screen.getByRole('button', { name: /Ofertas esperando seu aceite/ }));
    expect(navegar).toHaveBeenLastCalledWith('/roleta/aceite/o1');
    offers.list = [];
  });
});
