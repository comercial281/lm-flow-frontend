import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const update = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { update } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

// ⚠️ vi.hoisted: os vi.mock sobem pro topo do arquivo, então o marcador precisa subir junto
// (e sem JSX, que ainda não tem o runtime importado nesse ponto).
const marcador = vi.hoisted(() => async (nome: string) => {
  const { createElement: h } = await import('react');
  return {
    default: ({ gravar }: { gravar: (m: Record<string, unknown>) => Promise<boolean> }) => h('div', null,
      h('p', null, `página ${nome}`),
      h('button', {
        type: 'button',
        onClick: () => void gravar({ greeting: 'Oi' }).catch((e: Error) => { (window as unknown as { erro: string }).erro = e.message; }),
      }, 'gravar greeting')),
  };
});
vi.mock('./paginas/Canal', () => marcador('canal'));
vi.mock('./paginas/Horario', () => marcador('horario'));
vi.mock('./paginas/Identidade', () => marcador('identidade'));
vi.mock('./paginas/Abertura', () => marcador('abertura'));
vi.mock('./paginas/Intencao', () => marcador('intencao'));
vi.mock('./paginas/Personalidade', () => marcador('personalidade'));
vi.mock('./paginas/Qualificacao', () => marcador('qualificacao'));
vi.mock('./paginas/Catalogo', () => marcador('catalogo'));
vi.mock('./paginas/Restricoes', () => marcador('restricoes'));
vi.mock('./paginas/Objetivo', () => marcador('objetivo'));
vi.mock('./paginas/Criterio', () => marcador('criterio'));
vi.mock('./paginas/Destino', () => marcador('destino'));
vi.mock('./paginas/Funil', () => marcador('funil'));
vi.mock('./paginas/Agendamento', () => marcador('agendamento'));
vi.mock('./paginas/Followup', () => marcador('followup'));

import ConfigurarPaginas from './ConfigurarPaginas';
import { esquecerSalvos } from './useGravarNaHora';

function Endereco() {
  return <output aria-label="endereço">{useLocation().search}</output>;
}

// Sem pendência nenhuma além das que cada teste põe.
const completa = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({
  lead_facing_name: 'Bia', persona_kind: 'assistant', handoff_target: 'roleta', handoff_roleta_config_id: 'r1', ...extra,
});

function abrir(agent: SalesAgent, url = '/ia-vendedora?ia=ia-1&tela=configurar') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/ia-vendedora" element={<><ConfigurarPaginas agent={agent} inboxes={[]} aoSalvo={vi.fn()} diagnostico={null} /><Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const endereco = () => screen.getByLabelText('endereço').textContent;

beforeEach(() => { update.mockReset(); esquecerSalvos(); });

describe('ConfigurarPaginas', () => {
  it('trilho com os 5 grupos e as 15 páginas; o grupo é um grupo nomeado', () => {
    abrir(completa());
    const trilho = screen.getByRole('navigation', { name: 'Páginas da configuração' });
    ['Atendimento', 'Introdução', 'Conversa', 'Repasse', 'Follow-up'].forEach((g) => expect(within(trilho).getByRole('group', { name: g })).toBeInTheDocument());
    expect(within(trilho).getAllByRole('button')).toHaveLength(15);
  });

  it('sem ?pagina=, abre na primeira com pendência e escreve no endereço', () => {
    abrir(completa({ inbox_id: null }));
    expect(screen.getByText('página canal')).toBeInTheDocument();
    expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=canal');
  });

  it('cabeçalho único: grupo, título e frase da página (sem "Passo N de 8")', () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=destino');
    const titulo = screen.getByRole('heading', { level: 1, name: 'Destino' });
    const cabecalho = within(titulo.closest('header')!);
    expect(cabecalho.getByText('Repasse')).toBeInTheDocument();
    expect(cabecalho.getByText('Pra quem o lead vai e o que vai junto.')).toBeInTheDocument();
    expect(screen.queryByText(/Passo \d de 8/)).toBeNull();
  });

  it('clicar no trilho troca a página e marca aria-current', async () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=canal');
    await userEvent.click(screen.getByRole('button', { name: /^Critério/ }));
    expect(screen.getByText('página criterio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Critério/ })).toHaveAttribute('aria-current', 'page');
    expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=criterio');
  });

  it('pendência aparece como bolinha com texto pro leitor de tela', () => {
    abrir(completa({ lead_facing_name: null }), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=canal');
    expect(screen.getByRole('button', { name: /Identidade.*tem pendência/ })).toBeInTheDocument();
  });

  it('Agendamento com cadeado quando o objetivo não é visita, mas abre (a página explica)', async () => {
    abrir(completa({ reach: 'qualify' }), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=canal');
    const item = screen.getByRole('button', { name: /Agendamento.*só com o objetivo Agendar visita/ });
    await userEvent.click(item);
    expect(screen.getByText('página agendamento')).toBeInTheDocument();
  });

  // Bug (a): o trilho acompanha a rolagem (não dá pra medir no jsdom; confere a classe).
  it('o trilho é o único sticky e tem rolagem própria só se passar da tela', () => {
    abrir(completa());
    const trilho = screen.getByRole('navigation', { name: 'Páginas da configuração' });
    expect(trilho.className).toMatch(/lg:sticky/);
    expect(trilho.className).toMatch(/lg:self-start/);
    expect(trilho.className).toMatch(/lg:overflow-y-auto/);
  });

  it('a página não grava campo que não é dela', async () => {
    abrir(completa(), '/ia-vendedora?ia=ia-1&tela=configurar&pagina=canal');
    await userEvent.click(screen.getByRole('button', { name: 'gravar greeting' }));
    await vi.waitFor(() => expect((window as unknown as { erro?: string }).erro).toMatch(/canal não grava greeting/));
    expect(update).not.toHaveBeenCalled();
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Bug (b): nada dentro do meio pode grudar ou rolar sozinho — a rolagem é uma só (a do main).
describe('rolagem do meio', () => {
  it('nenhuma página e nenhuma peça do Configurar usa sticky, BarraSalvar ou rolagem própria', () => {
    const pasta = join(__dirname, 'paginas');
    readdirSync(pasta).filter((f) => f.endsWith('.tsx') && !f.includes('.spec.')).forEach((f) => {
      const fonte = readFileSync(join(pasta, f), 'utf8');
      expect(fonte, f).not.toMatch(/\bsticky\b|BarraSalvar|overflow-(y-)?(auto|scroll)/);
    });
  });
});
