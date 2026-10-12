import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PortalDetailPage from './PortalDetailPage';
import type { PortalDetail } from '@/services/portals/portalsService';
import { limparPendentes, marcarPendente } from '@/hooks/useAlteracoesNaoSalvas';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  apiPost: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/services/portals/portalsService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/portals/portalsService');
  return {
    ...actual,
    portalsService: {
      get: (...a: unknown[]) => mocks.get(...a),
      connect: (...a: unknown[]) => mocks.connect(...a),
      disconnect: (...a: unknown[]) => mocks.disconnect(...a),
    },
  };
});

// Conectar/Desconectar NÃO pode passar por /integrations (pede integrations.*,
// o Gerente tomava 403): qualquer chamada direta à API aqui é regressão.
vi.mock('@/services/core/api', () => ({
  default: { post: (...a: unknown[]) => mocks.apiPost(...a), get: vi.fn(), put: vi.fn() },
}));

// Os três cards têm spec próprio; aqui a pergunta é só o que a PÁGINA monta.
vi.mock('./PortalPropertiesSelector', () => ({ default: () => <div data-testid="seletor" /> }));
vi.mock('./PortalAdPlanCard', () => ({ default: () => <div data-testid="plano" /> }));
vi.mock('./PortalSettingsCard', () => ({
  default: ({ onSaved }: { onSaved?: () => void }) => (
    <div data-testid="configurar"><button type="button" onClick={onSaved}>salvou</button></div>
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => mocks.toastError(...a),
    success: (...a: unknown[]) => mocks.toastSuccess(...a),
    warning: vi.fn(),
  },
}));

const detalhe = (over: Partial<PortalDetail>): PortalDetail => ({
  portal_key: 'portal_zap',
  name: 'ZAP Imóveis (Canal Pro)',
  feed_format: 'vrsync',
  capabilities: ['feed', 'webhook_leads', 'highlight'],
  onboarding: ['Cadastre a URL do feed no Canal Pro'],
  connected: true,
  is_enabled: true,
  integration_id: 'int-1',
  sent_count: 3,
  featured_count: 1,
  last_accessed_at: null,
  active: false,
  feed_url: 'https://api.lmflow.com.br/feeds/vrsync/abc123.xml',
  lead_webhook_url: 'https://api.lmflow.com.br/webhooks/portal_leads/abc',
  property_ids: [],
  featured_property_ids: [],
  ...over,
});

