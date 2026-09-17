import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalHeader, type SiteInfo } from './portalShared';

/* ────────────────────────────────────────────────────────────────────────────
   O cabeçalho do portal: o que gruda e o que rola para fora.

   Relato do dono do produto (17/09/2026): "não curti esse número e esse email
   que ficam aparecendo fixos ao scrollar a tela". Eram DOIS defeitos no mesmo
   lugar, os dois invisíveis em qualquer teste de tipo ou de build:

   1. A barra de contato era desenhada DENTRO do bloco que gruda no topo, então
      telefone e e-mail ficavam presos na tela a rolagem inteira. Na home era
      pior: o cabeçalho é transparente sobre a capa e a barra nem existe, mas ela
      SURGIA na primeira rolagem.
   2. Na home o cabeçalho saía de fora do fluxo (flutuando sobre a capa) e
      entrava no fluxo ao rolar — a página inteira saltava para baixo a altura
      dele, de uma vez.
──────────────────────────────────────────────────────────────────────────── */

const site: SiteInfo = {
  name: 'Imobiliária Teste',
  contact: { phone: '(11) 99999-0000', email: 'contato@teste.com.br' },
  social_links: { instagram: 'https://instagram.com/teste' },
};

/** O container que posiciona o cabeçalho — é ele que gruda (ou não). */
const headerHolder = (c: HTMLElement) => c.querySelector('header')!.parentElement!;

const rolar = (px: number) => {
  Object.defineProperty(window, 'scrollY', { value: px, writable: true, configurable: true });
  act(() => { window.dispatchEvent(new Event('scroll')); });
};

const montar = async (onHome: boolean) => {
  let out!: ReturnType<typeof render>;
  await act(async () => {
    out = render(
      <MemoryRouter>
        <PortalHeader site={site} tenant="teste" onHome={onHome} />
      </MemoryRouter>,
    );
  });
  return out;
};

describe('PortalHeader', () => {
  beforeEach(() => {
    // O cabeçalho pergunta sozinho se existe blog. Rede de verdade é proibida
    // na suíte (ver src/test/setup.ts).
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { total: 0 } }),
    }));
    rolar(0);
  });

  describe('nas páginas internas', () => {
    it('mostra telefone e e-mail no topo', async () => {
      const { container } = await montar(false);
      expect(container.querySelector('a[href^="tel:"]')).toBeTruthy();
      expect(container.querySelector('a[href^="mailto:"]')).toBeTruthy();
    });

    it('deixa a barra de contato FORA do bloco que gruda, para ela rolar embora', async () => {
      const { container } = await montar(false);
      const telefone = container.querySelector('a[href^="tel:"]')!;
      expect(telefone.closest('.sticky, .fixed')).toBeNull();
      expect(headerHolder(container).className).toContain('sticky');
    });
  });

  describe('na home', () => {
    it('não desenha a barra de contato — nem antes, nem depois de rolar', async () => {
      const { container } = await montar(true);
      expect(container.querySelector('a[href^="tel:"]')).toBeNull();

      rolar(400);
      expect(container.querySelector('a[href^="tel:"]')).toBeNull();
      expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    });

    it('mantém o cabeçalho fora do fluxo o tempo todo, para a página não saltar', async () => {
      const { container } = await montar(true);
      expect(headerHolder(container).className).toContain('fixed');

      rolar(400);
      const cls = headerHolder(container).className;
      expect(cls).toContain('fixed');
      expect(cls).not.toContain('sticky');
    });

    it('troca a roupa do cabeçalho na rolagem: transparente sobre a capa, sólido depois', async () => {
      const { container } = await montar(true);
      expect(container.querySelector('header')!.className).toContain('bg-gradient-to-b');

      rolar(400);
      expect(container.querySelector('header')!.className).toContain('bg-[var(--paper)]/90');
    });
  });
});
