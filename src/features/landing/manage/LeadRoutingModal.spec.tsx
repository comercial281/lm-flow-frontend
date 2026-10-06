import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeadRoutingModal from './LeadRoutingModal';

vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: { getLabels: vi.fn().mockResolvedValue({ data: [{ id: 1, title: 'quente' }, { id: 2, title: 'frio' }] }) },
}));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: {
    getPipelines: vi.fn().mockResolvedValue({ data: [{ id: 'p1', name: 'Vendas' }] }),
    getPipelineStages: vi.fn().mockResolvedValue({ data: [] }),
  },
}));
vi.mock('@/services/capi/capiConfigService', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/capi/capiConfigService')>()),
  capiConfigService: { get: vi.fn().mockResolvedValue(null), testConnection: vi.fn() },
}));
const roletas = vi.hoisted(() => vi.fn());
vi.mock('@/services/roletaConfig/roletaConfigService', () => ({
  roletaConfigService: { getAll: roletas },
  roletaLabel: (r: { name: string }) => r.name,
}));
const saveRouting = vi.hoisted(() => vi.fn());
vi.mock('@/services/landingPages/landingPageService', () => ({
  landingPageService: { saveRouting },
}));
const usuarios = vi.hoisted(() => vi.fn());
vi.mock('@/services/users/usersService', () => ({ default: { getUsers: usuarios } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  roletas.mockReset().mockResolvedValue([]);
  usuarios.mockReset().mockResolvedValue({ data: [{ id: 'u1', name: 'Ana Corretora' }, { id: 'u9', name: 'Saiu', deactivated: true }] });
  saveRouting.mockReset().mockResolvedValue(undefined);
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false, media: '(pointer: coarse)', addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  // @ts-expect-error: o jsdom não tem matchMedia; voltamos a não ter.
  delete window.matchMedia;
});

const page = { id: 'lp1', title: 'Lançamento', settings: {} } as never;

describe('Roteamento de lead no computador', () => {
  it('a lista aberta continua aberta quando a janela redesenha', async () => {
    const props = { siteId: 's1', page, onClose: () => {}, onSaved: () => {} };
    const { rerender } = render(<LeadRoutingModal {...props} />);
    const tags = await screen.findAllByRole('combobox', { name: /Tag/ });
    await userEvent.click(tags[0]);
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    rerender(<LeadRoutingModal {...props} onSaved={() => {}} />);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: 'quente' }));
    expect(screen.getAllByRole('combobox', { name: /Tag/ })[0]).toHaveTextContent('quente');
  });
});

describe('Roteamento de lead · Quem assume o lead', () => {
  const comRoleta = (settings: object = {}) =>
    ({ id: 'lp1', title: 'Lançamento', settings }) as never;
  const abrirModal = (settings: object = {}) =>
    render(<LeadRoutingModal siteId="s1" page={comRoleta(settings)} onClose={() => {}} onSaved={() => {}} />);
  const salvar = async () => {
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(saveRouting).toHaveBeenCalled());
    return saveRouting.mock.calls[0][3].routing as Record<string, unknown>;
  };

  beforeEach(() => {
    roletas.mockResolvedValue([
      { id: 'r1', name: 'Zona Sul', is_active: true },
      { id: 'r2', name: 'Antiga', is_active: false },
    ]);
  });

  // Corretor fixo OU roleta, numa lista com as abas Corretores | Roleta. O
  // corretor vai em routing.default_assignee_id, ao lado da roleta, mesclando.
  it('escolher um corretor grava routing.default_assignee_id e limpa a roleta', async () => {
    abrirModal({ routing: { roleta_config_id: 'r1', per_answer: { a: 1 } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Quem assume o lead' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Corretores' }));
    expect(screen.queryByRole('option', { name: 'Saiu' })).toBeNull();
    await userEvent.click(screen.getByRole('option', { name: 'Ana Corretora' }));
    expect(await salvar()).toMatchObject({ default_assignee_id: 'u1', roleta_config_id: null, per_answer: { a: 1 } });
  });

  it('escolher uma roleta grava a roleta e limpa o corretor; só as ligadas são oferecidas', async () => {
    abrirModal({ routing: { default_assignee_id: 'u1', per_answer: { a: 1 } } });
    const campo = await screen.findByRole('button', { name: 'Quem assume o lead' });
    await waitFor(() => expect(campo).toHaveTextContent('Ana Corretora'));
    await userEvent.click(campo);
    await userEvent.click(screen.getByRole('tab', { name: 'Roleta' }));
    expect(screen.queryByRole('option', { name: /Antiga/ })).toBeNull();
    await userEvent.click(screen.getByRole('option', { name: 'Zona Sul' }));
    expect(await salvar()).toMatchObject({ default_assignee_id: null, roleta_config_id: 'r1', per_answer: { a: 1 } });
  });

  it('abre com a roleta gravada; a desligada continua escolhida, com o aviso', async () => {
    abrirModal({ routing: { roleta_config_id: 'r2' } });
    expect(await screen.findByRole('button', { name: 'Quem assume o lead' })).toHaveTextContent('Antiga (desligada)');
    expect(screen.getByText(/Esta roleta está desligada/)).toBeInTheDocument();
  });

  it('sem acesso à equipe: sem aba Corretores, e o campo do corretor nem viaja', async () => {
    usuarios.mockRejectedValue(new Error('403'));
    abrirModal({ routing: { roleta_config_id: 'r1' } });
    await userEvent.click(await screen.findByRole('button', { name: 'Quem assume o lead' }));
    expect(screen.queryByRole('tab', { name: 'Corretores' })).toBeNull();
    await userEvent.keyboard('{Escape}');
    const routing = await salvar();
    expect(routing).toMatchObject({ roleta_config_id: 'r1' });
    expect(routing).not.toHaveProperty('default_assignee_id');
  });

  it('fora do horário o lead espera (não há mais número de plantão)', async () => {
    abrirModal({ routing: { roleta_config_id: 'r1' } });
    expect(await screen.findByText(/o lead espera e é oferecido quando ela abrir/)).toBeInTheDocument();
    expect(screen.queryByText(/número de plantão/)).toBeNull();
  });
});
