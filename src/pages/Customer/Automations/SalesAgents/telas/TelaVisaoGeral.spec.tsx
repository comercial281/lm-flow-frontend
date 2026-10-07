import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const performance = vi.hoisted(() => vi.fn());
const listSuggestions = vi.hoisted(() => vi.fn());
const applySuggestion = vi.hoisted(() => vi.fn());
const runs = vi.hoisted(() => vi.fn().mockResolvedValue({ runs: [], totals: {} }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({
  salesAgentsService: { performance, listSuggestions, applySuggestion, runs, dismissSuggestion: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TelaVisaoGeral, { type TelaVisaoGeralProps } from './TelaVisaoGeral';
import type { SalesAgent, SalesAgentSuggestion } from '@/services/salesAgents/salesAgentsService';

const agente = { id: 'ia-1', name: 'IA de Vendas', enabled: true, inbox_id: 'inbox-1', triggers: [], trigger_keyword: null, trigger_match_mode: 'any' } as unknown as SalesAgent;

const sugestao = (id: string, status: 'pending' | 'applied' = 'pending') => ({
  id, status, target: 'ia', category: 'objecao', category_label: 'Objeção', title: `Sugestão ${id}`, body: null,
  evidence: {}, appliable: true, lesson_kind: 'rule', lesson_content: 'Responda o preço', applied_lesson_id: null, batch_id: 'b', created_at: '2026-10-05',
}) as SalesAgentSuggestion;

function abrir(extra: Partial<TelaVisaoGeralProps> = {}) {
  const props: TelaVisaoGeralProps = {
    agent: agente, situacao: { tipo: 'atendendo', frase: 'Atendendo' }, diagnostico: { status: 'ok', items: [] },
    conferindo: false, falhou: false, mostrarSugestoes: true, equipe: false, aoIr: vi.fn(), ...extra,
  };
  render(<TelaVisaoGeral {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
  performance.mockResolvedValue(null);
  listSuggestions.mockResolvedValue({ suggestions: [], lessons_active: 0, lessons_cap: 12, last_analysis_at: null, last_analysis_cost_usd: 0, auto: { auto: false, weekday: 1, hour: 9 } });
});

describe('Painel → Visão geral', () => {
  it('cada pendência tem "Corrigir", que leva pra tela certa', async () => {
    const props = abrir({
      diagnostico: { status: 'warning', items: [{ key: 'knowledge', label: 'Base de conhecimento', status: 'warning', detail: 'Nenhum documento pronto.' }] },
    });
    expect(screen.getByText('Nenhum documento pronto.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Corrigir' }));
    expect(props.aoIr).toHaveBeenCalledWith('ensinar');
  });

  it('o "Corrigir" de uma página do Configurar leva à página (onda 3)', async () => {
    const props = abrir({
      agent: { ...agente, inbox_id: null, lead_facing_name: 'Ana' } as unknown as SalesAgent,
      situacao: { tipo: 'parada', frase: 'Parada: falta o número' }, diagnostico: null,
    });
    const item = screen.getByText(/Nenhum número escolhido/).closest('li')!;
    await userEvent.click(within(item).getByRole('button', { name: 'Corrigir' }));
    expect(props.aoIr).toHaveBeenCalledWith('configurar', 'canal');
  });

  it('WhatsApp desconectado: o "Corrigir" abre a configuração do número, onde se religa', () => {
    const props: TelaVisaoGeralProps = {
      agent: agente, situacao: { tipo: 'parada', frase: 'Parada: o WhatsApp do número está desconectado' },
      diagnostico: { status: 'error', items: [{ key: 'credentials', label: 'WhatsApp', status: 'error', detail: 'Desconectado.' }] },
      conferindo: false, falhou: false, mostrarSugestoes: false, equipe: false, aoIr: vi.fn(),
    };
    render(<MemoryRouter><TelaVisaoGeral {...props} /></MemoryRouter>);
    const item = screen.getByText('Desconectado.').closest('li')!;
    expect(within(item).getByRole('link', { name: 'Corrigir' })).toHaveAttribute('href', '/channels/inbox-1/settings?tab=configuration');
  });

  it('sem pendência: "Nada pendente"; enquanto confere, não promete nada', () => {
    abrir();
    expect(screen.getByText(/Nada pendente/)).toBeInTheDocument();
  });

  it('Diagnóstico que falhou: não afirma "Nada pendente", diz que não conseguiu conferir', () => {
    abrir({ diagnostico: null, falhou: true });
    expect(screen.getByText(/Não consegui conferir a situação desta IA agora/)).toBeInTheDocument();
    expect(screen.queryByText(/Nada pendente/)).toBeNull();
  });

  it('Diagnóstico que falhou: as pendências da própria configuração continuam aparecendo', () => {
    abrir({ diagnostico: null, falhou: true, agent: { ...agente, inbox_id: null } as SalesAgent });
    expect(screen.getByText('Número de WhatsApp')).toBeInTheDocument();
    expect(screen.queryByText(/Nada pendente/)).toBeNull();
  });

  it('enquanto o Diagnóstico não chega, diz que está conferindo', () => {
    abrir({ diagnostico: null, conferindo: true });
    expect(screen.getByText(/Conferindo a situação/)).toBeInTheDocument();
    expect(screen.queryByText(/Nada pendente/)).toBeNull();
  });

  // Checklist §6 (aba Resultados): o zero não dizia o motivo.
  it('parada e sem números: o motivo no lugar do "sem atendimento"', async () => {
    abrir({ situacao: { tipo: 'parada', frase: 'Parada: falta o número' } });
    expect(await screen.findByText(/Motivo: falta o número\./)).toBeInTheDocument();
  });

  it('mostra até 3 sugestões esperando resposta e "Ver todas" leva pra Sugestões', async () => {
    listSuggestions.mockResolvedValue({
      suggestions: [sugestao('a'), sugestao('b'), sugestao('c'), sugestao('d'), sugestao('e', 'applied')],
      lessons_active: 0, lessons_cap: 12, last_analysis_at: null, last_analysis_cost_usd: 0, auto: { auto: false, weekday: 1, hour: 9 },
    });
    const props = abrir();
    expect(await screen.findByText('4 sugestões esperando você')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Aplicar/ })).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    expect(props.aoIr).toHaveBeenCalledWith('sugestoes');
  });

  it('Aplicar transforma em lição e relê a lista', async () => {
    listSuggestions.mockResolvedValueOnce({
      suggestions: [sugestao('a')], lessons_active: 0, lessons_cap: 12, last_analysis_at: null, last_analysis_cost_usd: 0, auto: { auto: false, weekday: 1, hour: 9 },
    });
    applySuggestion.mockResolvedValue({});
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: /Aplicar/ }));
    expect(applySuggestion).toHaveBeenCalledWith('ia-1', 'a');
    await waitFor(() => expect(listSuggestions).toHaveBeenCalledTimes(2));
  });

  it('sem a chave de sugestões, nem pergunta ao servidor', () => {
    abrir({ mostrarSugestoes: false });
    expect(listSuggestions).not.toHaveBeenCalled();
  });
});
