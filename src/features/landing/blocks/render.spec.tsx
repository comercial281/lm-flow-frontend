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

  /* ---- seções novas e textos configuráveis ---- */

  it('a seção de Texto publica o título e o texto escritos', () => {
    const blocks = parsePageBlocks([
      { id: 't', type: 'rich_text', config: { title: 'Por que investir aqui', html: '<p>Valorização de <strong>18%</strong> ao ano.</p>' } },
    ]);
    render(<BlockRenderer blocks={blocks} />);
    expect(screen.getByText('Por que investir aqui')).toBeInTheDocument();
    expect(screen.getByText(/Valorização de/)).toBeInTheDocument();
  });

  it('a galeria no modo manual mostra as fotos enviadas, sem imóvel nenhum', () => {
    const blocks = parsePageBlocks([
      {
        id: 'g',
        type: 'gallery',
        config: { source: 'manual', images: [{ url: 'https://x/1.jpg', caption: 'Fachada' }] },
      },
    ]);
    render(<BlockRenderer blocks={blocks} />);
    expect(screen.getByText('Fachada')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fachada' })).toHaveAttribute('src', 'https://x/1.jpg');
  });

  it('o mapa busca a REGIÃO, mesmo com rua e número no endereço', () => {
    const blocks = parsePageBlocks([
      {
        id: 'm',
        type: 'map',
        config: { address: 'Rua das Palmeiras, 320 — Centro', region: 'Centro, Porto Belo, SC' },
      },
    ]);
    render(<BlockRenderer blocks={blocks} />);
    // O endereço exato aparece como TEXTO...
    expect(screen.getByText(/Rua das Palmeiras, 320/)).toBeInTheDocument();
    // ...e o mapa aponta só para a região: é a decisão de privacidade que a
    // página de imóvel do site também toma.
    const src = screen.getByTitle('Mapa da região').getAttribute('src') ?? '';
    expect(src).toContain(encodeURIComponent('Centro, Porto Belo, SC'));
    expect(src).not.toContain('Palmeiras');
  });

  it('o simulador calcula com o valor digitado, sem imóvel vinculado', () => {
    const blocks = parsePageBlocks([
      { id: 's', type: 'finance_simulator', config: { basePrice: 500000, entradaPct: 20, title: 'Como pagar' } },
    ]);
    render(<BlockRenderer blocks={blocks} />);
    expect(screen.getByText('Como pagar')).toBeInTheDocument();
    expect(screen.getByText('R$ 100.000')).toBeInTheDocument();
  });

  it('o espaçamento escolhido na seção chega à página', () => {
    const blocks = parsePageBlocks([
      { id: 'p', type: 'price_band', config: { text: 'Entrada facilitada' }, layout: { top: 4, bottom: 60, sides: 0 } },
    ]);
    const { container } = render(<BlockRenderer blocks={blocks} />);
    const envelope = container.querySelector('[data-block-id="p"]') as HTMLElement;
    expect(envelope.style.getPropertyValue('--lp-pad-top')).toBe('4px');
    expect(envelope.style.getPropertyValue('--lp-pad-bottom')).toBe('60px');
    expect(envelope.style.getPropertyValue('--lp-pad-x')).toBe('0px');
  });

  it('a tela de obrigado usa o texto gravado, que antes era ignorado', async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({ qualification: 'qualified' });
    const blocks = parsePageBlocks([
      {
        id: 'f',
        type: 'lead_form',
        config: {
          steps: [],
          thankyouTitle: 'Deu certo!',
          thankyouMessage: 'O corretor {especialista} te chama hoje.',
          specialistName: 'Ana',
          interestedLabel: '',
        },
      },
    ]);
    render(<BlockRenderer blocks={blocks} onSubmitLead={onSubmitLead} />);
    await preencherContato();
    fireEvent.click(screen.getByRole('button', { name: /Falar com Especialista/ }));

    await waitFor(() => expect(screen.getByText('Deu certo!')).toBeInTheDocument());
    expect(screen.getByText('O corretor Ana te chama hoje.')).toBeInTheDocument();
    // O texto que vinha escrito por dentro do componente não aparece mais.
    expect(screen.queryByText('Recebemos suas informações!')).not.toBeInTheDocument();
  });

  it('renders nothing-but-survives when a block has empty data', () => {
    render(<BlockRenderer blocks={[createBlock('amenities')]} property={property} />);
    // amenities with no items renders null; no crash
    expect(screen.queryByText('Infraestrutura')).not.toBeInTheDocument();
  });
});
