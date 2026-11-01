import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const update = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { update, get } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

// ⚠️ vi.hoisted: os vi.mock sobem pro topo do arquivo, então o marcador precisa subir junto
// (e sem JSX, que ainda não tem o runtime importado nesse ponto).
const marcador = vi.hoisted(() => async (nome: string) => {
  const { createElement: h } = await import('react');
  return {
    default: ({ gravar, aoChaveGerada }: { gravar: (m: Record<string, unknown>) => Promise<boolean>; aoChaveGerada?: () => void }) => h('div', null,
      h('p', null, `página ${nome}`),
      h('button', { type: 'button', onClick: () => aoChaveGerada?.() }, 'chave gerada'),
      h('button', {
        type: 'button',
        onClick: () => void gravar({ greeting: 'Oi' }).catch((e: Error) => { (window as unknown as { erro: string }).erro = e.message; }),
      }, 'gravar greeting'),
      h('button', {
        type: 'button',
        onClick: () => void gravar({ persona_kind: 'broker' }).catch((e: Error) => { (window as unknown as { erro: string }).erro = e.message; }),
      }, 'gravar persona')),
  };
});
vi.mock('./paginas/ModoOperante', () => marcador('modo'));
vi.mock('./paginas/NumerosEUsuarios', () => marcador('numeros'));
vi.mock('./paginas/PublicoEProduto', () => marcador('publico'));
vi.mock('./paginas/CampanhasEGatilhos', () => marcador('campanhas'));
vi.mock('./paginas/Conducao', () => marcador('conducao'));
vi.mock('./paginas/Materiais', () => marcador('materiais'));
vi.mock('./paginas/Destino', () => marcador('destino'));
vi.mock('./paginas/FunilEFollowup', () => marcador('funil'));

import ConfigurarPaginas from './ConfigurarPaginas';
import { esquecerSalvos } from './useGravarNaHora';

function Endereco() {
  const voltar = useNavigate();
  const tipo = useNavigationType();
  return <><output aria-label="endereço">{useLocation().search}</output><output aria-label="tipo de navegação">{tipo}</output><button type="button" onClick={() => voltar(-1)}>voltar do navegador</button></>;
}

// Sem pendência nenhuma além das que cada teste põe.
const completa = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({
  lead_facing_name: 'Bia', persona_kind: 'assistant', handoff_target: 'roleta', handoff_roleta_config_id: 'r1', ...extra,
});

