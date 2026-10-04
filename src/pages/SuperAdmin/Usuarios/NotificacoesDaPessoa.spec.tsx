import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import NotificacoesDaPessoa from './NotificacoesDaPessoa';
import type { UserNotifications } from '@/types/admin/users';

const agora = new Date().toISOString();
const entrega = (extra: Partial<UserNotifications['push'][number]>) => ({
  id: Math.random().toString(), kind: null, preview: 'Lead novo: Maria', recipient: 'Google (Chrome/Android)', status: 'enviado' as const,
  error: null, sent_at: agora, shown_at: null, clicked_at: null, delivered_at: null, read_at: null, ...extra,
});
const dados = (extra: Partial<UserNotifications> = {}): UserNotifications => ({
  permissions: [{ device: 'Chrome · Mac', permission: 'denied', seen_at: agora }],
  push_devices: 1,
  push: [entrega({ status: 'clicou', shown_at: agora, clicked_at: agora }), entrega({ id: 'sem-recibo' }), entrega({ status: 'falhou', error: 'Aparelho saiu do Modo Plantão (inscrição vencida)' })],
  whatsapp: [entrega({ status: 'lido', recipient: '5511940871974', delivered_at: agora, read_at: agora })],
  bell: [{ title: 'Lead novo: Maria', read: false, created_at: agora }],
  ...extra,
});

describe('NotificacoesDaPessoa', () => {
  it('push: permissão, aparelhos e a trilha Saiu → Apareceu → Clicou', () => {
    render(<NotificacoesDaPessoa dados={dados()} telefone="11940871974" />);
    const push = screen.getByRole('region', { name: 'Push' });
    expect(within(push).getByText('Bloqueada')).toBeInTheDocument();
    expect(within(push).getByText(/Chrome · Mac/)).toBeInTheDocument();
    expect(within(push).getByText(/1 aparelho com Modo Plantão/)).toBeInTheDocument();
    expect(within(push).getAllByText('Clicou').length).toBeGreaterThan(0);
    expect(within(push).getByText(/inscrição vencida/)).toBeInTheDocument();
  });

  it('push sem recibo fica em Saiu, sem erro', () => {
    render(<NotificacoesDaPessoa dados={dados({ push: [entrega({})] })} telefone={null} />);
    const push = screen.getByRole('region', { name: 'Push' });
    expect(within(push).getByText('Saiu')).toBeInTheDocument();
    expect(within(push).queryByText('Falhou')).not.toBeInTheDocument();
  });

  it('WhatsApp com Lido e Na tela com Não lido', () => {
    render(<NotificacoesDaPessoa dados={dados()} telefone="11940871974" />);
    expect(within(screen.getByRole('region', { name: 'WhatsApp' })).getByText('Lido')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Na tela' })).getByText('Não lido')).toBeInTheDocument();
  });

  it('vazios dizem o que fazer', () => {
    render(<NotificacoesDaPessoa dados={dados({ permissions: [], push_devices: 0, push: [], whatsapp: [], bell: [] })} telefone={null} />);
    expect(screen.getByText('Nenhum push enviado ainda')).toBeInTheDocument();
    expect(screen.getByText(/Sem número de WhatsApp no cadastro da pessoa\. Se houver um número no campo da roleta/)).toBeInTheDocument();
    expect(screen.getByText('Nenhum aviso na tela')).toBeInTheDocument();
  });

  it('seção indisponível mostra erro, não vazio, e Tentar de novo refaz a busca', () => {
    const aoTentarDeNovo = vi.fn();
    render(<NotificacoesDaPessoa dados={null} telefone={null} aoTentarDeNovo={aoTentarDeNovo} />);
    expect(screen.getByText('Não deu para ler as notificações desta pessoa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /tentar de novo/i }));
    expect(aoTentarDeNovo).toHaveBeenCalledTimes(1);
  });
});
