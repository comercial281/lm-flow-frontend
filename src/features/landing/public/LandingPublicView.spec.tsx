import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LandingPublicView } from './LandingPublicView';
import * as loader from './landingLoader';

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
