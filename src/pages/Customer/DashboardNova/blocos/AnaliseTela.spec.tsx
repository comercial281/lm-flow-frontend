// src/pages/Customer/DashboardNova/blocos/AnaliseTela.spec.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeadsDiaSemana, LeadsHorario, LeadsSeisMeses, Origem } from './Analise';
import type { ContextoBloco } from '../usePodeAbrir';

const pode = { imoveis: true, agenda: true, propostas: true, funil: true, roleta: true, conversas: true };

function ctx(dados: Record<string, unknown>): ContextoBloco {
  return {
    dados: { period: {}, scope: { mode: 'all' }, ...dados } as never,
    carregando: false, visao: 'gestor', pode, filtros: { preset: 'last_7_days' }, abrirLista: vi.fn(), mudarFunil: vi.fn(),
  };
}

describe('Análise do período na tela', () => {
  it('Origem: contatos captados pela primeira origem, com o total', () => {
    render(<Origem {...ctx({ sources: { total: 1234, items: [{ source: 'meta', label: 'Meta Ads', count: 1000, percent: 81 }] } })} />);
    expect(screen.getByText('Contatos captados no período, pela primeira origem')).toBeInTheDocument();
    expect(screen.getByText('1.234')).toBeInTheDocument();
    expect(screen.getByText('contatos captados no período')).toBeInTheDocument();
  });

  it('cada gráfico tem um resumo de uma linha para leitor de tela', () => {
    render(<LeadsDiaSemana {...ctx({ leads_by_weekday: { days: [{ day: 0, leads: 5 }, { day: 1, leads: 39 }] } })} />);
    expect(screen.getByRole('img', { name: 'Leads por dia da semana: Dom 5, Seg 39' })).toBeInTheDocument();

    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, leads: hour === 10 ? 3 : hour === 22 ? 1 : 0 }));
    render(<LeadsHorario {...ctx({ leads_by_hour: { hours } })} />);
    expect(screen.getByRole('img', { name: /^Leads por horário: mais leads às 10h \(3\); 25% fora do horário comercial$/ })).toBeInTheDocument();

    render(<LeadsSeisMeses {...ctx({ leads_6_months: { months: [{ month: '2026-08', leads: 12 }, { month: '2026-09', leads: 1500 }] } })} />);
    expect(screen.getByRole('img', { name: 'Leads nos últimos 6 meses: Ago 12, Set 1.500' })).toBeInTheDocument();
  });

  it('seis meses sem lead nenhum diz isso em vez de um gráfico zerado', () => {
    const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map(month => ({ month, leads: 0 }));
    render(<LeadsSeisMeses {...ctx({ leads_6_months: { months } })} />);
    expect(screen.getByText('Nenhum lead nos últimos 6 meses')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
