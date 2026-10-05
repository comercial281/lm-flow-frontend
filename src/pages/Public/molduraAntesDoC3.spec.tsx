import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { execSync } from 'node:child_process';
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
   commit c72c0c39 (main antes do C3). Comando único, completo, a partir da
   raiz deste repositório (no c72c0c39 a pasta __fixtures__ não existe):
     git worktree add /tmp/antes c72c0c39 &&
     cp src/pages/Public/molduraAntesDoC3.spec.tsx /tmp/antes/src/pages/Public/ &&
     mkdir -p /tmp/antes/src/pages/Public/__fixtures__ &&
     (cd /tmp/antes && npx -y pnpm@9 install --no-frozen-lockfile &&
       GERAR_MOLDURA=/tmp/antes/src/pages/Public/__fixtures__/moldura-antes-do-c3.json \
       MOLDURA_DO_CODIGO_ANTIGO=c72c0c39 NODE_OPTIONS=--no-experimental-webstorage \
       npx vitest run src/pages/Public/molduraAntesDoC3.spec.tsx -t 'gera ou confere') &&
     cp /tmp/antes/src/pages/Public/__fixtures__/moldura-antes-do-c3.json src/pages/Public/__fixtures__/ &&
     git worktree remove --force /tmp/antes
   (`-t 'gera ou confere'`: só o teste que grava; os outros conferem o código
   novo e falhariam lá, cortando o `&&`.)
   Não regravar a partir do código novo: aí o teste passa a provar nada.

   TRAVA: com `GERAR_MOLDURA` definido, o spec só regrava se receber também
   `MOLDURA_DO_CODIGO_ANTIGO=c72c0c39` E o `git rev-parse HEAD` de onde ele
   roda começar por `c72c0c39`. Em qualquer outro caso ele FALHA, com a
   mensagem dizendo por quê.

   Diferenças aceitas, decididas no C3 e normalizadas abaixo, cada uma por
   regex do atributo exato: (1) o "LM Flow" do crédito do rodapé virou link
   pro site do LM Flow; (2) acessibilidade do menu do topo: os `nav` ganharam
   `aria-label="Menu principal"` e o botão do menu do celular ganhou
   `aria-controls="menu-do-celular"`. (As variáveis novas da raiz
   e o `var(--solid)` não aparecem nestes trechos: moram na raiz da página e nos
   cartões/botões, fora do topo, rodapé e capa.)

   Menu (C3, Task 9): o servidor novo manda `menu_config` sempre, e pra quem
   nunca salvou a tela Menus ele é o de fábrica, com `saved: false`. Com ele,
   topo e rodapé têm de sair iguais ao fixture também. Com `saved: true` (o
   cliente salvou a tela Menus, mesmo sem mudar nada) o rodapé passa a repetir
   o menu: diferença decidida, conferida no último teste.
──────────────────────────────────────────────────────────────────────────── */

const FIXTURES = join(__dirname, '__fixtures__', 'moldura-antes-do-c3.json');

const siteBase: SiteInfo = {
  name: 'Imob Teste',
  branding: { logo_url: 'https://cdn.x/logo.png', primary_color: '#0E7C5A', accent_color: '#9333EA', font_family: 'Montserrat' },
  contact: { phone: '(11) 3333-4444', email: 'contato@imob.com.br', whatsapp: '5511999990000', address: 'Rua A, 1\nCentro' },
  social_links: { instagram: 'https://instagram.com/imob', facebook: 'https://fb.com/imob', youtube: 'https://youtube.com/@imob' },
  financiamento: { enabled: true }, anuncie: { enabled: true },
  menu: [{ title: 'Quem somos', slug: 'quem-somos' }],
  hero: { image_url: 'https://cdn.x/capa.jpg' },
};
const semLogoBase: SiteInfo = { ...siteBase, branding: { primary_color: '#0E7C5A' } };
const soTelefoneBase: SiteInfo = { ...siteBase, contact: { phone: '(11) 3333-4444' }, social_links: {} };

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

/** O `menu_config` que o servidor novo manda pra quem nunca salvou o menu (com a página do `site.menu`). */
const MENU_DE_FABRICA = {
  items: [
    ...['sale', 'rent', 'launch', 'about', 'contact', 'financing', 'listing'].map(key => ({ key, label: null, enabled: true })),
    { key: 'page:quem-somos', label: null, enabled: true, page_title: 'Quem somos' },
    { key: 'blog', label: null, enabled: true },
  ],
  external: [],
  saved: false,
};

