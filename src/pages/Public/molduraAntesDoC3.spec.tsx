import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalFooter, PortalHeader, type SiteInfo } from './portalShared';
import HomeCapa from './home/HomeCapa';
import { resolverHome } from '@/features/siteBuilder/public/homeConfig';

/* ────────────────────────────────────────────────────────────────────────────
   Rede do Review Focus 5 (C3): site sem `appearance` (servidor velho, cliente
   que nunca abriu a Aparência) sai com o topo, a faixa de cima, o rodapé e a
   capa de ANTES do C3.

   `__fixtures__/moldura-antes-do-c3.json` foi gravado rodando ESTE arquivo no
   commit c72c0c39 (main antes do C3), com `GERAR_MOLDURA=<caminho>`:
     git worktree add /tmp/antes c72c0c39 && cp este spec lá &&
     GERAR_MOLDURA=$PWD/src/pages/Public/__fixtures__/moldura-antes-do-c3.json \
       npx vitest run src/pages/Public/molduraAntesDoC3.spec.tsx   (dentro de /tmp/antes)
   Não regravar a partir do código novo: aí o teste passa a provar nada.

   Única diferença aceita, decidida no C3 e normalizada abaixo: o "LM Flow" do
   crédito do rodapé virou link pro site do LM Flow. (As variáveis novas da raiz
   e o `var(--solid)` não aparecem nestes trechos: moram na raiz da página e nos
   cartões/botões, fora do topo, rodapé e capa.)
──────────────────────────────────────────────────────────────────────────── */

const FIXTURES = join(__dirname, '__fixtures__', 'moldura-antes-do-c3.json');

const site: SiteInfo = {
  name: 'Imob Teste',
  branding: { logo_url: 'https://cdn.x/logo.png', primary_color: '#0E7C5A', accent_color: '#9333EA', font_family: 'Montserrat' },
  contact: { phone: '(11) 3333-4444', email: 'contato@imob.com.br', whatsapp: '5511999990000', address: 'Rua A, 1\nCentro' },
  social_links: { instagram: 'https://instagram.com/imob', facebook: 'https://fb.com/imob', youtube: 'https://youtube.com/@imob' },
  financiamento: { enabled: true }, anuncie: { enabled: true },
  menu: [{ title: 'Quem somos', slug: 'quem-somos' }],
  hero: { image_url: 'https://cdn.x/capa.jpg' },
};
const semLogo: SiteInfo = { ...site, branding: { primary_color: '#0E7C5A' } };
const soTelefone: SiteInfo = { ...site, contact: { phone: '(11) 3333-4444' }, social_links: {} };

const rolar = (px: number) => {
  Object.defineProperty(window, 'scrollY', { value: px, writable: true, configurable: true });
  act(() => { window.dispatchEvent(new Event('scroll')); });
};

async function montar(el: React.ReactElement): Promise<HTMLElement> {
  let out!: ReturnType<typeof render>;
  await act(async () => { out = render(<MemoryRouter>{el}</MemoryRouter>); });
  return out.container;
}
async function html(el: React.ReactElement, pegar?: (c: HTMLElement) => Element | null): Promise<string> {
  const c = await montar(el);
  const h = pegar ? (pegar(c)?.outerHTML ?? '(nada)') : c.innerHTML;
  cleanup();
  return h;
}
const capa = (s: SiteInfo) => (
  <HomeCapa site={s} home={resolverHome(undefined)} items={[]} tenant="imob" abas={['sale', 'rent', 'launch']} cities={['Campinas']} hoods={['Centro']} types={['apartment']} />
);
const faixa = (c: HTMLElement) => c.querySelector('header')!.parentElement!.previousElementSibling;

async function capturar(): Promise<Record<string, string>> {
  const r: Record<string, string> = {};
  r['topo-home-flutuando'] = await html(<PortalHeader site={site} tenant="imob" onHome abas={['sale', 'rent']} />);
  r['topo-home-flutuando-sem-logo'] = await html(<PortalHeader site={semLogo} tenant="imob" onHome />);
  const c = await montar(<PortalHeader site={site} tenant="imob" onHome abas={['sale', 'rent']} />);
  rolar(400);
  r['topo-home-rolado'] = c.innerHTML;
  cleanup();
  rolar(0);
  r['topo-interno'] = await html(<PortalHeader site={site} tenant="imob" abas={['sale', 'launch']} />);
  r['topo-interno-sem-logo'] = await html(<PortalHeader site={semLogo} tenant="imob" />);
  r['topo-interno-previa'] = await html(<PortalHeader site={{ ...site, preview: true }} tenant="imob" />);
  r['faixa-de-cima'] = await html(<PortalHeader site={site} tenant="imob" />, faixa);
  r['faixa-de-cima-so-telefone'] = await html(<PortalHeader site={soTelefone} tenant="imob" />, faixa);
  r['rodape'] = await html(<PortalFooter site={site} tenant="imob" abas={['sale', 'rent', 'launch']} />);
  r['rodape-home-sem-logo'] = await html(<PortalFooter site={{ ...semLogo, sections: { stats: false } }} tenant="imob" onHome abas={['sale']} />);
  r['capa'] = await html(capa(site));
  r['capa-video'] = await html(capa({ ...site, hero: { video_url: 'https://cdn.x/capa.mp4' }, seo: { description: 'Desc' } }));
  r['topo-manutencao'] = await html(<PortalHeader site={{ ...site, maintenance: true }} tenant="imob" />);
  r['topo-manutencao-sem-logo'] = await html(<PortalHeader site={{ ...semLogo, maintenance: true }} tenant="imob" />);
  r['rodape-manutencao'] = await html(<PortalFooter site={{ ...site, maintenance: true }} tenant="imob" />);
  return r;
}

/** O crédito ganhou o link no C3 (decidido): volta ao texto de antes pra comparar. */
const normalizar = (h: string) => h.replace(/feito com <a href="https:\/\/lmflow\.com\.br" target="_blank" rel="noopener"[^>]*>LM Flow<\/a>\./g, 'feito com LM Flow.');

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], meta: { total: 0 } }) }));
  rolar(0);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('site sem appearance: topo, faixa de cima, rodapé e capa de antes do C3 (c72c0c39)', () => {
  it('gera ou confere', async () => {
    const agora = await capturar();
    if (process.env.GERAR_MOLDURA) {
      writeFileSync(process.env.GERAR_MOLDURA, JSON.stringify(agora, null, 1) + '\n');
      return;
    }
    const antes = JSON.parse(readFileSync(FIXTURES, 'utf8')) as Record<string, string>;
    expect(Object.keys(agora)).toEqual(Object.keys(antes));
    for (const k of Object.keys(antes)) {
      expect(normalizar(agora[k]), k).toBe(antes[k]);
    }
  });

  it('a única diferença normalizada é a do crédito, e ela está mesmo lá', async () => {
    const antes = JSON.parse(readFileSync(FIXTURES, 'utf8')) as Record<string, string>;
    const agora = await capturar();
    expect(antes.rodape).toContain('feito com LM Flow.');
    expect(agora.rodape).toContain('feito com <a href="https://lmflow.com.br"');
    const mudaram = Object.keys(antes).filter(k => agora[k] !== antes[k]);
    expect(mudaram).toEqual(['rodape', 'rodape-home-sem-logo']);
  });
});
