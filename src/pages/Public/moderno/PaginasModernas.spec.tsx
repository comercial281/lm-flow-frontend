import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PortalFinanciamentoPage from '../PortalFinanciamentoPage';
import PortalAnunciePage from '../PortalAnunciePage';
import PortalBlogPage from '../PortalBlogPage';
import PortalArticlePage from '../PortalArticlePage';
import PortalCustomPage from '../PortalCustomPage';
import PortalSearchPage from '../PortalSearchPage';
import PaginaManutencao from '../PaginaManutencao';
import PaginaNaoEncontrada from '../PaginaNaoEncontrada';
import { esquecerModeloDaPrevia } from '@/features/siteBuilder/public/previaDoModelo';
import { TEXTO_ENVIO_NA_PREVIA } from '@/features/siteBuilder/public/previa';
import type { SiteInfo } from '../portalShared';

vi.mock('@/features/siteBuilder/public/siteVisits', () => ({ sendSiteVisit: vi.fn() }));
vi.mock('@/features/siteBuilder/public/siteTracking', () => ({ installSiteTracking: vi.fn(), trackPageView: vi.fn(), trackLead: vi.fn() }));

/* ────────────────────────────────────────────────────────────────────────────
   Páginas do Moderno, parte (c): Financiamento, Anuncie, Blog, Artigo, página
   própria, 404 da lista e manutenção. Os dados e envios são os do Clássico;
   aqui confere o desenho escolhido e o que a pessoa lê e clica.
──────────────────────────────────────────────────────────────────────────── */

const resposta = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => body });
export const MODERNO = { appearance: { style: 'modern' } } as SiteInfo;

type Rota = { caminho: string; padrao: string; elemento: ReactElement };
type Extra = (url: string, init?: RequestInit) => ReturnType<typeof resposta> | null;

export async function abrir(rota: Rota, site: SiteInfo, extra: Extra = () => null) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const e = extra(url, init);
    if (e) return e;
    if (url.includes('/site/properties')) return resposta({ data: [], meta: { total: 0 } });
    if (url.includes('/site/articles')) return resposta({ data: [], meta: { total: 0 } });
    if (/\/site(\?|$)/.test(url)) return resposta({ data: { name: 'Imob Teste', contact: { whatsapp: '11999990000' }, ...site } });
    return resposta({});
  });
  vi.stubGlobal('fetch', fetchMock);
  const tela = render(
    <MemoryRouter initialEntries={[rota.caminho]}>
      <Routes><Route path={rota.padrao} element={rota.elemento} /></Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.querySelector('[data-carregando]')).toBeNull());
  return { fetchMock, tela };
}

const paginaModerna = (nome: string) => document.querySelector(`[data-pagina-moderna="${nome}"]`);

afterEach(() => { vi.unstubAllGlobals(); esquecerModeloDaPrevia(); window.history.replaceState({}, '', '/'); });