function abrir(agent: SalesAgent, url = '/ia-vendedora?ia=ia-1&tela=configurar', aoSalvo = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/ia-vendedora" element={<><ConfigurarPaginas agent={agent} inboxes={[]} aoSalvo={aoSalvo} diagnostico={null} /><Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const tipoDeNavegacao = () => screen.getByLabelText('tipo de navegação').textContent;
const endereco = () => screen.getByLabelText('endereço').textContent;

beforeEach(() => { update.mockReset(); get.mockReset(); esquecerSalvos(); (window as unknown as { erro?: string }).erro = undefined; });

describe('ConfigurarPaginas', () => {
  it('índice com as 8 páginas, na ordem, sem rótulo de grupo repetido', () => {
    abrir(completa());
    const indice = screen.getByRole('navigation', { name: 'Páginas da configuração' });
    expect(within(indice).getAllByRole('button').map((b) => b.textContent?.replace('(tem pendência)', '').trim())).toEqual([
      'Modo operante', 'Números e usuários', 'Público-alvo e produto', 'Campanhas e gatilhos', 'Condução', 'Materiais', 'Destino', 'Funil e follow-up',
    ]);
  });

  it('sem ?pagina=, abre na primeira com pendência e escreve no endereço', () => {
    abrir(completa({ inbox_id: null }));
    expect(screen.getByText('página numeros')).toBeInTheDocument();
    expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=numeros');
  });

  it('sem pendência nenhuma abre em Modo operante', () => {
    abrir(completa());
    expect(screen.getByText('página modo')).toBeInTheDocument();
    expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=modo');
  });

  // Revisão final da onda 3 (M1): o RR7 troca o endereço em transição, então o
  // Configurar pode renderizar com o endereço velho, antes da casca traduzir.
  it('?passo=3 antigo abre a Condução e não é trocado pela página inicial', () => {
    abrir(completa({ inbox_id: null }), '/ia-vendedora?ia=ia-1&tela=configurar&passo=3');
    expect(screen.getByText('página conducao')).toBeInTheDocument();
    expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=conducao');
  });

  it('?pagina=objetivo (antigo) vira modo, com replace: o Voltar não volta pro endereço velho', async () => {
    abrir(completa({ inbox_id: null }), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=objetivo');
    expect(screen.getByText('página modo')).toBeInTheDocument();
    expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=modo');
    expect(tipoDeNavegacao()).toBe('REPLACE');
  });

  it('cada endereço antigo abre a página nova certa', () => {
    const casos: [string, string][] = [['canal', 'numeros'], ['horario', 'numeros'], ['identidade', 'numeros'], ['abertura', 'conducao'],
      ['personalidade', 'conducao'], ['qualificacao', 'conducao'], ['restricoes', 'conducao'], ['intencao', 'publico'], ['catalogo', 'publico'],
      ['criterio', 'modo'], ['agendamento', 'modo'], ['followup', 'funil']];
    casos.forEach(([antiga, nova]) => {
      const { unmount } = render(
        <MemoryRouter initialEntries={[`/ia-vendedora?ia=ia-1&tela=configurar&pagina=${antiga}`]}>
          <Routes><Route path="/ia-vendedora" element={<ConfigurarPaginas agent={completa()} inboxes={[]} aoSalvo={vi.fn()} diagnostico={null} />} /></Routes>
        </MemoryRouter>,
      );
      expect(screen.getByText(`página ${nova}`), antiga).toBeInTheDocument();
      unmount();
    });
  });

  it('?pagina= com nome da cadeia do objeto (constructor) não quebra: abre a página inicial', () => {
    abrir(completa({ inbox_id: null }), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=constructor');
    expect(screen.getByText('página numeros')).toBeInTheDocument();
    expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=numeros');
  });

  // Revisão final da onda 3 (M2): o registro do "último salvo" reconhece a cópia
  // otimista pela identidade. Chave gerada entra pela IA relida do servidor, nunca
  // por uma cópia montada aqui.
  it('chave do sistema do cliente gerada: a IA que sobe é a relida do servidor, não uma cópia', async () => {
    const relida = completa({ handoff_webhook_secret_set: true, handoff_webhook_secret_state: 'ready', updated_at: '2026-10-06T12:00:00Z' });
    get.mockResolvedValue(relida);
    const aoSalvo = vi.fn();
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=destino', aoSalvo);
    await userEvent.click(screen.getByRole('button', { name: 'chave gerada' }));
    expect(get).toHaveBeenCalledWith('ia-1');
    expect(aoSalvo).toHaveBeenCalledTimes(1);
    expect(aoSalvo.mock.calls[0][0]).toBe(relida);
  });

  it('cabeçalho único: título e frase da página (sem "Passo N de 8")', () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=destino');
    const titulo = screen.getByRole('heading', { level: 1, name: 'Destino' });
    const cabecalho = within(titulo.closest('header')!);
    expect(cabecalho.getByText('Pra quem o lead vai, onde o atendimento continua e o que acontece depois.')).toBeInTheDocument();
    expect(screen.queryByText(/Passo \d de 8/)).toBeNull();
  });

  it('clicar no índice troca a página (empurra no histórico) e marca aria-current', async () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=modo');
    await userEvent.click(screen.getByRole('button', { name: /^Condução/ }));
    expect(screen.getByText('página conducao')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Condução/ })).toHaveAttribute('aria-current', 'page');
    expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=conducao');
    expect(tipoDeNavegacao()).toBe('PUSH');
    await userEvent.click(screen.getByRole('button', { name: 'voltar do navegador' }));
    expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=modo');
  });

  it('"Próxima →" empurra no histórico e "← Anterior" volta uma página', async () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=modo');
    await userEvent.click(screen.getByRole('button', { name: 'Próxima → Números e usuários' }));
    expect(screen.getByText('página numeros')).toBeInTheDocument();
    expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=numeros');
    expect(tipoDeNavegacao()).toBe('PUSH');
    await userEvent.click(screen.getByRole('button', { name: 'voltar do navegador' }));
    expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=modo');
  });

  it('a primeira página não tem "← Anterior" e a última não tem "Próxima →"', async () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=modo');
    expect(screen.queryByRole('button', { name: /^← Anterior/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Próxima → Números e usuários' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Funil e follow-up/ }));
    expect(screen.queryByRole('button', { name: /^Próxima →/ })).toBeNull();
    expect(screen.getByRole('button', { name: '← Anterior Destino' })).toBeInTheDocument();
  });

  it('pendência aparece como bolinha com texto pro leitor de tela, na página nova', () => {
    abrir(completa({ persona_kind: 'broker', number_owner_id: null, handoff_target: 'number_owner' }), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=modo');
    expect(screen.getByRole('button', { name: /Números e usuários.*tem pendência/ })).toBeInTheDocument();
  });

  it('a área é UM Card com título e frase dentro; a página entrega blocos, não caixa', () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=destino');
    const card = screen.getByRole('heading', { level: 1, name: 'Destino' }).closest('[data-slot="card"]')!;
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('página destino')).toBeInTheDocument();
  });

  it('o índice é o único sticky e tem rolagem própria só se passar da tela', () => {
    abrir(completa());
    const indice = screen.getByRole('navigation', { name: 'Páginas da configuração' });
    expect(indice.className).toMatch(/lg:sticky/);
    expect(indice.className).toMatch(/lg:self-start/);
    expect(indice.className).toMatch(/lg:overflow-y-auto/);
    expect(document.querySelectorAll('[class*="sticky"]')).toHaveLength(1);
  });

  it('a página não grava campo que não é dela', async () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=numeros');
    await userEvent.click(screen.getByRole('button', { name: 'gravar greeting' }));
    await vi.waitFor(() => expect((window as unknown as { erro?: string }).erro).toMatch(/numeros não grava greeting/));
    expect(update).not.toHaveBeenCalled();
  });

  it('campo que a tela esconde nunca vai pro servidor', async () => {
    abrir(completa({ persona_kind: 'broker' }), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=conducao');
    await userEvent.click(screen.getByRole('button', { name: 'gravar persona' }));
    await vi.waitFor(() => expect((window as unknown as { erro?: string }).erro).toMatch(/persona_kind saiu da tela/));
    expect(update).not.toHaveBeenCalled();
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Bug (b): nada dentro do meio pode grudar ou rolar sozinho — a rolagem é uma só (a do main).
// Vale pra TODO .tsx do configurar/ (páginas e peças), menos o ConfigurarPaginas, que monta
// o trilho. O trilho (o único sticky) mora em moldura/PaginasComTrilho desde 11/10, e as
// páginas do Ensinar (telas/ensinar) também gravam na hora, sem Salvar.
function tsxDoConfigurar(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const cheio = join(dir, nome);
    if (statSync(cheio).isDirectory()) return tsxDoConfigurar(cheio);
    return nome.endsWith('.tsx') && !nome.includes('.spec.') ? [cheio] : [];
  });
}

describe('rolagem do meio', () => {
  it('nenhuma página e nenhuma peça do Configurar usa sticky, BarraSalvar ou rolagem própria', () => {
    const arquivos = tsxDoConfigurar(__dirname).filter((a) => !a.endsWith(`${sep}ConfigurarPaginas.tsx`));
    expect(arquivos.length).toBeGreaterThan(15);
    arquivos.forEach((a) => {
      expect(readFileSync(a, 'utf8'), relative(__dirname, a)).not.toMatch(/\bsticky\b|BarraSalvar|overflow-(y-)?(auto|scroll)/);
    });
  });
});
