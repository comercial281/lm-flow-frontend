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
const chave = vi.hoisted(() => ({ roletaNova: false }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({
  useClientToggle: (k: string) => (k === 'roleta_nova' ? chave.roletaNova : false),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  chave.roletaNova = false;
  roletas.mockReset().mockResolvedValue([]);
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

  beforeEach(() => {
    roletas.mockResolvedValue([
      { id: 'r1', name: 'Zona Sul', is_active: true },
      { id: 'r2', name: 'Antiga', is_active: false },
    ]);
  });

  // A landing ainda não lê responsável fixo (B2/T4): só a aba Roleta, sem a
  // barra de abas. Escolher grava routing.roleta_config_id, mesclando.
  it('mostra só as roletas ligadas e grava a escolhida', async () => {
    render(<LeadRoutingModal siteId="s1" page={comRoleta({ routing: { per_answer: { a: 1 } } })} onClose={() => {}} onSaved={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Roleta' }));
    expect(screen.queryByRole('tab', { name: 'Corretores' })).toBeNull();
    expect(screen.queryByRole('option', { name: /Antiga/ })).toBeNull();
    await userEvent.click(screen.getByRole('option', { name: 'Zona Sul' }));
    await userEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(saveRouting).toHaveBeenCalled());
    expect(saveRouting.mock.calls[0][3].routing).toMatchObject({ roleta_config_id: 'r1', per_answer: { a: 1 } });
  });

  it('a roleta escolhida e desligada continua escolhida, com o aviso', async () => {
    render(<LeadRoutingModal siteId="s1" page={comRoleta({ routing: { roleta_config_id: 'r2' } })} onClose={() => {}} onSaved={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Roleta' })).toHaveTextContent('Antiga (desligada)');
    expect(screen.getByText(/Esta roleta está desligada/)).toBeInTheDocument();
  });

  it('com a chave roleta_nova, fora do horário o lead espera (não há mais número de plantão)', async () => {
    chave.roletaNova = true;
    render(<LeadRoutingModal siteId="s1" page={comRoleta({ routing: { roleta_config_id: 'r1' } })} onClose={() => {}} onSaved={() => {}} />);
    expect(await screen.findByText(/o lead espera e é oferecido quando ela abrir/)).toBeInTheDocument();
    expect(screen.queryByText(/número de plantão/)).toBeNull();
  });
});
