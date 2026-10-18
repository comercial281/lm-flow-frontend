// Formulários (Automações): falha ao ler os formulários configurados não pode virar
// "Nenhum formulário configurado" — o gestor recadastraria o que já existe.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const svc = vi.hoisted(() => ({
  getAll: vi.fn(),
  syncMetaForms: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));
vi.mock('@/services/leadAds/leadAdsFormsService', () => ({ leadAdsFormsService: svc }));
vi.mock('@/services/integrations/metaPagesService', () => ({ metaPagesService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
vi.mock('@/services/roletaConfig/roletaConfigService', async (orig) => {
  const real = await orig<typeof import('@/services/roletaConfig/roletaConfigService')>();
  return { ...real, roletaConfigService: { getAll: vi.fn().mockResolvedValue([]) } };
});
const recursos = vi.hoisted(() => ({
  labels: [], sequences: [], followupFlows: [], quickReplies: [], adOrigins: [], formOrigins: [],
  messageFunnels: [], conversationFunnels: [], evolutionInstances: [], loading: false,
  users: [], pipelines: [], stagesByPipeline: {},
  reloadLabels: () => {}, reloadFunnels: () => {},
}));
vi.mock('@/features/flowAutomations/editores/LeadAutomationsEditors', () => ({ useAutomationResources: () => recursos }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import LeadAdsForms from './LeadAdsForms';

beforeEach(() => {
  svc.getAll.mockReset();
  svc.syncMetaForms.mockReset().mockResolvedValue({ data: [], errors: [], ignored_leads: [] });
});

describe('Formulários · erro de carga', () => {
  it('leitura que falha mostra Tentar de novo, não "Nenhum formulário configurado"', async () => {
    svc.getAll.mockRejectedValue(new Error('500'));
    render(<MemoryRouter><LeadAdsForms /></MemoryRouter>);
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    expect(screen.queryByText('Nenhum formulário configurado')).toBeNull();

    svc.getAll.mockResolvedValue([]);
    const antes = svc.getAll.mock.calls.length;
    await userEvent.click(botao);
    await waitFor(() => expect(svc.getAll.mock.calls.length).toBe(antes + 1));
    expect(await screen.findByText('Nenhum formulário configurado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
  });
});
