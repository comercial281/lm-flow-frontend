// src/pages/Customer/Settings/Integrations/SiteDaImobiliaria/SiteDaImobiliaria.spec.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SiteDaImobiliaria from './SiteDaImobiliaria';
import { resumoDaPrevia, fraseDeInativar } from './PreviaDaImportacao';

const servico = vi.hoisted(() => ({ get: vi.fn(), previa: vi.fn(), confirmar: vi.fn(), atualizarAgora: vi.fn(), desligar: vi.fn() }));
vi.mock('@/services/properties/siteFeedService', () => ({ siteFeedService: servico, default: servico }));
const pode = vi.hoisted(() => ({ valor: true }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => pode.valor }));

const abrir = () => render(<MemoryRouter><SiteDaImobiliaria /></MemoryRouter>);
const previa = {
  format: 'vrsync', provider: 'ImobiBrasil', total: 220, shrunk: false,
  counts: { create: 219, update: 1, unchanged: 0, inactivate: 0, reactivate: 0, skip: 0 },
  warnings: [{ key: 'sem_tipo', count: 2, text: '2 imóveis sem tipo: entram como Outro' }],
  sample: [{ code: '4327', title: 'Sobrado', type_label: 'sobrado', price_label: 'R$ 960.000', city: 'São Paulo', photos: 18, action: 'create' }],
};

