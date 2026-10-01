// src/pages/Customer/DashboardNova/blocos/blocosGestao.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navegar = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async orig => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navegar }));

import { ProximasVisitas } from './ProximasVisitas';
import { Funil } from './Funil';
import { Resultados } from './Resultados';
import { AtendimentoTime, motivoAtencao, precisaAtencao } from './AtendimentoTime';
import type { ContextoBloco } from '../usePodeAbrir';

const pode = { imoveis: true, agenda: true, propostas: true, funil: true, roleta: true, conversas: true };
const ctx = (dados: Record<string, unknown>, over: Partial<ContextoBloco> = {}): ContextoBloco => ({
  dados: { period: { since: '2026-09-24T00:00:00-03:00', until: '2026-09-30T23:59:59-03:00' }, scope: { mode: 'all' }, ...dados } as never,
  carregando: false, visao: 'gestor', pode, abrirLista: vi.fn(), mudarFunil: vi.fn(), ...over,
});
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  navegar.mockReset();
});

const visita = { id: 'v1', scheduled_at: '2026-10-01T13:00:00Z', status: 'scheduled', confirmed: false, contact_name: 'Fulano', realtor_name: 'Ana' };

describe('Próximas visitas', () => {
  it('cada visita abre a Agenda com ela', () => {
    wrap(<ProximasVisitas {...ctx({ upcoming: { items: [visita] } })} />);
    fireEvent.click(screen.getByRole('button', { name: /Fulano/ }));
    expect(navegar).toHaveBeenCalledWith('/visits?visita=v1');
    expect(screen.getByText('A confirmar')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('o corretor não vê o nome do corretor', () => {
    wrap(<ProximasVisitas {...ctx({ upcoming: { items: [visita] } }, { visao: 'corretor' })} />);
    expect(screen.getByText('Suas próximas visitas')).toBeInTheDocument();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
  });

  it('mostra o imóvel da visita quando vem', () => {
    wrap(<ProximasVisitas {...ctx({ upcoming: { items: [{ ...visita, property_title: 'Casa Teste' }] } })} />);
    expect(screen.getByText('Casa Teste · Ana')).toBeInTheDocument();
    expect(screen.getByText('As próximas, até 14 dias')).toBeInTheDocument();
  });

  it('sem o imóvel (servidor antigo ou visita sem imóvel), mostra só o corretor', () => {
    wrap(<ProximasVisitas {...ctx({ upcoming: { items: [{ ...visita, property_title: null }] } })} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('sem acesso à Agenda, a visita não é clicável', () => {
    wrap(<ProximasVisitas {...ctx({ upcoming: { items: [visita] } }, { pode: { ...pode, agenda: false } })} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Fulano')).toBeInTheDocument();
  });
});

describe('Funil', () => {
  const pipeline = {
    pipeline: { id: 'p1', name: 'Vendas' },
    pipelines: [{ id: 'p1', name: 'Vendas' }, { id: 'p2', name: 'Locação' }],
    stages: [{ id: 'e1', name: 'Novo', color: '#000', position: 1, entered: 3, current: 48 }],
  };

  it('clicar na etapa abre o funil nela', () => {
    wrap(<Funil {...ctx({ pipeline })} />);
    fireEvent.click(screen.getByRole('button', { name: /Novo/ }));
    expect(navegar).toHaveBeenCalledWith('/pipelines/p1?etapa=e1');
  });

  it('o seletor troca o funil', () => {
    const c = ctx({ pipeline });
    wrap(<Funil {...c} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Funil' }), { target: { value: 'p2' } });
    expect(c.mudarFunil).toHaveBeenCalledWith('p2');
  });
});

describe('Funil sem dado', () => {
  it('sem funil ativo, diz isso em vez de erro', () => {
    wrap(<Funil {...ctx({ pipeline: { available: false, reason: 'no_pipeline' } })} />);
    expect(screen.getByText('Nenhum funil ativo encontrado.')).toBeInTheDocument();
  });

  it('com erro, diz que não deu para carregar', () => {
    wrap(<Funil {...ctx({ pipeline: { available: false, reason: 'error' } })} />);
    expect(screen.getByText('Não deu para carregar o funil agora.')).toBeInTheDocument();
  });

  it('funil sem etapas', () => {
    wrap(<Funil {...ctx({ pipeline: { pipeline: { id: 'p1', name: 'Vendas' }, pipelines: [{ id: 'p1', name: 'Vendas' }], stages: [] } })} />);
    expect(screen.getByText('Este funil ainda não tem etapas.')).toBeInTheDocument();
  });
});

describe('Resultados', () => {
  it('visitas boas de realizadas', () => {
    wrap(<Resultados {...ctx({ results: { sales: 3, vgv: 2100000, ticket: 700000, leads: 195, lead_to_sale_percent: 1.5, visits_done: 18, good_visits: 11 } })} />);
    expect(screen.getByText('11 visitas boas de 18 realizadas')).toBeInTheDocument();
  });

  it('ticket zerado mostra o traço, não R$ 0', () => {
    wrap(<Resultados {...ctx({ results: { sales: 2, vgv: 0, ticket: 0, leads: 10, lead_to_sale_percent: 20, visits_done: 0, good_visits: 0 } })} />);
    const rotulo = screen.getByText('Ticket médio');
    expect(rotulo.nextElementSibling).toHaveTextContent('—');
  });

  it('não aparece quando o servidor não manda (corretor)', () => {
    const { container } = wrap(<Resultados {...ctx({})} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Atendimento do time', () => {
  const total = {
    median_seconds: 360, previous_median_seconds: 480, waited_over_hour: 9,
    ai_median_seconds: 12, ai_samples: 5,
    visits_done: 13, visits_with_feedback: 8, feedback_percent: 62,
  };

  it('marca quem demora ou não dá feedback', () => {
    expect(precisaAtencao({ user_id: 'a', name: 'Ana', median_seconds: 240, samples: 5, waited_over_hour: 0, visits_done: 5, visits_with_feedback: 5 })).toBe(false);
    expect(precisaAtencao({ user_id: 'd', name: 'Diego', median_seconds: 1140, samples: 5, waited_over_hour: 3, visits_done: 6, visits_with_feedback: 5 })).toBe(true);
    expect(precisaAtencao({ user_id: 'b', name: 'Bruno', median_seconds: 120, samples: 5, waited_over_hour: 0, visits_done: 6, visits_with_feedback: 1 })).toBe(true);
  });

  it('mostra o % de feedback da imobiliária e a IA', () => {
    wrap(<AtendimentoTime {...ctx({ team: { total, people: [] } })} />);
    expect(screen.getByText('62% das visitas do período tiveram feedback')).toBeInTheDocument();
    expect(screen.getByText('1ª resposta da IA Vendedora')).toBeInTheDocument();
  });

  it('sem IA no período, a linha da IA não aparece', () => {
    wrap(<AtendimentoTime {...ctx({ team: { total: { ...total, ai_median_seconds: null, ai_samples: 0 }, people: [] } })} />);
    expect(screen.queryByText('1ª resposta da IA Vendedora')).not.toBeInTheDocument();
  });

  it('a marca diz por que o corretor precisa de atenção', () => {
    const bruno = { user_id: 'b', name: 'Bruno', median_seconds: 120, samples: 5, waited_over_hour: 0, visits_done: 6, visits_with_feedback: 1 };
    wrap(<AtendimentoTime {...ctx({ team: { total, people: [bruno] } })} />);
    const motivo = motivoAtencao(bruno);
    expect(motivo).toBe('Deu feedback em menos da metade das visitas');
    expect(screen.getByRole('img', { name: `Precisa de atenção: ${motivo}` })).toBeInTheDocument();
  });

  it('não aparece quando o servidor não manda (corretor)', () => {
    const { container } = wrap(<AtendimentoTime {...ctx({})} />);
    expect(container).toBeEmptyDOMElement();
  });
});
