import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LandingPublicView } from './LandingPublicView';
import * as loader from './landingLoader';
import { createBlock } from '@/features/landing/blocks';
import { BR_PHONE_PLACEHOLDER } from '@/lib/brPhone';

vi.mock('./metaPixel', () => ({ installPixel: vi.fn() }));
vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));

function dto(extra: Partial<loader.PublicLandingDTO> = {}): loader.PublicLandingDTO {
  return { title: 'LP', content_blocks: [], theme: {}, property: null, ...extra };
}

async function abrir(d: loader.PublicLandingDTO) {
  vi.spyOn(loader, 'loadLanding').mockResolvedValue(d);
  const r = render(<LandingPublicView tenant="t" slug="s" />);
  await waitFor(() => expect(screen.queryByText('Carregando…')).toBeNull());
  return r;
}

describe('LandingPublicView: fonte', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('carrega a fonte escolhida quando é uma das fontes do site', async () => {
    const { container } = await abrir(dto({ theme: { fontFamily: 'Montserrat, sans-serif' } }));
    const link = container.ownerDocument.querySelector('link[rel="stylesheet"][href*="family=Montserrat"]');
    expect(link).not.toBeNull();
  });

  it('fonte fora da lista não gera link', async () => {
    const { container } = await abrir(dto({ theme: { fontFamily: 'Comic Sans' } }));
    expect(container.ownerDocument.querySelector('link[rel="stylesheet"]')).toBeNull();
  });
});

describe('LandingPublicView: largura', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  const capa = (formInHero: boolean) => {
    const b = createBlock('hero');
    (b.config as { formInHero?: boolean }).formInHero = formInHero;
    return b;
  };
  const faixa = () => {
    const b = createBlock('price_band');
    b.config.text = 'Entrada facilitada';
    return b;
  };

  it('formulário na capa: larga só no computador (lg); no celular segue a coluna de 460px', async () => {
    const band = faixa();
    const { container } = await abrir(dto({ content_blocks: [capa(true), band, createBlock('lead_form')] }));
    const coluna = container.querySelector('.lg\\:max-w-\\[1200px\\]') as HTMLElement;
    expect(coluna).not.toBeNull();
    // Abaixo de lg é igual ao celular: a mesma coluna da fábrica.
    expect(coluna.classList.contains('max-w-[460px]')).toBe(true);
    expect(container.querySelector('.max-w-\\[1200px\\]')).toBeNull();
    // O BlockRenderer recebeu `wide`: as seções fora da capa ficam em 720px.
    expect((container.querySelector(`[data-block-id="${band.id}"]`) as HTMLElement).style.maxWidth).toBe('720px');
  });

  it('sem o par (opção desligada ou sem formulário): coluna de 460px como hoje', async () => {
    const r1 = await abrir(dto({ content_blocks: [capa(false), faixa(), createBlock('lead_form')] }));
    expect(r1.container.querySelector('.max-w-\\[460px\\]')).not.toBeNull();
    expect(r1.container.querySelector('.max-w-\\[1200px\\]')).toBeNull();
    expect(r1.container.querySelector('.lg\\:max-w-\\[1200px\\]')).toBeNull();
    r1.unmount();

    const r2 = await abrir(dto({ content_blocks: [capa(true), faixa()] }));
    expect(r2.container.querySelector('.max-w-\\[460px\\]')).not.toBeNull();
    expect(r2.container.querySelector('.lg\\:max-w-\\[1200px\\]')).toBeNull();
  });
});

describe('LandingPublicView: limite de envios', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const FRASE = 'Muitos envios seguidos. Tente de novo em alguns minutos.';

  // Formulário sem perguntas: abre direto no contato.
  const formulario = () => {
    const b = createBlock('lead_form');
    (b.config as { steps: unknown[] }).steps = [];
    return b;
  };

  async function enviar(resposta: () => Response) {
    vi.stubGlobal('fetch', vi.fn(async () => resposta()));
    await abrir(dto({ content_blocks: [formulario()] }));
    fireEvent.change(screen.getByPlaceholderText('Seu nome *'), { target: { value: 'Fulano' } });
    fireEvent.input(screen.getByPlaceholderText(BR_PHONE_PLACEHOLDER), { target: { value: '(11) 99999-0000' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /Falar com Especialista/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Falar com Especialista/ }));
  }

  it('429 mostra a frase do servidor e desliga o botão, sem "Tentar de novo"', async () => {
    await enviar(() => new Response(
      JSON.stringify({ success: false, error: { code: 'TOO_MANY_REQUESTS', message: FRASE } }),
      { status: 429, headers: { 'Retry-After': '540' } },
    ));

    expect(await screen.findByText(FRASE)).toBeInTheDocument();
    expect(screen.queryByText(/Confira sua conexão/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Tentar de novo/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Falar com Especialista/ })).toBeDisabled();
    expect(screen.queryByText('Recebemos suas informações!')).toBeNull();
  });

  it('429 sem Retry-After: a frase do servidor, botão ligado', async () => {
    await enviar(() => new Response(JSON.stringify({ error: { message: FRASE } }), { status: 429 }));

    expect(await screen.findByText(FRASE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Falar com Especialista/ })).toBeEnabled();
  });

  it('outro erro segue com a frase de conexão e o "Tentar de novo"', async () => {
    await enviar(() => new Response('{}', { status: 500 }));

    expect(await screen.findByText(/Não conseguimos enviar seus dados/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar de novo/ })).toBeEnabled();
  });
});

describe('LandingPublicView: CRECI', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  const imovel = (extra: Record<string, unknown> = {}) =>
    ({ code: 'C1', title: 'Casa', photos: [], responsible_name: 'Fulano', responsible_creci: '12345-F/SP', ...extra }) as never;
  const consultor = (config: Record<string, unknown> = {}) => {
    const b = createBlock('consultant');
    Object.assign(b.config, config);
    return b;
  };

  it('termina com a imobiliária e o CRECI dela', async () => {
    await abrir(dto({ agency: { name: 'Imob Silva', creci: 'J-12345' } }));
    expect(screen.getByText('Imob Silva · CRECI J-12345')).toBeInTheDocument();
  });

  it('sem CRECI da imobiliária, sem a linha', async () => {
    await abrir(dto({ agency: { name: 'Imob Silva', creci: null } }));
    expect(screen.queryByText(/CRECI/)).toBeNull();
  });

  it('Consultor sem nome nem CRECI no bloco usa o CRECI do responsável', async () => {
    await abrir(dto({ property: imovel(), content_blocks: [consultor()] }));
    expect(screen.getByText('Fulano')).toBeInTheDocument();
    expect(screen.getByText('CRECI 12345-F/SP')).toBeInTheDocument();
  });

  it('Consultor com CRECI no bloco: vale o do bloco', async () => {
    await abrir(dto({ property: imovel(), content_blocks: [consultor({ creci: '777' })] }));
    expect(screen.getByText('CRECI 777')).toBeInTheDocument();
  });

  it('Consultor com outro nome digitado: não mistura o CRECI do responsável', async () => {
    await abrir(dto({ property: imovel(), content_blocks: [consultor({ name: 'Outra Pessoa' })] }));
    expect(screen.getByText('Outra Pessoa')).toBeInTheDocument();
    expect(screen.queryByText(/CRECI/)).toBeNull();
  });

  it('a linha do CRECI não fica apagada por cima da cor suave do tema', async () => {
    await abrir(dto({ agency: { name: 'Imob Silva', creci: 'J-12345' } }));
    expect(screen.getByText('Imob Silva · CRECI J-12345').className).not.toMatch(/opacity-/);
  });
});