describe('Site da imobiliária', () => {
  beforeEach(() => { vi.clearAllMocks(); pode.valor = true; });

  it('sem configuração: lê o arquivo, mostra a prévia e confirma', async () => {
    servico.get.mockResolvedValue({ configured: false, state: 'off' });
    servico.previa.mockResolvedValue(previa);
    servico.confirmar.mockResolvedValue({ configured: true, state: 'waiting', url: 'https://x.com/a.xml' });
    abrir();
    fireEvent.change(await screen.findByLabelText('Endereço do arquivo de imóveis'), { target: { value: 'https://x.com/a.xml' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ler arquivo' }));
    expect(await screen.findByText('Vai criar 219 · atualizar 1')).toBeInTheDocument();
    expect(screen.getByText('2 imóveis sem tipo: entram como Outro')).toBeInTheDocument();
    expect(screen.getByText('Sobrado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));
    await waitFor(() => expect(servico.confirmar).toHaveBeenCalledWith('https://x.com/a.xml', { mesmoAssim: false }));
  });

  it('erro da prévia aparece com a frase do servidor', async () => {
    servico.get.mockResolvedValue({ configured: false, state: 'off' });
    servico.previa.mockRejectedValue({ response: { data: { error: { message: 'Não reconhecemos esse arquivo.' } } } });
    abrir();
    fireEvent.change(await screen.findByLabelText('Endereço do arquivo de imóveis'), { target: { value: 'https://x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ler arquivo' }));
    expect(await screen.findByText('Não reconhecemos esse arquivo.')).toBeInTheDocument();
  });

  it('ligado: situação, última mudança e Atualizar agora', async () => {
    servico.get.mockResolvedValue({ configured: true, enabled: true, state: 'ok', url: 'https://x.com/a.xml', last_count: 220,
      last_checked_at: new Date().toISOString(), last_summary: { create: 3, inactivate: 1 } });
    servico.atualizarAgora.mockResolvedValue({ configured: true, state: 'ok' });
    abrir();
    expect(await screen.findByText('Lendo')).toBeInTheDocument();
    expect(screen.getByText(/3 novos · 1 saiu/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));
    await waitFor(() => expect(servico.atualizarAgora).toHaveBeenCalled());
  });

  it('sem permissão: vê a situação, sem os botões', async () => {
    pode.valor = false;
    servico.get.mockResolvedValue({ configured: true, enabled: true, state: 'ok', url: 'https://x.com/a.xml', last_count: 220 });
    abrir();
    expect(await screen.findByText('Lendo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Endereço do arquivo de imóveis')).not.toBeInTheDocument();
  });

  it('carga falhou: erro com Tentar de novo, sem formulário', async () => {
    servico.get.mockRejectedValue(new Error('x'));
    abrir();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByLabelText('Endereço do arquivo de imóveis')).not.toBeInTheDocument();
  });
});

const ligado = (extra = {}) => ({ configured: true, enabled: true, state: 'ok', url: 'https://x.com/a.xml', last_count: 220, last_checked_at: '2026-10-13T10:00:00Z', ...extra });
const lerPrevia = async (p: object) => {
  servico.get.mockResolvedValue({ configured: false, state: 'off' });
  servico.previa.mockResolvedValue({ ...previa, ...p });
  abrir();
  fireEvent.change(await screen.findByLabelText('Endereço do arquivo de imóveis'), { target: { value: 'https://x.com/a.xml' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ler arquivo' }));
  await screen.findByRole('button', { name: 'Confirmar e importar' });
};
const avancar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('Site da imobiliária: confirmações e erros', () => {
  beforeEach(() => { vi.clearAllMocks(); pode.valor = true; });

  it('inativar pede confirmação; cancelar não confirma', async () => {
    await lerPrevia({ counts: { ...previa.counts, inactivate: 3 } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));
    expect(await screen.findByText(/3 imóveis que não estão no arquivo vão ficar Inativos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await act(async () => { await Promise.resolve(); });
    expect(servico.confirmar).not.toHaveBeenCalled();
  });

  it('arquivo bem menor: confirma com mesmoAssim', async () => {
    servico.confirmar.mockResolvedValue({ configured: true, state: 'waiting', url: 'https://x.com/a.xml' });
    await lerPrevia({ shrunk: true });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));
    await waitFor(() => expect(servico.confirmar).toHaveBeenCalledWith('https://x.com/a.xml', { mesmoAssim: true }));
  });

  it('erro ao confirmar mostra a frase do servidor', async () => {
    servico.confirmar.mockRejectedValue({ response: { data: { error: { message: 'Endereço fora do ar.' } } } });
    await lerPrevia({});
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e importar' }));
    expect(await screen.findByText('Endereço fora do ar.')).toBeInTheDocument();
  });

  it('Desligar pede confirmação e desliga', async () => {
    servico.get.mockResolvedValue(ligado());
    servico.desligar.mockResolvedValue({ configured: true, state: 'off' });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Desligar' }));
    const botoes = await screen.findAllByRole('button', { name: 'Desligar' });
    fireEvent.click(botoes[botoes.length - 1]);
    await waitFor(() => expect(servico.desligar).toHaveBeenCalled());
  });

  it('Trocar endereço tem Cancelar que volta ao endereço salvo', async () => {
    servico.get.mockResolvedValue(ligado());
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Trocar endereço' }));
    const campo = screen.getByLabelText('Endereço do arquivo de imóveis');
    fireEvent.change(campo, { target: { value: 'https://outro.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Endereço do arquivo de imóveis')).not.toBeInTheDocument();
  });

  it('mostra o tipo do imóvel na amostra', async () => {
    await lerPrevia({});
    expect(screen.getByText(/· Sobrado/)).toBeInTheDocument();
  });
});

describe('Site da imobiliária: acompanhar a leitura', () => {
  beforeEach(() => { vi.clearAllMocks(); pode.valor = true; vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const abrirLigado = async () => {
    servico.atualizarAgora.mockResolvedValue(ligado({ state: 'waiting' }));
    abrir();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('button', { name: 'Atualizar agora' })).toBeInTheDocument();
  };

  it('para quando a data da leitura muda e não está esperando', async () => {
    servico.get.mockResolvedValue(ligado());
    await abrirLigado();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));
    await avancar(0);
    servico.get.mockClear();
    servico.get.mockResolvedValue(ligado({ last_checked_at: '2026-10-13T11:00:00Z' }));
    await avancar(4000);
    expect(servico.get).toHaveBeenCalledTimes(1);
    await avancar(20000);
    expect(servico.get).toHaveBeenCalledTimes(1);
  });

  it('clique durante uma leitura em andamento não cria segunda sequência', async () => {
    servico.get.mockResolvedValue(ligado());
    await abrirLigado();
    const botao = screen.getByRole('button', { name: 'Atualizar agora' });
    fireEvent.click(botao);
    await avancar(0);
    let soltar: (v: unknown) => void = () => {};
    servico.get.mockClear();
    servico.get.mockImplementationOnce(() => new Promise(r => { soltar = r; }));
    await avancar(4000); // a 1ª sequência está esperando a resposta
    fireEvent.click(botao);
    await avancar(0);
    servico.get.mockResolvedValue(ligado());
    await act(async () => { soltar(ligado()); await Promise.resolve(); });
    servico.get.mockClear();
    await avancar(4000);
    expect(servico.get).toHaveBeenCalledTimes(1);
  });

  it('sair da tela para de acompanhar', async () => {
    servico.get.mockResolvedValue(ligado());
    await abrirLigado();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));
    await avancar(0);
    cleanup();
    servico.get.mockClear();
    await avancar(30000);
    expect(servico.get).not.toHaveBeenCalled();
  });
});

describe('frases da prévia', () => {
  it('resumo inclui o que foi pulado', () => {
    expect(resumoDaPrevia({ ...previa, counts: { ...previa.counts, create: 0, update: 0, skip: 2 } } as never)).toBe('Vai pular 2');
  });
  it('plural da inativação', () => {
    expect(fraseDeInativar(1)).toMatch(/^1 imóvel que não está no arquivo vai ficar Inativo/);
    expect(fraseDeInativar(3)).toMatch(/^3 imóveis que não estão no arquivo vão ficar Inativos/);
  });
});
