import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BlockRenderer } from './BlockRenderer';
import { createBlock, defaultLandingBlocks } from './registry';
import { formularioDaCapa } from './formularioDaCapa';
import type { BlockInstance } from './contract';
import { parsePageBlocks } from './contract';
import { BR_PHONE_PLACEHOLDER } from '@/lib/brPhone';
import { ehLocacao, type LandingProperty } from './render-types';

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

  // A capa é o LCP da landing: sai com prioridade alta e prefere a versão
  // redimensionada que o servidor manda; sem ela, a original.
  it('hero usa a capa redimensionada quando o servidor manda, com prioridade alta', () => {
    const withHero: LandingProperty = {
      ...property,
      photos: [{ url: 'https://x/original.jpg', heroUrl: 'https://x/hero.jpg', isCover: true }],
    };
    const { container, rerender } = render(<BlockRenderer blocks={[createBlock('hero')]} property={withHero} />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://x/hero.jpg');
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect(img.getAttribute('loading')).toBeNull();

    rerender(<BlockRenderer blocks={[createBlock('hero')]} property={property} />);
    expect((container.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('https://x/cover.jpg');
  });

  it('galeria: as fotos são preguiçosas (só a capa tem prioridade)', () => {
    const withPhotos: LandingProperty = {
      ...property,
      photos: [{ url: 'https://x/1.jpg', thumbnailUrl: 'https://x/1-thumb.jpg' }, { url: 'https://x/2.jpg' }],
    };
    const { container } = render(<BlockRenderer blocks={[createBlock('gallery')]} property={withPhotos} />);
    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['https://x/1-thumb.jpg', 'https://x/2.jpg']);
    expect(imgs.every((i) => i.getAttribute('loading') === 'lazy')).toBe(true);
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

// Locação, entrega, unidades e plantas vindas do imóvel (Meu site D).
describe('BlockRenderer: dados novos do imóvel', () => {
  const base: LandingProperty = { code: 'X', title: 'Casa' };

  it('faixa de preço: locação mostra o aluguel por mês', () => {
    const p: LandingProperty = { ...base, transaction: 'rent', rentPrice: 2500 };
    render(<BlockRenderer blocks={[createBlock('price_band')]} property={p} />);
    expect(screen.getByText(/R\$\s?2\.500\/mês/)).toBeInTheDocument();
  });

  it('faixa de preço: o texto escrito vence o aluguel', () => {
    const p: LandingProperty = { ...base, transaction: 'rent', rentPrice: 2500 };
    const b = createBlock('price_band');
    b.config.text = 'Consulte';
    render(<BlockRenderer blocks={[b]} property={p} />);
    expect(screen.getByText('Consulte')).toBeInTheDocument();
  });

  it('faixa de preço: venda e locação com preço de venda usa a venda', () => {
    const p: LandingProperty = { ...base, transaction: 'sale_rent', salePrice: 900000, rentPrice: 3000 };
    render(<BlockRenderer blocks={[createBlock('price_band')]} property={p} />);
    expect(screen.getByText(/R\$\s?900\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/\/mês/)).toBeNull();
  });

  it('ehLocacao: só aluguel e temporada', () => {
    expect(ehLocacao({ ...base, transaction: 'rent' })).toBe(true);
    expect(ehLocacao({ ...base, transaction: 'season' })).toBe(true);
    expect(ehLocacao({ ...base, transaction: 'sale' })).toBe(false);
    expect(ehLocacao({ ...base, transaction: 'sale_rent' })).toBe(false);
    expect(ehLocacao(null)).toBe(false);
    expect(ehLocacao(undefined)).toBe(false);
  });

  function ficha(p: LandingProperty, fields: string[]) {
    const b = createBlock('tech_sheet');
    b.config.fields = fields as never;
    return render(<BlockRenderer blocks={[b]} property={p} />);
  }

  it('ficha: entrega e unidades aparecem com o dado', () => {
    ficha({ ...base, deliveryForecast: '2027-12-01', totalUnits: 120 }, ['delivery', 'units']);
    expect(screen.getByText('dez/2027')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('ficha: sem dado, o item some', () => {
    ficha({ ...base, bedrooms: 2 }, ['delivery', 'units', 'bedrooms']);
    expect(screen.queryByText('Entrega')).toBeNull();
    expect(screen.queryByText('Unidades')).toBeNull();
    expect(screen.getByText('Dormitórios')).toBeInTheDocument();
  });

  const tipologias = [
    { name: 'Tipo A', bedrooms: 2, usefulAreaM2: 58, salePrice: 350000 },
    { name: null, bedrooms: 2, usefulAreaM2: 60, rentPrice: 2200 },
  ];

  it('plantas: sem itens manuais, lista as tipologias do imóvel', () => {
    const p: LandingProperty = { ...base, typologies: tipologias };
    render(<BlockRenderer blocks={[createBlock('apartment_types')]} property={p} />);
    expect(screen.getByText('Tipo A')).toBeInTheDocument();
    expect(screen.getByText('58 m²')).toBeInTheDocument();
    expect(screen.getByText(/a partir de R\$\s?350\.000/i)).toBeInTheDocument();
    expect(screen.getByText('2 dorms')).toBeInTheDocument();
  });

  it('plantas: na locação o preço é o aluguel por mês', () => {
    const p: LandingProperty = { ...base, transaction: 'rent', typologies: tipologias };
    render(<BlockRenderer blocks={[createBlock('apartment_types')]} property={p} />);
    expect(screen.getByText(/R\$\s?2\.200\/mês/)).toBeInTheDocument();
    expect(screen.queryByText(/a partir de/i)).toBeNull();
  });

  it('plantas: preço e área 0 não viram "R$ 0" nem "0 m²"; tipologia vazia não vira linha', () => {
    const p: LandingProperty = {
      ...base,
      typologies: [
        { name: 'Tipo Z', bedrooms: 2, usefulAreaM2: 0, salePrice: 0 },
        { name: null, bedrooms: null, usefulAreaM2: null, salePrice: null },
        { name: '', bedrooms: null, usefulAreaM2: 0, salePrice: 0 },
      ],
    };
    const { container } = render(<BlockRenderer blocks={[createBlock('apartment_types')]} property={p} />);
    expect(screen.getByText('Tipo Z')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/R\$\s?0/);
    expect(container.textContent).not.toContain('0 m²');
    expect(screen.queryByText('Planta')).toBeNull();
    expect(container.querySelectorAll('.rounded-xl')).toHaveLength(1);
  });

  it('plantas: itens manuais vencem as tipologias', () => {
    const p: LandingProperty = { ...base, typologies: tipologias };
    const b = createBlock('apartment_types');
    b.config.items = [{ name: 'Manual' }];
    render(<BlockRenderer blocks={[b]} property={p} />);
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.queryByText('Tipo A')).toBeNull();
  });

  it('plantas: sem itens e sem tipologias, o bloco não aparece', () => {
    const { container } = render(<BlockRenderer blocks={[createBlock('apartment_types')]} property={base} />);
    expect(container.textContent).toBe('');
  });

  it('moldura: página padrão de venda mantém faixa e ficha', () => {
    const p: LandingProperty = { ...property, bathrooms: 2 };
    render(<BlockRenderer blocks={defaultLandingBlocks()} property={p} />);
    expect(screen.getAllByText(/R\$\s?800\.000/).length).toBeGreaterThan(0);
    expect(screen.getByText('Dormitórios')).toBeInTheDocument();
    expect(screen.queryByText(/\/mês/)).toBeNull();
  });
});

describe('Custo mensal', () => {
  const locacao: LandingProperty = { ...property, rentPrice: 2500, condoFee: 600, iptu: 1200, iptuPeriod: 'yearly' };
  const bloco = (cfg: Record<string, unknown>) => {
    const b = createBlock('monthly_cost');
    Object.assign(b.config, cfg);
    return b;
  };
  const nbsp = (t: string) => t.replace(/\u00a0/g, ' ');

  it('soma aluguel, condomínio, IPTU mensal e extras', () => {
    const b = bloco({ extras: [{ label: 'Seguro incêndio', value: 35 }] });
    const { container } = render(<BlockRenderer blocks={[b]} property={locacao} />);
    const txt = nbsp(container.textContent ?? '');
    expect(txt).toContain('Custo mensal');
    expect(txt).toContain('AluguelR$ 2.500');
    expect(txt).toContain('CondomínioR$ 600');
    expect(txt).toContain('IPTUR$ 100');
    expect(txt).toContain('Seguro incêndioR$ 35');
    expect(txt).toContain('TotalR$ 3.235');
  });

  it('IPTU mensal ou sem período entra inteiro', () => {
    for (const iptuPeriod of ['monthly', null] as const) {
      const { container, unmount } = render(
        <BlockRenderer blocks={[bloco({})]} property={{ ...locacao, iptuPeriod }} />,
      );
      expect(nbsp(container.textContent ?? '')).toContain('IPTUR$ 1.200');
      unmount();
    }
  });

  it('linha nula ou zero não aparece; uma linha só não tem total', () => {
    const { container } = render(
      <BlockRenderer blocks={[bloco({})]} property={{ ...property, rentPrice: 2500, condoFee: 0, iptu: null }} />,
    );
    const txt = nbsp(container.textContent ?? '');
    expect(txt).toContain('AluguelR$ 2.500');
    expect(txt).not.toContain('Condomínio');
    expect(txt).not.toContain('IPTU');
    expect(txt).not.toContain('Total');
  });

  it('sem nenhuma linha o bloco não aparece', () => {
    const { container } = render(<BlockRenderer blocks={[bloco({})]} property={property} />);
    expect(container.textContent).toBe('');
  });

  it('linha extra sem rótulo não aparece (nem entra no total)', () => {
    const b = bloco({ source: 'manual', extras: [{ label: '  ', value: 50 }, { label: 'Taxa A', value: 10 }] });
    const { container } = render(<BlockRenderer blocks={[b]} property={locacao} />);
    const txt = nbsp(container.textContent ?? '');
    expect(txt).toContain('Taxa AR$ 10');
    expect(txt).not.toContain('R$ 50');
    expect(txt).not.toContain('Total');
  });

  it('source manual usa só os extras', () => {
    const b = bloco({ source: 'manual', extras: [{ label: 'Taxa A', value: 10 }, { label: 'Taxa B', value: 20 }] });
    const { container } = render(<BlockRenderer blocks={[b]} property={locacao} />);
    const txt = nbsp(container.textContent ?? '');
    expect(txt).not.toContain('Aluguel');
    expect(txt).toContain('Taxa AR$ 10');
    expect(txt).toContain('TotalR$ 30');
  });
});

describe('Passo a passo', () => {
  it('mostra os passos numerados com título e texto', () => {
    const b = createBlock('steps');
    b.config.items = [
      { title: 'Visita', text: 'Você conhece o imóvel.' },
      { title: 'Proposta', text: 'Enviamos a proposta.' },
      { title: 'Contrato', text: 'Assinatura.' },
    ];
    const { container } = render(<BlockRenderer blocks={[b]} property={property} />);
    expect(screen.getByText('Como funciona')).toBeInTheDocument();
    expect(screen.getByText('Proposta')).toBeInTheDocument();
    expect(screen.getByText('Enviamos a proposta.')).toBeInTheDocument();
    const nums = Array.from(container.querySelectorAll('[data-step-number]')).map((n) => n.textContent);
    expect(nums).toEqual(['1', '2', '3']);
  });

  it('sem passos o bloco não aparece', () => {
    const { container } = render(<BlockRenderer blocks={[createBlock('steps')]} property={property} />);
    expect(container.textContent).toBe('');
  });
});


describe('Formulário dentro da capa', () => {
  const capa = (formInHero = true): BlockInstance => {
    const b = createBlock('hero');
    (b.config as { formInHero?: boolean }).formInHero = formInHero;
    return b;
  };
  const faixa = () => {
    const b = createBlock('price_band');
    b.config.text = 'Entrada facilitada';
    return b;
  };
  const oculto = (b: BlockInstance) => ({ ...b, visible: false });
  const antes = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('formularioDaCapa: capa no topo com a opção ligada e um formulário visível', () => {
    const hero = capa();
    const form = createBlock('lead_form');
    expect(formularioDaCapa([hero, faixa(), form])).toEqual({ heroId: hero.id, formId: form.id });
    // Seção oculta antes da capa não conta: a capa continua sendo a primeira visível.
    expect(formularioDaCapa([oculto(faixa()), hero, form])).toEqual({ heroId: hero.id, formId: form.id });
  });

  it('formularioDaCapa: null sem a opção, sem formulário, com formulário oculto ou capa fora do topo', () => {
    const form = createBlock('lead_form');
    expect(formularioDaCapa([capa(false), form])).toBeNull();
    expect(formularioDaCapa([createBlock('hero'), form])).toBeNull();
    expect(formularioDaCapa([capa()])).toBeNull();
    expect(formularioDaCapa([capa(), oculto(form)])).toBeNull();
    expect(formularioDaCapa([faixa(), capa(), form])).toBeNull();
    expect(formularioDaCapa([oculto(capa()), form])).toBeNull();
    expect(formularioDaCapa([])).toBeNull();
  });

  it('o formulário aparece dentro da capa e não de novo depois da faixa de preço', () => {
    const hero = capa();
    const band = faixa();
    const form = createBlock('lead_form');
    const { container } = render(<BlockRenderer blocks={[hero, band, form]} property={property} />);
    const anchors = container.querySelectorAll('#lp-lead-form');
    expect(anchors).toHaveLength(1);
    const heroEl = container.querySelector(`[data-block-id="${hero.id}"]`)!;
    expect(heroEl.contains(anchors[0])).toBe(true);
    const bandEl = screen.getByText('Entrada facilitada');
    expect(antes(anchors[0], bandEl)).toBe(true);
    expect(screen.getAllByText('Quando você pretende comprar?')).toHaveLength(1);
  });

  it('opção ligada sem formulário (ou com ele oculto): a capa sai igual à de hoje', () => {
    const ligada = capa(true);
    const desligada = { ...ligada, config: { ...ligada.config, formInHero: false } };
    const a = render(<BlockRenderer blocks={[ligada]} property={property} />);
    const b = render(<BlockRenderer blocks={[desligada]} property={property} />);
    expect(a.container.innerHTML).toBe(b.container.innerHTML);

    const form = oculto(createBlock('lead_form'));
    const c = render(<BlockRenderer blocks={[ligada, form]} property={property} />);
    const d = render(<BlockRenderer blocks={[desligada, form]} property={property} />);
    expect(c.container.innerHTML).toBe(d.container.innerHTML);
  });

  it('capa fora do topo: tudo segue na ordem, formulário no lugar dele', () => {
    const band = faixa();
    const hero = capa();
    const form = createBlock('lead_form');
    const { container } = render(<BlockRenderer blocks={[band, hero, form]} property={property} />);
    const heroEl = container.querySelector(`[data-block-id="${hero.id}"]`)!;
    const anchor = container.querySelector('#lp-lead-form')!;
    expect(heroEl.contains(anchor)).toBe(false);
    expect(antes(heroEl, anchor)).toBe(true);
  });

  it('dois formulários: só o primeiro vai para a capa, o segundo fica no lugar sem a âncora', () => {
    const hero = capa();
    const band = faixa();
    const f1 = createBlock('lead_form');
    const f2 = createBlock('lead_form');
    const { container } = render(<BlockRenderer blocks={[hero, band, f1, f2]} property={property} />);
    const anchors = container.querySelectorAll('#lp-lead-form');
    expect(anchors).toHaveLength(1);
    expect(container.querySelector(`[data-block-id="${hero.id}"]`)!.contains(anchors[0])).toBe(true);
    const f2El = container.querySelector(`[data-block-id="${f2.id}"]`)!;
    expect(f2El.textContent).toContain('Quando você pretende comprar?');
    expect(antes(screen.getByText('Entrada facilitada'), f2El)).toBe(true);
  });

  it('dois formulários sem a opção: a âncora fica só no primeiro', () => {
    const f1 = createBlock('lead_form');
    const f2 = createBlock('lead_form');
    const { container } = render(<BlockRenderer blocks={[createBlock('hero'), f1, f2]} property={property} />);
    const anchors = container.querySelectorAll('#lp-lead-form');
    expect(anchors).toHaveLength(1);
    expect(container.querySelector(`[data-block-id="${f1.id}"]`)!.contains(anchors[0])).toBe(true);
  });

  it('página larga: as seções fora da capa ficam em 720px, a capa ocupa a largura toda', () => {
    const hero = capa();
    const band = faixa();
    const form = createBlock('lead_form');
    const { container, rerender } = render(<BlockRenderer blocks={[hero, band, form]} property={property} wide />);
    const bandBox = () => container.querySelector(`[data-block-id="${band.id}"]`) as HTMLElement;
    const heroBox = () => container.querySelector(`[data-block-id="${hero.id}"]`) as HTMLElement;
    expect(bandBox().style.maxWidth).toBe('720px');
    expect(heroBox().style.maxWidth).toBe('');
    expect(heroBox().innerHTML).toContain('lg:grid-cols-[1.25fr_1fr]');

    // Sem `wide` (a prévia do editor), nada disso: celular.
    rerender(<BlockRenderer blocks={[hero, band, form]} property={property} />);
    expect(bandBox().style.maxWidth).toBe('');
    expect(heroBox().innerHTML).not.toContain('lg:grid-cols-[1.25fr_1fr]');
  });
});
