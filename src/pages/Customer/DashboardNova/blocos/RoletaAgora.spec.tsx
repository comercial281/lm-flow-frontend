// src/pages/Customer/DashboardNova/blocos/RoletaAgora.spec.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const getQueue = vi.fn();
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({ roletaConfigService: { getQueue: () => getQueue() } }));

import { RoletaAgora } from './RoletaAgora';
import type { ContextoBloco } from '../usePodeAbrir';

const pode = { imoveis: true, agenda: true, propostas: true, funil: true, roleta: true, conversas: true };
const ctx = (over: Partial<ContextoBloco> = {}): ContextoBloco =>
  ({ dados: null, carregando: false, visao: 'gestor', pode, abrirLista: vi.fn(), mudarFunil: vi.fn(), ...over });

const membro = (nome: string, extra = {}) => ({ user_id: nome, nome, peso: 1, ativo: true, sem_acesso_a_instancia: false, chance_pct: null, proximo: false, segurando_agora: 0, ultimo_lead_em: null, ...extra });
const roleta = (id: string, nome: string, extra = {}) => ({ id, nome, instancia: id, modo: 'fila', ativa: true, prazo_minutos: 10, membros: [membro(`${nome}-membro`)], ...extra });
const resposta = (roletas: unknown[], aguardando: unknown[] = []) => ({ gerado_em: '', resumo: { aguardando: aguardando.length, atrasadas: 0, roletas_ativas: roletas.length }, aguardando, roletas });
const oferta = (id: string, extra = {}) => ({ id, lead: 'Fulano', lead_telefone: null, contact_id: 'c1', conversation_id: null, conversation_display_id: null, corretor: { id: 'Ana', nome: 'Ana' }, instancia: 'principal', modo: 'fila', atribuido_em: '', prazo_minutos: 10, minutos_restantes: 7, sem_prazo: false, estourou: false, rodada: 1, ja_passaram: [], ...extra });

// Monta e deixa a primeira busca responder dentro do act.
const montar = async (c: ContextoBloco) => {
  let r!: ReturnType<typeof render>;
  await act(async () => { r = render(<RoletaAgora {...c} />); });
  return r;
};

