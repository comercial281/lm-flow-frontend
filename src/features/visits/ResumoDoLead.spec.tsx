import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { LeadSummary } from '@/services/visits/visitsService';
import { ResumoDoLead } from './ResumoDoLead';

const HA_2H = new Date(Date.now() - 2 * 3600_000).toISOString();

function resumo(extra: Partial<LeadSummary> = {}): LeadSummary {
  return {
    contact: { id: 'ct-1', name: 'Mariana Souza', phone_number: '5511984123307' },
    card: { pipeline_name: 'Vendas', stage_name: 'Visita agendada', status: 'open', other_cards_count: 0 },
    origin_label: 'Anúncio · Formulário Jardim das Flores',
    owner: { id: 'u-1', name: 'Ana Paula' },
    labels: [{ title: 'MCMV', color: '#1f93ff' }, { title: 'Primeiro imóvel', color: '#ff0000' }],
    last_message: { author_kind: 'lead', author_name: 'Mariana Souza', content: 'Sábado de manhã fica melhor pra mim', created_at: HA_2H },
    conversation_id: 'conv-9',
    ia: {
      summary: 'Quer apartamento de 2 quartos perto do metrô.',
      fields: [{ label: 'Renda', value: 'R$ 4.800' }],
      checklist: [{ question: 'Tem FGTS?', answer: 'Sim', required: true }],
    },
    previous_visits_count: 0,
    lead_created_at: '2026-10-01T12:00:00Z',
    card_entered_at: '2026-10-12T12:00:00Z',
    ...extra,
  };
}

const montar = (r: LeadSummary, completo = false) =>
  render(<MemoryRouter><ResumoDoLead resumo={r} completo={completo} /></MemoryRouter>);

describe('ResumoDoLead', () => {
  it('mostra nome, telefone formatado, funil › etapa e a origem', () => {
    montar(resumo());
    expect(screen.getByText('Mariana Souza')).toBeInTheDocument();
    expect(screen.getByText('(11) 98412-3307')).toBeInTheDocument();
    const funil = screen.getByTestId('funil-do-lead');
    expect(funil).toHaveTextContent('Vendas›Visita agendada');
    expect(screen.getByText('Anúncio · Formulário Jardim das Flores')).toBeInTheDocument();
    expect(screen.getByText('Ana Paula')).toBeInTheDocument();
    expect(screen.getByText('Primeira visita')).toBeInTheDocument();
    expect(screen.getByText('MCMV')).toBeInTheDocument();
  });

  it('sem card some a linha do funil', () => {
    montar(resumo({ card: null, card_entered_at: null }));
    expect(screen.queryByTestId('funil-do-lead')).toBeNull();
    expect(screen.queryByText('No funil desde')).toBeNull();
  });

  it('card ganho ou perdido diz a situação em português', () => {
    const { unmount } = montar(resumo({ card: { pipeline_name: 'Vendas', stage_name: 'Fechado', status: 'won', other_cards_count: 2 } }));
    expect(screen.getByTestId('funil-do-lead')).toHaveTextContent('Ganho');
    expect(screen.getByText('Mais 2 cards deste lead')).toBeInTheDocument();
    unmount();
    montar(resumo({ card: { pipeline_name: 'Vendas', stage_name: 'Fechado', status: 'lost', other_cards_count: 0 } }));
    expect(screen.getByTestId('funil-do-lead')).toHaveTextContent('Perdido');
    expect(screen.queryByText(/won|lost|open/)).toBeNull();
  });

  it('visitas anteriores contam as antes desta', () => {
    montar(resumo({ previous_visits_count: 2 }));
    expect(screen.getByText('2 antes desta')).toBeInTheDocument();
  });

  it('última mensagem do lead aparece com o nome dele', () => {
    montar(resumo());
    expect(screen.getByText(/Última mensagem · Mariana Souza/)).toBeInTheDocument();
    expect(screen.getByText('há 2 h')).toBeInTheDocument();
    expect(screen.getByText('Sábado de manhã fica melhor pra mim')).toBeInTheDocument();
  });

  it('última mensagem da IA aparece como IA Vendedora', () => {
    montar(resumo({ last_message: { author_kind: 'ia', author_name: null, content: 'Te espero terça.', created_at: HA_2H } }));
    expect(screen.getByText(/Última mensagem · IA Vendedora/)).toBeInTheDocument();
    expect(screen.queryByText(/\bia\b/)).toBeNull();
  });

  it('automação e pessoa do time têm nome de gente', () => {
    const { unmount } = montar(resumo({ last_message: { author_kind: 'automacao', author_name: null, content: 'Oi', created_at: HA_2H } }));
    expect(screen.getByText(/Última mensagem · Automação/)).toBeInTheDocument();
    unmount();
    const r2 = montar(resumo({ last_message: { author_kind: 'pessoa', author_name: 'Bruno', content: 'Oi', created_at: HA_2H } }));
    expect(screen.getByText(/Última mensagem · Bruno/)).toBeInTheDocument();
    r2.unmount();
    montar(resumo({ last_message: { author_kind: 'pessoa', author_name: null, content: 'Oi', created_at: HA_2H } }));
    expect(screen.getByText(/Última mensagem · Alguém do time/)).toBeInTheDocument();
  });

  it('sem conversa some a última mensagem', () => {
    montar(resumo({ last_message: null }));
    expect(screen.queryByText(/Última mensagem/)).toBeNull();
  });

  it('compacto não mostra respostas da IA nem botões', () => {
    montar(resumo());
    expect(screen.queryByText('Respostas da IA')).toBeNull();
    expect(screen.queryByText('R$ 4.800')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('completo mostra as respostas da IA, o resumo da IA e os botões', () => {
    montar(resumo(), true);
    expect(screen.getByText('Respostas da IA')).toBeInTheDocument();
    expect(screen.getByText('Renda')).toBeInTheDocument();
    expect(screen.getByText('R$ 4.800')).toBeInTheDocument();
    expect(screen.getByText('Tem FGTS?')).toBeInTheDocument();
    expect(screen.getByText('Sim')).toBeInTheDocument();
    expect(screen.getByText('Quer apartamento de 2 quartos perto do metrô.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir conversa' })).toHaveAttribute('href', '/conversations/conv-9');
    expect(screen.getByRole('link', { name: 'Abrir card do lead' })).toHaveAttribute('href', '/contacts/ct-1');
  });

  it('sem IA some o bloco das respostas e o resumo', () => {
    montar(resumo({ ia: null }), true);
    expect(screen.queryByText('Respostas da IA')).toBeNull();
    expect(screen.queryByText('Resumo da IA')).toBeNull();
  });

  it('sem conversa some o Abrir conversa', () => {
    montar(resumo({ conversation_id: null, last_message: null }), true);
    expect(screen.queryByRole('link', { name: 'Abrir conversa' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Abrir card do lead' })).toBeInTheDocument();
  });

  it('nenhum texto tem travessão', () => {
    const cheio = montar(resumo(), true);
    expect(cheio.container.textContent).not.toMatch(/[—–]/);
    cheio.unmount();
    // Tudo vazio ou com data ruim: nada de "—" no lugar.
    const vazio = montar({
      contact: null, card: null, origin_label: null, owner: null, labels: [],
      last_message: { author_kind: 'lead', author_name: null, content: null, created_at: 'lixo' },
      conversation_id: null, ia: { summary: null, fields: [], checklist: [] },
      previous_visits_count: null, lead_created_at: 'lixo', card_entered_at: 'lixo',
    }, true);
    expect(vazio.container.textContent).not.toMatch(/[—–]/);
  });
});
