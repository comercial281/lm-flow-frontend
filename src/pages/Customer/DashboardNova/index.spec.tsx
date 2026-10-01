// src/pages/Customer/DashboardNova/index.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { FiltrosDashboard, ListaKind } from './types';
import type { PodeAbrir } from './usePodeAbrir';

const hook = vi.hoisted(() => ({
  dados: null as unknown,
  carregando: false,
  pendente: false,
  erro: null as string | null,
  /** O Funil tem pedido próprio: o erro dele é outro. */
  erroFunil: null as string | null,
  recarregar: vi.fn(),
  chamadas: [] as { filtros: FiltrosDashboard; blocos: string[] }[],
}));
vi.mock('./useDashboardNova', async orig => ({
  ...(await orig<typeof import('./useDashboardNova')>()),
  useDashboardNova: (filtros: FiltrosDashboard, blocos: string[]) => {
    hook.chamadas.push({ filtros, blocos });
    const erro = blocos.includes('pipeline') ? hook.erroFunil : hook.erro;
    return { dados: hook.dados, carregando: hook.carregando, pendente: hook.pendente, erro, recarregar: hook.recarregar };
  },
}));
const PODE = vi.hoisted(() => ({ imoveis: true, agenda: true, propostas: true, funil: true, roleta: false, conversas: true }));
vi.mock('./usePodeAbrir', async orig => ({
  ...(await orig<typeof import('./usePodeAbrir')>()),
  usePodeAbrir: () => PODE,
}));
// Gestor = tem `dashboard.team` (Administrador e Gerente; o Corretor não tem).
const cargo = vi.hoisted(() => ({ gestor: true }));
vi.mock('@/hooks/useCan', () => ({
  useCan: () => (recurso: string, acao: string) => cargo.gestor && recurso === 'dashboard' && acao === 'team',
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Rafael Teste' } }) }));
vi.mock('@/contexts/PendingOffersContext', () => ({ usePendingOffers: () => ({ offers: [] }) }));

const cab = vi.hoisted(() => ({ props: null as null | { scope?: unknown; carregando: boolean; filtros: FiltrosDashboard } }));
vi.mock('./Cabecalho', async orig => ({
  ...(await orig<typeof import('./Cabecalho')>()),
  Cabecalho: (p: { nome: string; scope?: unknown; carregando: boolean; filtros: FiltrosDashboard }) => {
    cab.props = p;
    return <h1>{p.nome}</h1>;
  },
}));

interface PropsLista {
  aberta: boolean; kind: ListaKind | null; titulo: string; pode: PodeAbrir; limitado?: boolean; onFechar: () => void;
}
const lista = vi.hoisted(() => ({ props: null as null | PropsLista }));
vi.mock('./ListaRapida', () => ({
  ListaRapida: (p: PropsLista) => { lista.props = p; return null; },
}));
vi.mock('./blocos/RoletaAgora', () => ({ RoletaAgora: () => <div>Bloco Roleta agora</div> }));

import DashboardNova from './index';
import { paramsDaApi } from './useDashboardNova';

const base = (mode: 'all' | 'mine', locked = false, extra: Record<string, unknown> = {}) => ({
  period: { preset: 'last_7_days', since: '2026-09-24T00:00:00-03:00', until: '2026-09-30T23:59:59-03:00' },
  scope: { mode, locked, owner_id: null, available_modes: locked ? ['mine'] : ['all', 'mine'], blocks: { media_spend: false, operations: false } },
  pending: { rows: [] },
  ...extra,
});

const tela = () => render(<MemoryRouter><DashboardNova /></MemoryRouter>);

describe('DashboardNova', () => {
  beforeEach(() => {
    hook.dados = null;
    hook.carregando = false;
    hook.pendente = false;
    hook.erro = null;
    hook.erroFunil = null;
    hook.recarregar.mockReset();
    hook.chamadas = [];
    cargo.gestor = true;
    cab.props = null;
    lista.props = null;
  });

  it('gestor vê a análise; o espaço do banner existe e está vazio', () => {
    hook.dados = base('all');
    const { container } = tela();
    expect(screen.getByText('Análise do período')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="banner"]')).toBeEmptyDOMElement();
  });

  it('Roleta agora fica nas linhas do gestor, não nas do corretor', () => {
    hook.dados = base('all');
    const { unmount } = tela();
    expect(screen.getByText('Bloco Roleta agora')).toBeInTheDocument();
    unmount();
    hook.dados = base('mine', true);
    tela();
    expect(screen.queryByText('Bloco Roleta agora')).not.toBeInTheDocument();
  });

  it('gestor em "Só os meus" vê o aviso e a tela do corretor', () => {
    hook.dados = base('mine', false);
    tela();
    expect(screen.getByText(/Você está vendo a Dashboard como um corretor vê/)).toBeInTheDocument();
    expect(screen.queryByText('Análise do período')).not.toBeInTheDocument();
    expect(screen.getByText('Suas pendências')).toBeInTheDocument();
  });

  it('"Voltar para a imobiliária" pede a imobiliária inteira', () => {
    hook.dados = base('mine', false);
    tela();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para a imobiliária' }));
    expect(cab.props?.filtros.scope).toBe('all');
  });

  it('o gerente (sem a imobiliária) volta para o time, e o botão diz isso', () => {
    hook.dados = base('mine', false);
    (hook.dados as { scope: { available_modes: string[] } }).scope.available_modes = ['mine', 'team'];
    tela();
    expect(screen.queryByRole('button', { name: 'Voltar para a imobiliária' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para o meu time' }));
    expect(cab.props?.filtros.scope).toBe('team');
  });

  it('o corretor de verdade (travado) não vê o aviso', () => {
    hook.dados = base('mine', true);
    tela();
    expect(screen.queryByText(/como um corretor vê/)).not.toBeInTheDocument();
  });

  it('o corretor de verdade num cliente sem isolamento (não travado) também não vê o aviso', () => {
    cargo.gestor = false;
    hook.dados = base('mine', false);
    tela();
    expect(screen.queryByText(/como um corretor vê/)).not.toBeInTheDocument();
    expect(screen.getByText('Suas pendências')).toBeInTheDocument();
  });

  it('o Cabecalho recebe o MESMO scope da resposta e o "pendente" como carregando', () => {
    hook.dados = base('all');
    hook.carregando = false;
    hook.pendente = true;
    tela();
    expect(cab.props?.scope).toBe((hook.dados as { scope: unknown }).scope);
    expect(cab.props?.carregando).toBe(true);
  });

  it('primeira carga: esqueleto neutro, sem os blocos do gestor', () => {
    hook.carregando = true;
    hook.pendente = true;
    tela();
    expect(screen.getByRole('status', { name: 'Carregando os números' })).toBeInTheDocument();
    expect(screen.queryByText('Pendências')).not.toBeInTheDocument();
    expect(screen.queryByText('Análise do período')).not.toBeInTheDocument();
    expect(screen.queryByText('Bloco Roleta agora')).not.toBeInTheDocument();
  });

  it('erro sem resposta nenhuma: estado de erro com Tentar de novo', () => {
    hook.erro = 'Não consegui carregar a Dashboard.';
    tela();
    expect(screen.getByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText('Análise do período')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(hook.recarregar).toHaveBeenCalled();
  });

  it('erro com resposta antiga: avisa em cima dos blocos que os números são da última vez', () => {
    hook.dados = base('all');
    hook.erro = 'Não consegui carregar a Dashboard.';
    hook.pendente = true;
    tela();
    expect(screen.getByText('Não deu para atualizar. Os números abaixo são da última vez.')).toBeInTheDocument();
    expect(screen.getByText('Análise do período')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(hook.recarregar).toHaveBeenCalled();
  });

  it('pendência abre a lista rápida com o tipo, o que abre e o teto da linha', () => {
    hook.dados = base('all', false, {
      pending: { rows: [
        { key: 'esperando_resposta', total: 500, older: 0, capped: true },
        { key: 'sem_contato', total: 3, older: 0 },
      ] },
    });
    tela();
    expect(lista.props?.aberta).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Esperando resposta há mais de 1 h/ }));
    expect(lista.props).toMatchObject({ aberta: true, kind: 'esperando_resposta', limitado: true });
    expect(lista.props?.pode).toBe(PODE);

    fireEvent.click(screen.getByRole('button', { name: /Sem contato do corretor/ }));
    expect(lista.props).toMatchObject({ aberta: true, kind: 'sem_contato', limitado: false });
  });

  it('fechar a lista mantém o tipo e o título enquanto o painel sai', () => {
    hook.dados = base('all', false, { pending: { rows: [{ key: 'sem_contato', total: 3, older: 0 }] } });
    tela();
    fireEvent.click(screen.getByRole('button', { name: /Sem contato do corretor/ }));
    act(() => { lista.props?.onFechar(); });
    expect(lista.props).toMatchObject({ aberta: false, kind: 'sem_contato', titulo: 'Sem contato do corretor há mais de 3 dias' });
  });

  it('trocar de funil só refaz o pedido do funil, não o dos outros blocos', () => {
    hook.dados = base('all', false, {
      pipeline: {
        pipeline: { id: 'p1', name: 'Vendas' },
        pipelines: [{ id: 'p1', name: 'Vendas' }, { id: 'p2', name: 'Locação' }],
        stages: [{ id: 'e1', name: 'Novo', color: '#000', position: 1, entered: 3, current: 48 }],
      },
    });
    tela();
    const ultimo = (funil: boolean) =>
      [...hook.chamadas].reverse().find(c => c.blocos.includes('pipeline') === funil)!;
    const antes = JSON.stringify(paramsDaApi(ultimo(false).filtros));
    expect(ultimo(true).blocos).toEqual(['pipeline']);

    fireEvent.change(screen.getByRole('combobox', { name: 'Funil' }), { target: { value: 'p2' } });
    expect(JSON.stringify(paramsDaApi(ultimo(false).filtros))).toBe(antes);
    expect(ultimo(false).filtros.pipelineId).toBeUndefined();
    expect(ultimo(true).filtros.pipelineId).toBe('p2');
  });

  it('enquanto os números novos não chegam, a área dos blocos avisa que está ocupada e fica esmaecida', () => {
    hook.dados = base('all');
    hook.pendente = true;
    const { container, unmount } = tela();
    const area = container.querySelector('.lmfn-blocos') as HTMLElement;
    expect(area).toHaveAttribute('aria-busy', 'true');
    expect(area).toHaveClass('lmfn-blocos-pendente');
    unmount();

    hook.pendente = false;
    const outra = tela().container.querySelector('.lmfn-blocos') as HTMLElement;
    expect(outra).not.toHaveAttribute('aria-busy');
    expect(outra).not.toHaveClass('lmfn-blocos-pendente');
  });

  it('títulos em ordem: h1 na página, h2 nos blocos e na seção, h3 nos cartões da Análise do período', () => {
    hook.dados = base('all', false, { pending: { rows: [{ key: 'sem_contato', total: 3, older: 0 }] } });
    tela();
    expect(screen.getByRole('heading', { level: 2, name: 'Análise do período' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Pendências' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Leads por horário' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'De onde vêm os leads' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Leads por dia da semana' })).not.toBeInTheDocument();
  });

  it('fora de seção (tela do corretor), o cartão de leads por dia da semana é h2', () => {
    hook.dados = base('mine', true);
    tela();
    expect(screen.getByRole('heading', { level: 2, name: 'Seus leads por dia da semana' })).toBeInTheDocument();
  });
});
