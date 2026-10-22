import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthorizationBanners from './AuthorizationBanners';

const s = vi.hoisted(() => ({
  perms: { update: true, create: true } as Record<string, boolean>,
  liberado: true,
  pronto: true,
  carregando: false,
  iniciar: vi.fn(),
}));
vi.mock('@/contexts/PermissionsContext', () => ({
  usePermissions: () => ({ can: (_recurso: string, acao: string) => !!s.perms[acao] }),
}));
vi.mock('@/contexts/GlobalConfigContext', () => ({ useGlobalConfig: () => ({}) }));
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/components/channels/forms/whatsapp/useConexaoOficial', () => ({
  useConexaoOficial: () => ({
    liberado: s.liberado,
    pronto: s.pronto,
    carregando: s.carregando,
    erro: null,
    iniciar: s.iniciar,
  }),
}));

// Formato real do servidor pro canal oficial.
const caixa = (conectado: boolean) => ({
  id: '9',
  channel_type: 'Channel::Whatsapp',
  provider: 'whatsapp_cloud',
  connection_status: conectado ? 'connected' : 'disconnected',
  whatsapp_cloud: { connected: conectado, mode: 'new_number' },
});
const tela = (conectado = true) =>
  render(<AuthorizationBanners inbox={caixa(conectado)} onReauthorize={vi.fn()} />);

describe('AuthorizationBanners (WhatsApp oficial)', () => {
  beforeEach(() => {
    s.perms = { update: true, create: true };
    s.liberado = true;
    s.pronto = true;
    s.carregando = false;
    s.iniciar.mockReset();
  });

  it('com permissão de editar e criar caixa mostra Reconectar', () => {
    tela();
    expect(screen.getByRole('button', { name: /success\.reconnect/ })).toBeInTheDocument();
  });

  it('sem permissão de editar a caixa não mostra Reconectar', () => {
    s.perms = { update: false, create: true };
    tela();
    expect(screen.queryByRole('button', { name: /success\.reconnect/ })).toBeNull();
  });

  it('sem permissão de criar caixa não mostra Reconectar (o servidor recusaria)', () => {
    s.perms = { update: true, create: false };
    tela();
    expect(screen.queryByRole('button', { name: /success\.reconnect/ })).toBeNull();
  });

  it('conexão não liberada mostra a frase no lugar do botão', () => {
    s.liberado = false;
    tela();
    expect(screen.queryByRole('button', { name: /success\.reconnect/ })).toBeNull();
    expect(
      screen.getByText('A conexão com a API oficial ainda não está liberada neste LM Flow.'),
    ).toBeInTheDocument();
  });

  it('conectado diz Ativo', () => {
    tela(true);
    expect(screen.getByText('settings.authorizationBanners.success.active')).toBeInTheDocument();
    expect(screen.queryByText('Desconectado')).toBeNull();
  });

  it('desconectado não diz Ativo: aviso de atenção com Desconectado', () => {
    tela(false);
    expect(screen.getByText('Desconectado')).toBeInTheDocument();
    expect(screen.queryByText('settings.authorizationBanners.success.active')).toBeNull();
    expect(screen.queryByText(/success\.connectedWith/)).toBeNull();
  });

  it('Reconectar chama o fluxo com o caminho gravado', async () => {
    tela();
    await userEvent.click(screen.getByRole('button', { name: /success\.reconnect/ }));
    expect(s.iniciar).toHaveBeenCalledWith('new_number');
  });

  it('durante a conexão o Reconectar fica travado e não aceita outro clique', async () => {
    s.carregando = true;
    tela();
    const botao = screen.getByRole('button', { name: /success\.reconnect/ });
    expect(botao).toBeDisabled();
    await userEvent.click(botao);
    expect(s.iniciar).not.toHaveBeenCalled();
  });
});