describe('Financiamento no Moderno', () => {
  const ROTA = { caminho: '/portal/imob/financiamento', padrao: '/portal/:tenant/financiamento', elemento: <PortalFinanciamentoPage /> };
  const BANCOS = {
    financiamento: {
      enabled: true, title: 'Simule seu financiamento', intro: 'Escolha o banco.', footer: 'Taxas sujeitas a análise.',
      banks: [
        { key: 'caixa', name: 'Caixa', color: '#005CA9', url: 'https://caixa.gov.br/simulador' },
        { key: 'itau', name: 'Itaú', color: '#EC7000', url: 'https://itau.com.br/simule', logo_url: 'https://cdn.x/itau.png' },
      ],
    },
  };

  it('Clássico continua o de sempre', async () => {
    await abrir(ROTA, BANCOS as SiteInfo);
    expect(paginaModerna('financiamento')).toBeNull();
  });

  it('cabeçalho na cor principal, um cartão por banco com o mesmo link e o rodapé da página', async () => {
    await abrir(ROTA, { ...MODERNO, ...BANCOS } as SiteInfo);
    expect(paginaModerna('financiamento')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Simule seu financiamento' })).toBeTruthy();
    expect(screen.getByText('Escolha o banco.')).toBeTruthy();
    const caixa = screen.getByRole('link', { name: 'Simular financiamento no Caixa' });
    expect(caixa.getAttribute('href')).toBe('https://caixa.gov.br/simulador');
    expect(caixa.getAttribute('target')).toBe('_blank');
    expect(within(caixa).getByText('Simular no site do banco')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Simular financiamento no Itaú' }).getAttribute('href')).toBe('https://itau.com.br/simule');
    expect(screen.getByText('Taxas sujeitas a análise.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ficou com dúvida na simulação?' })).toBeTruthy();
  });

  it('sem banco com link: o aviso de hoje e o WhatsApp', async () => {
    await abrir(ROTA, { ...MODERNO, financiamento: { enabled: true, banks: [] } } as SiteInfo);
    expect(screen.getByText('Nossas condições de financiamento estão sendo atualizadas.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Fale com a gente no WhatsApp/ })).toBeTruthy();
  });
});


describe('Anuncie no Moderno', () => {
  const ROTA = { caminho: '/portal/imob/anuncie', padrao: '/portal/:tenant/anuncie', elemento: <PortalAnunciePage /> };
  const ANUNCIE = { anuncie: { enabled: true, title: 'Anuncie com a gente', intro: 'Avaliamos seu imóvel.' } };
  const aceita = (url: string) => (url.endsWith('/site/anuncie') ? resposta({ data: { ok: true } }) : null);

  /** Preenche os dois passos e manda; devolve o corpo do POST. */
  async function preencherEEnviar(fetchMock: ReturnType<typeof vi.fn>) {
    const u = userEvent.setup();
    await u.type(screen.getByLabelText(/Endereço/), 'Rua A, 10, Centro, Campinas');
    await u.type(screen.getByLabelText('Dormitórios'), '3');
    await u.click(screen.getByRole('button', { name: /Próximo/ }));
    await u.type(screen.getByLabelText(/Seu nome/), 'Ana');
    await u.type(screen.getByLabelText('WhatsApp *'), '11987654321');
    await u.click(screen.getByRole('button', { name: 'Enviar minha ficha' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/site/anuncie'))).toBe(true));
    const chamada = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/site/anuncie'))!;
    return JSON.parse(String((chamada[1] as RequestInit).body));
  }

  it('desenha o Moderno: título e texto à esquerda, ficha no cartão com os dois passos', async () => {
    await abrir(ROTA, { ...MODERNO, ...ANUNCIE } as SiteInfo);
    expect(paginaModerna('anuncie')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Anuncie com a gente' })).toBeTruthy();
    expect(screen.getByText('O imóvel')).toBeTruthy();
    expect(screen.getByText('Seus dados')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /WhatsApp/ }).length).toBeGreaterThan(0);
  });

  it('manda o mesmo corpo de sempre (só por e-mail, /site/anuncie) e mostra o obrigado', async () => {
    const { fetchMock } = await abrir(ROTA, { ...MODERNO, ...ANUNCIE } as SiteInfo, aceita);
    const corpo = await preencherEEnviar(fetchMock);
    expect(corpo).toEqual({
      lead: {
        name: 'Ana', phone: corpo.lead.phone, email: null, source: 'site',
        form_data: {
          finalidade: '', tipo: '', negocio: '', endereco: 'Rua A, 10, Centro, Campinas',
          condominio_nome: '', condominio_valor: '', area_total: '', area_util: '', dormitorios: '3', suites: '',
          vagas_cobertas: '', vagas_descobertas: '', aceita_financiamento: false, valor_pretendido: '', caracteristicas: '',
          proprietario_nome: 'Ana', proprietario_telefone: corpo.lead.phone, proprietario_email: '',
        },
      },
    });
    expect(corpo.lead.phone.replace(/\D/g, '')).toContain('11987654321');
    expect(await screen.findByText('Recebemos a sua ficha!')).toBeTruthy();
  });

  it('prévia do modelo: não envia nada', async () => {
    window.history.replaceState({}, '', '/?modelo=moderno');
    const { fetchMock } = await abrir(ROTA, ANUNCIE as SiteInfo, aceita);
    expect(paginaModerna('anuncie')).not.toBeNull();
    const u = userEvent.setup();
    await u.type(screen.getByLabelText(/Endereço/), 'Rua A');
    await u.click(screen.getByRole('button', { name: /Próximo/ }));
    await u.type(screen.getByLabelText(/Seu nome/), 'Ana');
    await u.type(screen.getByLabelText('WhatsApp *'), '11987654321');
    await u.click(screen.getByRole('button', { name: 'Enviar minha ficha' }));
    expect(await screen.findByText(TEXTO_ENVIO_NA_PREVIA)).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/site/anuncie'))).toBe(false);
  });

  it('telefone inválido não envia e avisa', async () => {
    const { fetchMock } = await abrir(ROTA, { ...MODERNO, ...ANUNCIE } as SiteInfo, aceita);
    const u = userEvent.setup();
    await u.type(screen.getByLabelText(/Endereço/), 'Rua A');
    await u.click(screen.getByRole('button', { name: /Próximo/ }));
    await u.type(screen.getByLabelText(/Seu nome/), 'Ana');
    await u.type(screen.getByLabelText('WhatsApp *'), '1198');
    await u.click(screen.getByRole('button', { name: 'Enviar minha ficha' }));
    expect(screen.getByText('Digite um telefone válido com DDD.')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/site/anuncie'))).toBe(false);
  });
});

const artigo = (n: number) => ({ id: `a${n}`, title: `Artigo ${n}`, slug: `artigo-${n}`, excerpt: `Resumo ${n}`, cover_image_url: `https://cdn.x/a${n}.jpg`, published_at: '2026-11-01T12:00:00Z', reading_time_minutes: 4 });

describe('Blog no Moderno', () => {
  const ROTA = { caminho: '/portal/imob/blog', padrao: '/portal/:tenant/blog', elemento: <PortalBlogPage /> };
  const artigos = (n: number) => (url: string) => (url.includes('/site/articles') ? resposta({ data: Array.from({ length: n }, (_, i) => artigo(i + 1)), meta: { total: n } }) : null);

  it('o primeiro artigo em destaque e os outros em grade, cada um levando ao artigo', async () => {
    await abrir(ROTA, MODERNO, artigos(4));
    expect(paginaModerna('blog')).not.toBeNull();
    await screen.findByText('Artigo 1');
    const destaque = screen.getByTestId('artigo-em-destaque');
    expect(within(destaque).getByRole('heading', { name: 'Artigo 1' })).toBeTruthy();
    expect(destaque.getAttribute('href')).toBe('/portal/imob/blog/artigo-1');
    const grade = screen.getByTestId('artigos-em-grade');
    expect(grade.querySelectorAll('a')).toHaveLength(3);
  });

  it('sem artigo: a mensagem de hoje', async () => {
    await abrir(ROTA, MODERNO, artigos(0));
    expect(await screen.findByText('Nenhum artigo publicado ainda.')).toBeTruthy();
  });
});

describe('Artigo no Moderno', () => {
  const ROTA = { caminho: '/portal/imob/blog/artigo-1', padrao: '/portal/:tenant/blog/:slug', elemento: <PortalArticlePage /> };
  const imovel = { id: 'p1', code: 'AP1', title: 'Apartamento destaque', transaction_type: 'sale', property_type: 'apartment', listing_kind: 'resale', featured: true, address: { city: 'Campinas' } };
  const dados = (url: string) => {
    if (url.includes('/site/articles/artigo-1')) return resposta({ data: { ...artigo(1), body_html: '<p>Corpo do <strong>artigo</strong>.</p>' } });
    if (url.includes('/site/properties')) return resposta({ data: [imovel], meta: { total: 1 } });
    return null;
  };

  it('coluna de leitura, chamada do WhatsApp na cor principal, imóveis em cartão claro e "Ver todos os artigos"', async () => {
    await abrir(ROTA, MODERNO, dados);
    expect(paginaModerna('artigo')).not.toBeNull();
    expect(await screen.findByRole('heading', { level: 1, name: 'Artigo 1' })).toBeTruthy();
    expect(screen.getByText('artigo').tagName).toBe('STRONG');
    const chamada = screen.getByTestId('chamada-do-artigo');
    expect(within(chamada).getByText('Gostou do conteúdo? Fale com a gente.')).toBeTruthy();
    expect(within(chamada).getByRole('link', { name: /WhatsApp/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Imóveis em destaque' })).toBeTruthy();
    expect(screen.getByText('Apartamento · AP1')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver todos os artigos' }).getAttribute('href')).toBe('/portal/imob/blog');
  });
});

describe('Página própria no Moderno', () => {
  const ROTA = { caminho: '/portal/imob/p/sobre', padrao: '/portal/:tenant/p/:slug', elemento: <PortalCustomPage /> };
  it('coluna de leitura com o HTML do cliente e "Voltar para o início"', async () => {
    await abrir(ROTA, MODERNO, url => (url.includes('/site/pages/sobre') ? resposta({ data: { title: 'Sobre nós', slug: 'sobre', content_html: '<p>Somos <em>daqui</em>.</p>' } }) : null));
    expect(paginaModerna('pagina')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Sobre nós' })).toBeTruthy();
    expect(screen.getByText('daqui').tagName).toBe('EM');
    expect(screen.getByRole('link', { name: /Voltar para o início/ }).getAttribute('href')).toBe('/portal/imob');
  });
  it('página que não existe: o aviso de hoje', async () => {
    await abrir(ROTA, MODERNO, url => (url.includes('/site/pages/sobre') ? resposta({}, false) : null));
    expect(screen.getByText('Página não encontrada.')).toBeTruthy();
  });
});

describe('404 no Moderno', () => {
  it('lista que não existe (/imoveis/...): "404", título e os dois botões', async () => {
    const ROTA = { caminho: '/portal/imob/imoveis/a-venda/casa/xyz', padrao: '/portal/:tenant/imoveis/*', elemento: <PortalSearchPage /> };
    await abrir(ROTA, MODERNO, url => (url.includes('/site/lists/') || url.includes('/site/listas') || url.includes('lista') ? resposta({}, false) : null));
    expect(await screen.findByText('404')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver imóveis' }).getAttribute('href')).toBe('/portal/imob/imoveis');
    expect(screen.getByRole('link', { name: 'Ir para o início' }).getAttribute('href')).toBe('/portal/imob');
  });
  it('sem site (404 do domínio): continua a de hoje', () => {
    render(<PaginaNaoEncontrada />);
    expect(screen.queryByText('404')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeTruthy();
  });
});

describe('Manutenção no Moderno', () => {
  it('fundo e cartão do Moderno, mesmo texto, título da aba e noindex', () => {
    const site = { name: 'Imob', contact: { whatsapp: '11999990000' }, ...MODERNO } as SiteInfo;
    const { container } = render(<PaginaManutencao site={site} />);
    expect(container.querySelector('[data-pagina-moderna="manutencao"]')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Estamos atualizando nosso site. Volte em breve.' })).toBeTruthy();
    expect(document.title).toBe('Imob — Em manutenção');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    expect(screen.getByRole('link', { name: /Falar no WhatsApp/ })).toBeTruthy();
  });
});

describe('404 do domínio sem peso extra', () => {
  it('PaginaNaoEncontrada não importa nada do site (o domínio carrega ela logo de cara, inclusive nas landings)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fonte = readFileSync(join(process.cwd(), 'src/pages/Public/PaginaNaoEncontrada.tsx'), 'utf8');
    const imports = fonte.split('\n').filter(l => l.startsWith('import '));
    expect(imports).toEqual(["import { useEffect } from 'react';"]);
  });
});
