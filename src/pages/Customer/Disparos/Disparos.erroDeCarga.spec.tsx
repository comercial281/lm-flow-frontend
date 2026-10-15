import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Disparos from './Disparos';

const s = vi.hoisted(() => ({
  canais: vi.fn(),
  funis: vi.fn(),
}));
vi.mock('@/services/broadcasts/broadcastsService', () => ({
  broadcastsService: {
    whatsappCloudOptions: s.canais,
    whatsappCloudMetrics: vi.fn().mockResolvedValue({ channels: [] }),
    list: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list: s.funis },
}));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: {
    getPipelines: vi.fn().mockResolvedValue({ data: [] }),
    getPipelineStages: vi.fn().mockResolvedValue({ data: [] }),
  },
}));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => true }));
vi.mock('@/components/channels/settings/MessageTemplateForm', () => ({ default: () => null }));
vi.mock('@/components/pipelines/BulkDispatchModal', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const canal = { inbox_id: 'i1', name: 'Oficial 1', phone_number: '5511999990000', templates: [] };
const funil = { id: 'f1', name: 'Funil de boas-vindas', archived_at: null, nodes: [] };
const tela = () => render(<MemoryRouter><Disparos /></MemoryRouter>);
const aba = (nome: string) => userEvent.click(screen.getByRole('tab', { name: new RegExp(nome) }));

beforeEach(() => {
  s.canais.mockReset();
  s.funis.mockReset();
});

describe('Disparos · erro de carga', () => {
  it('erro nos funis não apaga os canais que carregaram', async () => {
    s.canais.mockResolvedValue([canal]);
    s.funis.mockRejectedValue(new Error('rede'));
    tela();
    await aba('Canais oficiais');
    expect(await screen.findByText(/Oficial 1/)).toBeInTheDocument();
    await aba('Funis');
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum funil ainda.')).toBeNull();
  });

  it('erro nos canais não apaga os funis que carregaram, e Tentar de novo recupera', async () => {
    s.canais.mockRejectedValueOnce(new Error('rede'));
    s.funis.mockResolvedValue([funil]);
    tela();
    await aba('Canais oficiais');
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum canal oficial conectado ainda.')).toBeNull();
    s.canais.mockResolvedValueOnce([canal]);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText(/Oficial 1/)).toBeInTheDocument();
    await aba('Funis');
    expect(await screen.findByText(/Funil de boas-vindas/)).toBeInTheDocument();
  });

  it('Tentar de novo duas vezes seguidas não duplica a lista', async () => {
    s.canais.mockResolvedValue([canal]);
    s.funis.mockRejectedValueOnce(new Error('rede'));
    tela();
    await aba('Funis');
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    s.funis.mockResolvedValue([funil]);
    await userEvent.dblClick(botao);
    expect(await screen.findAllByText(/Funil de boas-vindas/)).toHaveLength(1);
  });
});