const montar = (aba?: string) =>
  render(
    <MemoryRouter initialEntries={[`/settings/portals/portal_zap${aba ? `?aba=${aba}` : ''}`]}>
      <Routes>
        <Route path="/settings/portals/:portalKey" element={<PortalDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

const comTipos = { ad_types: [{ key: 'standard', label: 'Padrão', feed_value: 'STANDARD', limit: null, count: 3 }] };
const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

describe('PortalDetailPage — situação e abas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limparPendentes();
  });

  it('conectado e lendo: selo Recebendo no título, a frase no subtítulo e a aba Imóveis aberta', async () => {
    mocks.get.mockResolvedValue(detalhe({ ...comTipos, active: true, last_accessed_at: horasAtras(2) }));
    montar();

    expect(await screen.findByText('Recebendo')).toBeInTheDocument();
    expect(screen.getByText('Leu o feed há 2 h · 3 imóveis no portal')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Imóveis/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('seletor')).toBeInTheDocument();
    expect(screen.queryByTestId('configurar')).toBeNull();
    // Desconectar saiu do topo: mora na aba Conexão.
    expect(screen.queryByRole('button', { name: /Desconectar/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('parou de ler: aviso vermelho com há quanto tempo e o botão de copiar o feed', async () => {
    mocks.get.mockResolvedValue(detalhe({ last_accessed_at: horasAtras(13 * 24) }));
    montar();

    expect(await screen.findByText('Parou de ler')).toBeInTheDocument();
    expect(screen.getByText('O portal não lê o seu feed há 13 dias.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar endereço do feed' })).toBeInTheDocument();
  });

  it('conectado e nunca lido: Esperando 1ª leitura, com o aviso de conferir o cadastro', async () => {
    mocks.get.mockResolvedValue(detalhe({}));
    montar();

    expect(await screen.findByText('Esperando 1ª leitura')).toBeInTheDocument();
    expect(screen.getByText('O portal ainda não leu o seu feed.')).toBeInTheDocument();
  });

  it('a aba vem do endereço, e a de Plano só existe com tipos de anúncio', async () => {
    mocks.get.mockResolvedValue(detalhe({ ...comTipos }));
    const { unmount } = montar('plano');
    expect(await screen.findByTestId('plano')).toBeInTheDocument();
    unmount();

    mocks.get.mockResolvedValue(detalhe({}));
    montar('plano');
    expect(await screen.findByTestId('seletor')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Plano' })).toBeNull();
  });

  it('trocar de aba troca o conteúdo', async () => {
    const usuario = userEvent.setup();
    mocks.get.mockResolvedValue(detalhe({ ...comTipos }));
    montar();
    await screen.findByTestId('seletor');

    await usuario.click(screen.getByRole('tab', { name: 'Configurar' }));
    expect(screen.getByTestId('configurar')).toBeInTheDocument();
    expect(screen.queryByTestId('seletor')).toBeNull();
  });

  it('trocar de aba com alteração pendente pergunta antes, e desistir fica onde está', async () => {
    const usuario = userEvent.setup();
    mocks.get.mockResolvedValue(detalhe({ ...comTipos }));
    montar();
    await screen.findByTestId('seletor');
    marcarPendente('teste', true);

    await usuario.click(screen.getByRole('tab', { name: 'Configurar' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Sair sem salvar?')).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Continuar editando' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('seletor')).toBeInTheDocument();
    expect(screen.queryByTestId('configurar')).toBeNull();
  });

  it('recarregar depois de salvar mantém a aba no lugar, sem voltar ao esqueleto', async () => {
    mocks.get.mockResolvedValue(detalhe({ ...comTipos }));
    montar('configurar');
    const configurar = await screen.findByTestId('configurar');
    expect(mocks.get).toHaveBeenCalledTimes(1);

    // A aba *Configurar* chama `onSaved` (= recarregar o portal): o mesmo nó
    // continua montado — desmontar aqui voltaria a rolagem ao topo e refaria a
    // busca dos imóveis do seletor a cada salvar.
    await userEvent.setup().click(within(configurar).getByRole('button', { name: 'salvou' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Carregando portal…')).toBeNull();
    expect(screen.getByTestId('configurar')).toBe(configurar);
  });

  it('erro ao carregar mostra o erro com Tentar de novo, nunca o esqueleto pra sempre', async () => {
    const usuario = userEvent.setup();
    mocks.get.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(detalhe({}));
    montar();

    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByTestId('seletor')).toBeInTheDocument();
  });

  it('desconectado: só o passo a passo do portal e o botão de conectar, sem abas', async () => {
    mocks.get.mockResolvedValue(detalhe({ connected: false, integration_id: null, feed_url: null, lead_webhook_url: null }));
    montar();

    expect(await screen.findByRole('button', { name: 'Conectar ZAP Imóveis (Canal Pro)' })).toBeInTheDocument();
    expect(screen.getByText('Não conectado')).toBeInTheDocument();
    expect(screen.getByText('Cadastre a URL do feed no Canal Pro')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByTestId('seletor')).toBeNull();
  });
});

describe('PortalDetailPage — aba Conexão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limparPendentes();
  });

  it('lista as leituras do portal, da mais recente para a mais antiga', async () => {
    mocks.get.mockResolvedValue(detalhe({
      feed_access_log: [
        { at: '2026-09-13T12:00:00Z', listings: 1 },
        { at: '2026-09-14T19:00:00Z', listings: 394 },
      ],
    }));
    montar('conexao');

    const lista = await screen.findByRole('list', { name: 'Leituras do feed' });
    expect(screen.getByText(/^2 leituras · última em/)).toBeInTheDocument();
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('394 imóveis');
    expect(itens[1]).toHaveTextContent('1 imóvel');
    // Data em pt-BR (dia/mês/ano), sem o formato cru do servidor.
    expect(itens[0]).toHaveTextContent(/\d{2}\/\d{2}\/2026/);
    expect(itens[0]).not.toHaveTextContent('2026-09-14T');
  });

  it('sem leitura nenhuma diz que o portal ainda não baixou o feed', async () => {
    mocks.get.mockResolvedValue(detalhe({ feed_access_log: [] }));
    montar('conexao');

    expect(await screen.findByText('O portal ainda não baixou o feed.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Leituras do feed' })).toBeNull();
  });

  it('o botão Abrir feed abre o endereço do feed em outra aba; o de leads só copia', async () => {
    mocks.get.mockResolvedValue(detalhe({}));
    montar('conexao');

    const link = await screen.findByRole('link', { name: 'Abrir feed' });
    expect(link).toHaveAttribute('href', 'https://api.lmflow.com.br/feeds/vrsync/abc123.xml');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getAllByRole('button', { name: 'Copiar' })).toHaveLength(2);
    expect(screen.getByText('Cadastre a URL do feed no Canal Pro')).toBeInTheDocument();
  });
});

describe('PortalDetailPage — Conectar e Desconectar pela porta de Portais', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limparPendentes();
  });

  const desconectado = () => detalhe({ connected: false, integration_id: null, feed_url: null, lead_webhook_url: null });
  const botaoConectar = () => screen.findByRole('button', { name: 'Conectar ZAP Imóveis (Canal Pro)' });
  const botaoDesconectar = () => screen.findByRole('button', { name: 'Desconectar ZAP Imóveis (Canal Pro)' });

  it('Conectar chama a porta de Portais com a chave do portal e recarrega', async () => {
    mocks.get.mockResolvedValueOnce(desconectado()).mockResolvedValue(detalhe({}));
    mocks.connect.mockResolvedValue(detalhe({}));
    montar();

    await userEvent.setup().click(await botaoConectar());

    await waitFor(() => expect(mocks.connect).toHaveBeenCalledWith('portal_zap'));
    expect(mocks.apiPost).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('ZAP Imóveis (Canal Pro) conectado');
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('tablist')).toBeInTheDocument();
  });

  it('Desconectar pergunta antes, chama a porta de Portais e recarrega', async () => {
    const usuario = userEvent.setup();
    mocks.get.mockResolvedValueOnce(detalhe({})).mockResolvedValue(desconectado());
    mocks.disconnect.mockResolvedValue(desconectado());
    montar('conexao');

    await usuario.click(await botaoDesconectar());
    const dialogo = await screen.findByRole('dialog');
    expect(mocks.disconnect).not.toHaveBeenCalled();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desconectar' }));

    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledWith('portal_zap'));
    expect(mocks.apiPost).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('ZAP Imóveis (Canal Pro) desconectado');
    expect(await botaoConectar()).toBeInTheDocument();
  });

  it('desistir de desconectar não chama nada', async () => {
    const usuario = userEvent.setup();
    mocks.get.mockResolvedValue(detalhe({}));
    montar('conexao');

    await usuario.click(await botaoDesconectar());
    const dialogo = await screen.findByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mocks.disconnect).not.toHaveBeenCalled();
  });

  it('erro ao conectar continua avisando como antes, e o botão volta', async () => {
    mocks.get.mockResolvedValue(desconectado());
    mocks.connect.mockRejectedValue(Object.assign(new Error('403'), { response: { status: 403 } }));
    montar();

    await userEvent.setup().click(await botaoConectar());

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Erro ao conectar portal'));
    expect(await botaoConectar()).not.toBeDisabled();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it('erro ao desconectar continua avisando como antes', async () => {
    const usuario = userEvent.setup();
    mocks.get.mockResolvedValue(detalhe({}));
    mocks.disconnect.mockRejectedValue(new Error('rede'));
    montar('conexao');

    await usuario.click(await botaoDesconectar());
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desconectar' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Erro ao desconectar portal'));
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
});