async function capturar(extra: Partial<SiteInfo> = {}): Promise<Record<string, string>> {
  const site = { ...siteBase, ...extra };
  const semLogo = { ...semLogoBase, ...extra };
  const soTelefone = { ...soTelefoneBase, ...extra };
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

/** (1) O crédito ganhou o link no C3 (decidido): volta ao texto de antes pra comparar. */
const tirarCredito = (h: string) => h.replace(/feito com <a href="https:\/\/lmflow\.com\.br" target="_blank" rel="noopener"[^>]*>LM Flow<\/a>\./g, 'feito com LM Flow.');
/** (2) Acessibilidade do menu (decidida): só estes atributos, exatos. */
const tirarAcessibilidadeDoMenu = (h: string) => h
  .replace(/<nav aria-label="Menu principal" class="/g, '<nav class="')
  .replace(/ aria-expanded="(true|false)" aria-controls="menu-do-celular"/g, ' aria-expanded="$1"');
const normalizar = (h: string) => tirarAcessibilidadeDoMenu(tirarCredito(h));

/** Só regrava no código de ANTES do C3 e com a confirmação explícita; senão falha. */
const COMMIT_ANTIGO = 'c72c0c39';
function travaDaGravacao(): void {
  if (process.env.MOLDURA_DO_CODIGO_ANTIGO !== COMMIT_ANTIGO) {
    throw new Error(`GERAR_MOLDURA recusado: falta MOLDURA_DO_CODIGO_ANTIGO=${COMMIT_ANTIGO}. O fixture só pode ser gravado a partir do código de antes do C3 (ver o cabeçalho deste spec).`);
  }
  let head = '';
  try { head = execSync('git rev-parse HEAD', { cwd: __dirname, encoding: 'utf8' }).trim(); } catch { /* sem git: cai na recusa abaixo */ }
  if (!head.startsWith(COMMIT_ANTIGO)) {
    throw new Error(`GERAR_MOLDURA recusado: o HEAD aqui é ${head || '(desconhecido)'}, não ${COMMIT_ANTIGO}. Regravar a partir do código novo apaga a rede de proteção (ver o cabeçalho deste spec).`);
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], meta: { total: 0 } }) }));
  rolar(0);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('site sem appearance: topo, faixa de cima, rodapé e capa de antes do C3 (c72c0c39)', () => {
  it('gera ou confere', async () => {
    const agora = await capturar();
    if (process.env.GERAR_MOLDURA) {
      travaDaGravacao();
      writeFileSync(process.env.GERAR_MOLDURA, JSON.stringify(agora, null, 1) + '\n');
      return;
    }
    const antes = JSON.parse(readFileSync(FIXTURES, 'utf8')) as Record<string, string>;
    expect(Object.keys(agora)).toEqual(Object.keys(antes));
    for (const k of Object.keys(antes)) {
      expect(normalizar(agora[k]), k).toBe(antes[k]);
    }
  });

  it('as diferenças normalizadas são só o crédito e os atributos do menu, e estão mesmo lá', async () => {
    const antes = JSON.parse(readFileSync(FIXTURES, 'utf8')) as Record<string, string>;
    const agora = await capturar();
    expect(antes.rodape).toContain('feito com LM Flow.');
    expect(agora.rodape).toContain('feito com <a href="https://lmflow.com.br"');
    const mudaram = Object.keys(antes).filter(k => agora[k] !== antes[k]);
    const doRodape = ['rodape', 'rodape-home-sem-logo'];
    const doTopo = mudaram.filter(k => !doRodape.includes(k));
    expect(mudaram.filter(k => doRodape.includes(k))).toEqual(doRodape);
    expect(doTopo).toEqual(['topo-home-flutuando', 'topo-home-flutuando-sem-logo', 'topo-home-rolado',
      'topo-interno', 'topo-interno-sem-logo', 'topo-interno-previa']);
    // Cada diferença é SÓ o atributo dela: tirar só ele já devolve o de antes.
    for (const k of doRodape) expect(tirarCredito(agora[k]), k).toBe(antes[k]);
    for (const k of doTopo) {
      expect(agora[k], k).toContain('<nav aria-label="Menu principal" class="hidden items-center gap-6 lg:flex">');
      expect(agora[k], k).toContain('aria-controls="menu-do-celular"');
      expect(tirarAcessibilidadeDoMenu(agora[k]), k).toBe(antes[k]);
    }
  });

  it('com o menu de fábrica do servidor novo (menu_config), topo e rodapé iguais ao fixture', async () => {
    const antes = JSON.parse(readFileSync(FIXTURES, 'utf8')) as Record<string, string>;
    const agora = await capturar({ menu_config: MENU_DE_FABRICA });
    for (const k of Object.keys(antes)) {
      expect(normalizar(agora[k]), k).toBe(antes[k]);
    }
  });

  it('menu salvo (saved: true) igual ao de fábrica: o rodapé passa a repetir o menu (diferença decidida); o topo não muda', async () => {
    const antes = JSON.parse(readFileSync(FIXTURES, 'utf8')) as Record<string, string>;
    const agora = await capturar({ menu_config: { ...MENU_DE_FABRICA, saved: true } });
    const doRodape = ['rodape', 'rodape-home-sem-logo'];
    for (const k of Object.keys(antes).filter(x => !doRodape.includes(x))) {
      expect(normalizar(agora[k]), k).toBe(antes[k]);
    }
    // O de antes não tinha a página criada no rodapé; o menu salvo tem.
    expect(antes.rodape).not.toContain('/portal/imob/p/quem-somos');
    expect(agora.rodape).toContain('href="/portal/imob/p/quem-somos"');
    expect(normalizar(agora.rodape)).not.toBe(antes.rodape);
  });
});
