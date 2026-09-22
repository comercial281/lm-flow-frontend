import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

  // ⚠️ O DEFEITO DA ESTREIA, relatado com print no celular: a pergunta e a
  // resposta ficavam lado a lado, a pergunta não encolhia, e a resposta era
  // espremida numa coluna de dois dedos — *2 quartos* saía quebrado em "2" /
  // "quartos", vazando para fora da borda do bloco.
  describe('largura: os dois lados são texto de fora, e o celular é o caso apertado', () => {
    const comprido: Briefing = {
      ...cheio,
      fields: [{ key: 'regiao', label: 'Região', value: 'Panamby, Ribeirão Preto' }],
      checklist: [{
        question: 'Se está procurando um imóvel para família, quantos quartos.',
        answer: '2 quartos',
        required: true,
      }],
    };

    it('empilha pergunta e resposta, nunca em duas colunas', () => {
      render(<OfferAiBriefing briefing={comprido} />);

      const pergunta = screen.getByText('Se está procurando um imóvel para família, quantos quartos.');
      const resposta = screen.getByText('2 quartos');

      // Lado a lado um sempre espreme o outro: são duas frases inteiras.
      expect(pergunta.parentElement?.className ?? '').not.toContain('justify-between');
      expect(pergunta.parentElement).toBe(resposta.parentElement);
      expect(pergunta.className).toContain('break-words');
      expect(resposta.className).toContain('break-words');
    });

    it('o rótulo tem TETO de largura, para o valor sempre sobrar mais da metade', () => {
      render(<OfferAiBriefing briefing={comprido} />);

      const rotulo = screen.getByText('Região');
      const valor = screen.getByText('Panamby, Ribeirão Preto');

      // Sem o teto, rótulo comprido come a linha e o valor vaza pela borda.
      expect(rotulo.className).toMatch(/max-w-/);
      expect(rotulo.className).toContain('break-words');
      expect(valor.className).toContain('min-w-0');
      expect(valor.className).toContain('break-words');
    });

    // `flex-shrink-0` sozinho no rótulo foi a causa exata do print: encolhimento
    // travado SEM teto de largura. A conferência lê o MARCADOR, nunca o comentário
    // — o cabeçalho deste componente cita a classe para explicar a cicatriz, e uma
    // busca no arquivo cru reprovaria a própria explicação.
    it('nenhum rótulo volta a travar a largura sem teto', () => {
      const fonte = readFileSync(resolve(__dirname, 'OfferAiBriefing.tsx'), 'utf8');
      const marcacao = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

      expect(marcacao).not.toContain('flex-shrink-0');
      // E o rótulo continua com teto: é ele que garante mais da metade ao valor.
      expect(marcacao).toContain('max-w-[45%] shrink-0');
    });
  });
});
