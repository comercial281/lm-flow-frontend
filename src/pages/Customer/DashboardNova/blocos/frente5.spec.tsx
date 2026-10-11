// src/pages/Customer/DashboardNova/blocos/frente5.spec.tsx
// Painel, frente 5 da Nova 27 (11/10/2026): fases dos imóveis, Lista/Funil,
// relógio do funil e o cartão de tempo médio de negociação.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navegar = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async orig => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navegar }));

import { Imoveis } from './Imoveis';
import { Funil } from './Funil';
import { TempoNegociacao } from './TempoNegociacao';
import { tempoEmDias } from './comum';
import type { ContextoBloco } from '../usePodeAbrir';

const pode = { imoveis: true, agenda: true, propostas: true, funil: true, roleta: true, conversas: true };
const periodo = { preset: 'last_7_days', since: '2026-09-24T00:00:00-03:00', until: '2026-09-30T23:59:59-03:00', granularity: 'day', days: 7, previous: { since: '', until: '' } };
const escopo = { mode: 'all', locked: false, available_modes: ['all'], blocks: { media_spend: false, operations: false } };
const DIA = 86400;

function ctx(over: Partial<ContextoBloco> = {}, dados: Record<string, unknown> = {}): ContextoBloco {
  return {
    dados: { period: periodo, scope: escopo, ...dados } as never,
    carregando: false, visao: 'gestor', pode, filtros: { preset: 'last_7_days' },
    funil: { dados: null, carregando: false, pendente: false, erro: null, recarregar: vi.fn() }, abrirLista: vi.fn(), mudarFunil: vi.fn(), ...over,
  };
}

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  navegar.mockReset();
  try { window.localStorage.clear(); } catch { /* sem armazenamento */ }
});

describe('tempoEmDias', () => {
  it('fala como gente: horas abaixo de um dia, dias arredondados', () => {
    expect(tempoEmDias(600)).toBe('menos de 1 h');
    expect(tempoEmDias(5 * 3600 + 100)).toBe('5 h');
    expect(tempoEmDias(DIA)).toBe('1 dia');
    expect(tempoEmDias(17.6 * DIA)).toBe('18 dias');
  });
});

describe('Imóveis por fase', () => {
  const base = { active: 40, new: 0, exclusive: 0, on_sign: 0, without_photos: 0, off_site: 0, stale: 0, stale_after_days: 60 };

  it('mostra na planta, em obra e prontos, e cada um abre Empreendimentos filtrado', () => {
    wrap(<Imoveis {...ctx({}, { properties: { ...base, phases: { plan: 4, construction: 2, ready: 7 } } })} />);
    expect(screen.getByRole('group', { name: 'Empreendimentos por fase' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Na planta/ }));
    expect(navegar).toHaveBeenLastCalledWith('/properties?aba=empreendimentos&recorte=na_planta');
    fireEvent.click(screen.getByRole('button', { name: /Em obra/ }));
    expect(navegar).toHaveBeenLastCalledWith('/properties?aba=empreendimentos&recorte=em_obra');
  });

  it('sem empreendimento nenhum (ou servidor antigo), a linha não aparece', () => {
    const { unmount } = wrap(<Imoveis {...ctx({}, { properties: { ...base, phases: { plan: 0, construction: 0, ready: 0 } } })} />);
    expect(screen.queryByRole('group', { name: 'Empreendimentos por fase' })).not.toBeInTheDocument();
    unmount();
    wrap(<Imoveis {...ctx({}, { properties: base })} />);
    expect(screen.queryByText('Na planta')).not.toBeInTheDocument();
  });
});

describe('Funil: Lista, desenho e relógio', () => {
  const pipeline = {
    pipeline: { id: 'p1', name: 'Vendas' },
    pipelines: [{ id: 'p1', name: 'Vendas' }],
    outcomes: { won: 3, lost: 5 },
    stages: [
      { id: 's1', name: 'Novo Lead', color: '#000', position: 1, entered: 10, current: 12, avg_seconds_in_stage: 2 * DIA },
      { id: 's2', name: 'Atendimento', color: '#000', position: 2, entered: 5, current: 20, avg_seconds_in_stage: 6 * DIA },
      { id: 's3', name: 'Proposta', color: '#000', position: 3, entered: 1, current: 0, avg_seconds_in_stage: null },
    ],
  };
  const comFunil = (over: Partial<ContextoBloco> = {}) =>
    ctx({ funil: { dados: { period: periodo, scope: escopo, pipeline } as never, carregando: false, pendente: false, erro: null, recarregar: vi.fn() }, ...over });

  it('abre na Lista, troca pro desenho e lembra a escolha', () => {
    const { unmount } = wrap(<Funil {...comFunil()} />);
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Funil' }));
    expect(screen.getByRole('button', { name: 'Funil' })).toHaveAttribute('aria-pressed', 'true');
    // No desenho, a faixa continua abrindo o quadro na etapa.
    fireEvent.click(screen.getByRole('button', { name: /Atendimento/ }));
    expect(navegar).toHaveBeenLastCalledWith('/pipelines/p1?etapa=s2');
    unmount();
    wrap(<Funil {...comFunil()} />);
    expect(screen.getByRole('button', { name: 'Funil' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('o relógio troca a contagem pelo tempo parado na etapa', () => {
    wrap(<Funil {...comFunil()} />);
    expect(screen.getByText('20')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tempo médio em cada etapa' }));
    expect(screen.getByText('~6 dias')).toBeInTheDocument();
    expect(screen.getByText('~2 dias')).toBeInTheDocument();
    expect(screen.queryByText('20')).not.toBeInTheDocument();
    expect(screen.getByText(/Há quanto tempo, em média/)).toBeInTheDocument();
    // Ganhos e Perdidos continuam embaixo.
    expect(screen.getByText('Ganhos no período')).toBeInTheDocument();
  });

  it('servidor antigo (sem o tempo por etapa): sem relógio', () => {
    const antigo = { ...pipeline, stages: pipeline.stages.map(({ avg_seconds_in_stage: _x, ...s }) => s) };
    wrap(<Funil {...ctx({ funil: { dados: { period: periodo, scope: escopo, pipeline: antigo } as never, carregando: false, pendente: false, erro: null, recarregar: vi.fn() } })} />);
    expect(screen.queryByRole('button', { name: 'Tempo médio em cada etapa' })).not.toBeInTheDocument();
  });
});

describe('Tempo médio de negociação', () => {
  it('mostra um número por vez: Ganhos primeiro, Perdidos na troca', () => {
    wrap(<TempoNegociacao {...ctx({}, { negotiation_time: { won: { count: 12, avg_seconds: 18 * DIA }, lost: { count: 1, avg_seconds: 9 * DIA } } })} />);
    expect(screen.getByRole('button', { name: 'Ganhos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('18 dias')).toBeInTheDocument();
    expect(screen.getByText('da criação do card até o ganho · 12 ganhos')).toBeInTheDocument();
    expect(screen.queryByText('9 dias')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Perdidos' }));
    expect(screen.getByText('9 dias')).toBeInTheDocument();
    expect(screen.getByText('da criação do card até a perda · 1 perdido')).toBeInTheDocument();
  });

  it('sem nenhum fechado, traço no lugar do tempo', () => {
    wrap(<TempoNegociacao {...ctx({}, { negotiation_time: { won: { count: 0, avg_seconds: null }, lost: { count: 0, avg_seconds: null } } })} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('o corretor não recebe a chave: o cartão não existe', () => {
    const { container } = wrap(<TempoNegociacao {...ctx({ visao: 'corretor' })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
