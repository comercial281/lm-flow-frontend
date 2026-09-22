import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import OfferAiBriefing from './OfferAiBriefing';
import type { OfferAiBriefing as Briefing } from '@/services/roletaConfig/brokerAssignmentsService';

// A tela de aceite é onde o corretor DECIDE assumir o lead, e mostrava nome,
// telefone e prazo. Tudo o que a IA levantou só existia na lateral da conversa,
// que ele alcança depois de aceitar — então ele perguntava tudo de novo ao lead.
//
// O que este spec trava: não desenhar nada quando o lead não passou pela IA (a
// maioria dos leads da roleta), e nunca desenhar cabeçalho sem conteúdo.
describe('OfferAiBriefing', () => {
  const cheio: Briefing = {
    temperature: 'hot',
    temperature_label: 'Quente',
    stage_label: 'Pronto para visitar',
    intent_label: 'Procurando imóvel',
    sentiment_label: null,
    fields: [
      { key: 'orcamento', label: 'Orçamento', value: 'até 450 mil' },
      { key: 'regiao', label: 'Região', value: 'Centro' },
    ],
    checklist: [{ question: 'Faixa de orçamento', answer: 'até 450 mil', required: true }],
    summary: 'Quer sair do aluguel.',
    handoff_reason: null,
  };

  it('mostra a ficha completa que a IA levantou', () => {
    render(<OfferAiBriefing briefing={cheio} />);

    expect(screen.getByText('O que a IA já descobriu')).toBeInTheDocument();
    expect(screen.getByText('Quente')).toBeInTheDocument();
    expect(screen.getByText('Pronto para visitar')).toBeInTheDocument();
    expect(screen.getByText('Região')).toBeInTheDocument();
    expect(screen.getByText('Quer sair do aluguel.')).toBeInTheDocument();
    // As perguntas obrigatórias da imobiliária ficavam gravadas e não apareciam
    // em tela nenhuma.
    expect(screen.getByText('Faixa de orçamento')).toBeInTheDocument();
  });

  // Lead de anúncio, formulário, portal e orgânico nunca falou com a IA — e o
  // servidor antigo não manda esse campo.
  it('não desenha nada sem resumo', () => {
    const { container } = render(<OfferAiBriefing briefing={null} />);
    expect(container).toBeEmptyDOMElement();

    const { container: semCampo } = render(<OfferAiBriefing />);
    expect(semCampo).toBeEmptyDOMElement();
  });

  // Cabeçalho sozinho parece tela quebrada.
  it('não desenha cabeçalho sem conteúdo nenhum', () => {
    const vazio: Briefing = {
      temperature: null, temperature_label: null, stage_label: null, intent_label: null,
      sentiment_label: null, fields: [], checklist: [], summary: null, handoff_reason: null,
    };
    const { container } = render(<OfferAiBriefing briefing={vazio} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('aguenta listas ausentes vindas de um servidor mais velho', () => {
    const parcial = { temperature_label: 'Morno', temperature: 'warm' } as unknown as Briefing;
    expect(() => render(<OfferAiBriefing briefing={parcial} />)).not.toThrow();
    expect(screen.getByText('Morno')).toBeInTheDocument();
  });
});
