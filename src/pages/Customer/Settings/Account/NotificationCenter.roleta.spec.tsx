import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Central de Notificações × roleta nova (06/10/2026, D7): os avisos da roleta
// saem da lista (vivem na aba Avisos da página "Roleta de leads") e a tela diz
// onde estão.
const policy = vi.hoisted(() => vi.fn());
vi.mock('@/services/notifications/notificationPreferencesService', () => ({
  default: { policy, updatePolicy: vi.fn() },
}));
vi.mock('@/components/notifications/NotificationMatrix', () => ({
  default: ({ catalog }: { catalog: { events: { key: string; label: string }[] } }) => (
    <ul>{catalog.events.map(e => <li key={e.key}>{e.label}</li>)}</ul>
  ),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import NotificationCenter from './NotificationCenter';

const evento = (key: string, label: string, group: string) => ({ key, label, group, description: '', channels: [], defaults: [] });
const ligado = { channels: { whatsapp: { value: true } } };

beforeEach(() => {
  policy.mockReset().mockResolvedValue({
    groups: [{ key: 'lead', label: 'Lead' }, { key: 'roleta', label: 'Roleta' }],
    channels: [], origin_groups: [], users: [], pipelines: [], can_edit: true,
    events: [
      evento('lead.novo_anuncio', 'Lead novo de anúncio', 'lead'),
      evento('roleta.oferta_recebida', 'Você foi sorteado para um lead', 'roleta'),
      evento('roleta.aceito', 'Corretor aceitou o lead', 'roleta'),
      evento('roleta.nao_assumiu', 'Corretor não assumiu o lead', 'roleta'),
      evento('roleta.falhou', 'Roleta falhou', 'roleta'),
    ],
    policy: { 'lead.novo_anuncio': ligado, 'roleta.oferta_recebida': ligado, 'roleta.aceito': ligado },
  });
});

const abrir = async () => {
  render(<MemoryRouter><NotificationCenter /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /Central de Notificações/ }));
};

describe('Central de Notificações × roleta nova', () => {
  it('oferta, aceito e repasse saem da lista, com a frase e o link', async () => {
    await abrir();
    expect(await screen.findByText('Lead novo de anúncio')).toBeInTheDocument();
    expect(screen.queryByText('Você foi sorteado para um lead')).toBeNull();
    expect(screen.queryByText('Corretor aceitou o lead')).toBeNull();
    expect(screen.queryByText('Corretor não assumiu o lead')).toBeNull();
    // Alerta de operação, não é aviso da página da roleta.
    expect(screen.getByText('Roleta falhou')).toBeInTheDocument();
    expect(screen.getByText(/Os avisos da roleta ficam em Roleta de leads › Avisos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir os avisos da roleta' }))
      .toHaveAttribute('href', '/automations/roleta-config?aba=avisos');
    // A contagem do cabeçalho não conta o que saiu da lista.
    expect(screen.getByText('1 aviso ligado.', { exact: false })).toBeInTheDocument();
  });
});
