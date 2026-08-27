import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BlockRenderer } from './BlockRenderer';
import { createBlock } from './registry';
import { parsePageBlocks } from './contract';
import { BR_PHONE_PLACEHOLDER } from '@/lib/brPhone';
import type { LandingProperty } from './render-types';

const property: LandingProperty = {
  code: 'AP-001',
  title: 'The White Palace',
  stage: 'pre_launch',
  salePrice: 800000,
  bedrooms: 3,
  parkingSpaces: 2,
  usefulAreaM2: 95,
  city: 'Porto Belo',
  neighborhood: 'Perequê',
  state: 'SC',
  photos: [{ url: 'https://x/cover.jpg', isCover: true }],
};

describe('BlockRenderer', () => {
  it('renders hero with auto-filled property data and stage badge', () => {
    render(<BlockRenderer blocks={[createBlock('hero')]} property={property} />);
    expect(screen.getByText('The White Palace')).toBeInTheDocument();
    expect(screen.getByText('PRÉ LANÇAMENTO')).toBeInTheDocument();
  });

  it('renders tech sheet values from the property', () => {
    render(<BlockRenderer blocks={[createBlock('tech_sheet')]} property={property} />);
    expect(screen.getByText('Ficha Técnica')).toBeInTheDocument();
    expect(screen.getByText('Dormitórios')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('95 m²')).toBeInTheDocument();
  });

  it('finance simulator computes a monthly value from sale price', () => {
    render(<BlockRenderer blocks={[createBlock('finance_simulator')]} property={property} />);
    // O título do bloco virou "Plano de Pagamento" quando ele ganhou a barra
    // segmentada; o teste ficou para trás e essa era a única falha da suíte.
    expect(screen.getByText('Plano de Pagamento')).toBeInTheDocument();
    // base 800k, entrada 10% default -> entrada 80.000
    expect(screen.getByText('R$ 80.000')).toBeInTheDocument();
  });

  it('hidden blocks are not rendered by default', () => {
    const block = { ...createBlock('price_band'), visible: false };
    block.config.text = 'NAO DEVE APARECER';
    render(<BlockRenderer blocks={[block]} property={property} />);
    expect(screen.queryByText('NAO DEVE APARECER')).not.toBeInTheDocument();
  });

  /* ---- formulário de lead: lógica condicional ---- */

  /** Formulário de duas perguntas: a primeira resposta PULA a segunda e vai
   *  direto pro contato; a segunda encerra na tela de desqualificado. */
  const conditionalForm = () =>
    parsePageBlocks([
      {
        id: 'f',
        type: 'lead_form',
        config: {
          steps: [
            {
              id: 'q1',
              question: 'Qual seu orçamento?',
              options: [
                { id: 'o-alto', text: 'Acima de 1 milhão', weight: 10, next: { kind: 'contact' } },
                { id: 'o-baixo', text: 'Até 100 mil', next: { kind: 'finish', screen: 'disqualified' } },
              ],
            },
            { id: 'q2', question: 'Quando pretende comprar?', options: [{ id: 'o-agora', text: 'Este mês' }] },
          ],
          disqualifiedTitle: 'Obrigado pelo interesse!',
        },
      },
    ]);

  /** O campo de telefone tem máscara e escuta `input` (não `change`), então
   *  o teste precisa disparar o evento que o campo realmente ouve. */
  const preencherContato = async () => {
    fireEvent.change(screen.getByPlaceholderText('Seu nome *'), { target: { value: 'Fulano' } });
    fireEvent.input(screen.getByPlaceholderText(BR_PHONE_PLACEHOLDER), {
      target: { value: '(11) 99999-0000' },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Falar com Especialista|Tentar de novo/ })).toBeEnabled(),
    );
  };

  it('a resposta que manda pro contato pula a pergunta seguinte', () => {
    render(<BlockRenderer blocks={conditionalForm()} property={property} />);
    fireEvent.click(screen.getByRole('button', { name: 'Acima de 1 milhão' }));
    expect(screen.getByText('Tenho interesse')).toBeInTheDocument();
    expect(screen.queryByText('Quando pretende comprar?')).not.toBeInTheDocument();
  });

  it('a resposta que encerra leva à tela de desqualificado', async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({ qualification: 'qualified' });
    render(<BlockRenderer blocks={conditionalForm()} property={property} onSubmitLead={onSubmitLead} />);
    fireEvent.click(screen.getByRole('button', { name: 'Até 100 mil' }));
    await preencherContato();
    fireEvent.click(screen.getByRole('button', { name: /Falar com Especialista/ }));

    // Mesmo com o servidor dizendo "qualificado", o caminho escolhido manda:
    // foi o desvio da resposta que encerrou o formulário ali.
    await waitFor(() => expect(screen.getByText('Obrigado pelo interesse!')).toBeInTheDocument());
  });

  it('manda o id da resposta junto do texto, para o servidor achar peso e destino', async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({ qualification: 'qualified' });
    render(<BlockRenderer blocks={conditionalForm()} property={property} onSubmitLead={onSubmitLead} />);
    fireEvent.click(screen.getByRole('button', { name: 'Acima de 1 milhão' }));
    await preencherContato();
    fireEvent.click(screen.getByRole('button', { name: /Falar com Especialista/ }));

    await waitFor(() => expect(onSubmitLead).toHaveBeenCalled());
    expect(onSubmitLead.mock.calls[0][0].answers[0]).toMatchObject({
      answer: 'Acima de 1 milhão',
      optionId: 'o-alto',
      questionId: 'q1',
    });
  });

  it('envio que falha mostra erro em vez de agradecer', async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({ failed: true });
    render(<BlockRenderer blocks={conditionalForm()} property={property} onSubmitLead={onSubmitLead} />);
    fireEvent.click(screen.getByRole('button', { name: 'Acima de 1 milhão' }));
    await preencherContato();
    fireEvent.click(screen.getByRole('button', { name: /Falar com Especialista/ }));

    await waitFor(() => expect(screen.getByText(/Não conseguimos enviar seus dados/)).toBeInTheDocument());
    expect(screen.queryByText('Recebemos suas informações!')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar de novo/ })).toBeInTheDocument();
  });

  it('renders nothing-but-survives when a block has empty data', () => {
    render(<BlockRenderer blocks={[createBlock('amenities')]} property={property} />);
    // amenities with no items renders null; no crash
    expect(screen.queryByText('Infraestrutura')).not.toBeInTheDocument();
  });
});
