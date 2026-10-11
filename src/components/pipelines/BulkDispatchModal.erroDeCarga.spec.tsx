import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkDispatchModal from './BulkDispatchModal';

const s = vi.hoisted(() => ({ etiquetas: vi.fn(), canais: vi.fn() }));
vi.mock('@/services/broadcasts/broadcastsService', async orig => {
  const real = await orig<typeof import('@/services/broadcasts/broadcastsService')>();
  return {
    ...real,
    broadcastsService: {
      ...real.broadcastsService,
      list: vi.fn().mockResolvedValue([]),
      audiencePreview: vi.fn().mockResolvedValue(3),
      whatsappCloudOptions: s.canais,
      uploadMedia: vi.fn(),
    },
  };
});
vi.mock('@/services/contacts/labelsService', () => ({ labelsService: { getLabels: s.etiquetas } }));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: vi.fn().mockResolvedValue({ builtin: [], custom: [] }) },
}));
vi.mock('@/components/flowAutomations/ConversationFunnelSelect', () => ({ ConversationFunnelSelect: () => null }));
vi.mock('@/components/messaging/MessageSequenceEditor', async orig => {
  const real = await orig<typeof import('@/components/messaging/MessageSequenceEditor')>();
  return { ...real, default: () => null };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const canal = { inbox_id: 'i1', name: 'Oficial 1', phone_number: '5511999990000', templates: [] };
const abrir = () =>
  render(<BulkDispatchModal open onOpenChange={() => {}} pipelineId="p1" pipelineName="Leads" stages={[]} />);

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  s.etiquetas.mockReset();
  s.canais.mockReset().mockResolvedValue([]);
});

const escolherPorEtiqueta = async () => {
  await userEvent.click((await screen.findAllByRole('combobox'))[0]);
  await userEvent.click(await screen.findByRole('option', { name: 'Por etiqueta' }));
};

describe('BulkDispatchModal · erro de carga', () => {
  it('etiquetas que falham mostram o erro com Tentar de novo, não "Nenhuma etiqueta"', async () => {
    s.etiquetas.mockRejectedValueOnce(new Error('rede'));
    abrir();
    await escolherPorEtiqueta();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/^Nenhuma etiqueta/)).toBeNull();
    s.etiquetas.mockResolvedValueOnce({ data: [{ id: 1, title: 'quente', color: '#f00' }] });
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('button', { name: /quente/ })).toBeInTheDocument();
  });

  it('Tentar de novo duas vezes seguidas não duplica as etiquetas', async () => {
    s.etiquetas.mockRejectedValueOnce(new Error('rede'));
    abrir();
    await escolherPorEtiqueta();
    const botao = await screen.findByRole('button', { name: 'Tentar de novo' });
    s.etiquetas.mockResolvedValue({ data: [{ id: 1, title: 'quente', color: '#f00' }] });
    await userEvent.dblClick(botao);
    expect(await screen.findAllByRole('button', { name: /quente/ })).toHaveLength(1);
  });

  it('canais oficiais que falham mostram o erro e Tentar de novo recupera', async () => {
    s.etiquetas.mockResolvedValue({ data: [] });
    s.canais.mockRejectedValueOnce(new Error('rede'));
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    await userEvent.click(await screen.findByRole('button', { name: /WhatsApp Oficial/ }));
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum canal WhatsApp Oficial/)).toBeNull();
    s.canais.mockResolvedValueOnce([canal]);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.queryByText('Não deu pra carregar')).toBeNull());
    expect(screen.queryByText(/Nenhum canal WhatsApp Oficial/)).toBeNull();
  });
});
