import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuthorizationBanners from './AuthorizationBanners';

const s = vi.hoisted(() => ({ pode: true, liberado: true, pronto: true }));
vi.mock('@/contexts/PermissionsContext', () => ({ usePermissions: () => ({ can: () => s.pode }) }));
vi.mock('@/contexts/GlobalConfigContext', () => ({ useGlobalConfig: () => ({}) }));
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/components/channels/forms/whatsapp/useConexaoOficial', () => ({
  useConexaoOficial: () => ({ liberado: s.liberado, pronto: s.pronto, carregando: false, erro: null, iniciar: vi.fn() }),
}));

const inbox = {
  id: '9',
  channel_type: 'Channel::Whatsapp',
  provider: 'whatsapp_cloud',
  whatsapp_cloud: { mode: 'new_number' },
};
const tela = () => render(<AuthorizationBanners inbox={inbox} onReauthorize={vi.fn()} />);

describe('AuthorizationBanners (WhatsApp oficial)', () => {
  beforeEach(() => {
    s.pode = true;
    s.liberado = true;
    s.pronto = true;
  });

  it('com permissão mostra Reconectar', () => {
    tela();
    expect(screen.getByRole('button', { name: /success\.reconnect/ })).toBeInTheDocument();
  });

  it('sem permissão de editar a caixa não mostra Reconectar', () => {
    s.pode = false;
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
});
