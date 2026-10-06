import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LandingPublicView } from './LandingPublicView';
import * as loader from './landingLoader';
import { createBlock } from '@/features/landing/blocks';

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