const mudarVisibilidade = (estado: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('RoletaAgora', () => {
  beforeEach(() => {
    getQueue.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Só desfaz a troca, sem disparar o evento: o bloco do teste ainda pode estar montado.
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('na Fila, destaca o próximo e passa de uma roleta para outra', async () => {
    getQueue.mockResolvedValue(resposta(
      [
        { id: 'r1', nome: 'Vendas', instancia: 'principal', modo: 'fila', ativa: true, prazo_minutos: 10, membros: [membro('Ana', { segurando_agora: 1 }), membro('Bruno', { proximo: true }), membro('Carla', { ativo: false }), membro('Davi', { sem_acesso_a_instancia: true })] },
        { id: 'r2', nome: 'Locação', instancia: 'locacao', modo: 'rodizio', ativa: true, prazo_minutos: 10, membros: [membro('Diego', { chance_pct: 100 })] },
      ],
      [oferta('o1')],
    ));
    await montar(ctx());

    expect(screen.getByText('Vendas')).toBeInTheDocument();
    expect(screen.getByText('Fila')).toBeInTheDocument();
    expect(screen.getByText('Próximo')).toBeInTheDocument();
    expect(screen.getByText('Pausado')).toBeInTheDocument();
    expect(screen.getByText('Sem acesso ao número')).toBeInTheDocument();
    expect(screen.getByText('Segurando 1 lead agora')).toBeInTheDocument();
    expect(screen.getByText(/faltam 7 min/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roleta anterior' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima roleta' }));
    expect(screen.getByText('Locação')).toBeInTheDocument();
    expect(screen.getByText('Rodízio')).toBeInTheDocument();
    expect(screen.getByText(/100%/)).toBeInTheDocument();
    // A oferta é da outra roleta (outro número): não aparece aqui.
    expect(screen.queryByText(/faltam 7 min/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima roleta' })).toBeDisabled();
  });

  it('a oferta diz "sem prazo" ou "prazo estourado"', async () => {
    getQueue.mockResolvedValue(resposta(
      [roleta('principal', 'Vendas')],
      [oferta('o1', { lead: 'Fulano', sem_prazo: true, minutos_restantes: null }), oferta('o2', { lead: 'Beltrano', estourou: true, minutos_restantes: 0 })],
    ));
    await montar(ctx());
    expect(screen.getByText('sem prazo')).toBeInTheDocument();
    expect(screen.getByText('prazo estourado')).toBeInTheDocument();
  });

  it('com o id da roleta na oferta, números com o mesmo nome não misturam as ofertas', async () => {
    getQueue.mockResolvedValue(resposta(
      [roleta('r1', 'Vendas', { instancia: 'principal' }), roleta('r2', 'Locação', { instancia: 'principal' })],
      [oferta('o1', { lead: 'Fulano', roleta_config_id: 'r1' }), oferta('o2', { lead: 'Beltrano', roleta_config_id: 'r2' })],
    ));
    await montar(ctx());
    expect(screen.getByText('Fulano')).toBeInTheDocument();
    expect(screen.queryByText('Beltrano')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima roleta' }));
    expect(screen.getByText('Beltrano')).toBeInTheDocument();
    expect(screen.queryByText('Fulano')).not.toBeInTheDocument();
  });

  it('com uma roleta só, não tem setas', async () => {
    getQueue.mockResolvedValue(resposta([roleta('r1', 'Vendas'), roleta('r2', 'Antiga', { ativa: false })]));
    await montar(ctx());
    expect(screen.getByText('Vendas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Próxima roleta' })).not.toBeInTheDocument();
    expect(screen.queryByText('Antiga')).not.toBeInTheDocument();
  });

  it('sem roleta ativa, não aparece', async () => {
    getQueue.mockResolvedValue(resposta([roleta('r1', 'Antiga', { ativa: false })]));
    const { container } = await montar(ctx());
    expect(getQueue).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });

  it('não aparece para o corretor nem sem a permissão', () => {
    const { container: c1 } = render(<RoletaAgora {...ctx({ visao: 'corretor' })} />);
    expect(c1).toBeEmptyDOMElement();
    const { container: c2 } = render(<RoletaAgora {...ctx({ pode: { ...pode, roleta: false } })} />);
    expect(c2).toBeEmptyDOMElement();
    expect(getQueue).not.toHaveBeenCalled();
  });

  it('atualiza a cada 30 s só com a aba visível, e busca de novo quando a aba volta', async () => {
    vi.useFakeTimers();
    getQueue.mockResolvedValue(resposta([roleta('r1', 'Vendas')]));
    await montar(ctx());
    expect(getQueue).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(getQueue).toHaveBeenCalledTimes(2);

    act(() => { mudarVisibilidade('hidden'); });
    await act(async () => { vi.advanceTimersByTime(90_000); });
    expect(getQueue).toHaveBeenCalledTimes(2);

    await act(async () => { mudarVisibilidade('visible'); });
    expect(getQueue).toHaveBeenCalledTimes(3);
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(getQueue).toHaveBeenCalledTimes(4);
  });

  it('para de buscar ao sair da tela e ignora a resposta que chega depois', async () => {
    vi.useFakeTimers();
    let responder: (v: unknown) => void = () => {};
    getQueue.mockImplementation(() => new Promise(r => { responder = r; }));
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<RoletaAgora {...ctx()} />);
    expect(getQueue).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { responder(resposta([roleta('r1', 'Vendas')])); });
    await act(async () => { vi.advanceTimersByTime(120_000); });
    expect(getQueue).toHaveBeenCalledTimes(1);
    mudarVisibilidade('visible');
    expect(getQueue).toHaveBeenCalledTimes(1);
    expect(erro).not.toHaveBeenCalled();
    erro.mockRestore();
  });

  it('a roleta da tela continua a mesma quando a lista muda de ordem, e volta para a última quando ela some', async () => {
    vi.useFakeTimers();
    getQueue.mockResolvedValueOnce(resposta([roleta('r1', 'Vendas'), roleta('r2', 'Locação'), roleta('r3', 'Lançamento')]));
    await montar(ctx());
    fireEvent.click(screen.getByRole('button', { name: 'Próxima roleta' }));
    expect(screen.getByText('Locação')).toBeInTheDocument();

    // Chegou uma roleta nova na frente: a tela continua em Locação.
    getQueue.mockResolvedValueOnce(resposta([roleta('r0', 'Nova'), roleta('r1', 'Vendas'), roleta('r2', 'Locação'), roleta('r3', 'Lançamento')]));
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByText('Locação')).toBeInTheDocument();
    expect(screen.getByText('3 de 4')).toBeInTheDocument();

    // Locação foi desligada e só sobrou uma: mostra a que ficou, sem setas.
    getQueue.mockResolvedValueOnce(resposta([roleta('r1', 'Vendas')]));
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByText('Vendas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Próxima roleta' })).not.toBeInTheDocument();
  });

  it('se a busca falha, mantém o que estava na tela', async () => {
    vi.useFakeTimers();
    getQueue.mockResolvedValueOnce(resposta([roleta('r1', 'Vendas')]));
    await montar(ctx());
    getQueue.mockRejectedValueOnce(new Error('rede'));
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByText('Vendas')).toBeInTheDocument();
  });
});
