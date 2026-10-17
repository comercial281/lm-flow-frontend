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
      senderOptions: vi.fn().mockResolvedValue({
        data: [{ inbox_id: 'in1', name: 'Imobiliária', phone: '5511999990001', connection: 'open', owner_name: null, provider: 'evolution', sendable: true, reason: null }],
        default_inbox_id: 'in1',
      }),
      audiencePreviewFull: vi.fn().mockResolvedValue({ count: 3, excluded: { opt_out: 0, frequency: 0, other_owner: 0, busy: 0 }, eta: {} }),
      whatsappCloudOptions: s.canais,
      uploadMedia: vi.fn(),
    },
  };
});
vi.mock('@/services/contacts/labelsService', () => ({ labelsService: { getLabels: s.etiquetas } }));
vi.mock('@/services/messageFunnels/messageFunnelsService', () => ({
  tenantTemplateVariablesService: { list: vi.fn().mockResolvedValue({ builtin: [], custom: [] }) },
}));
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list: vi.fn().mockResolvedValue([]), get: vi.fn() },
}));
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
  await userEvent.click(await screen.findByRole('combobox', { name: 'Enviar para' }));
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
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /WhatsApp oficial/ })).toHaveAttribute('aria-disabled', 'true');
    s.canais.mockResolvedValueOnce([canal]);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.queryByText('Não deu pra carregar')).toBeNull());
    expect(screen.getByRole('radio', { name: /WhatsApp oficial/ })).not.toHaveAttribute('aria-disabled');
    await userEvent.click(screen.getByRole('radio', { name: /WhatsApp oficial/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo' }));
    expect(await screen.findByRole('group', { name: 'Modelo aprovado' })).toBeInTheDocument();
  });
});

describe('BulkDispatchModal · miolo em grupos', () => {
  it('a primeira etapa tem os grupos "Por onde sai" e "Quem recebe", sem o alternador Novo/Disparos', async () => {
    s.etiquetas.mockResolvedValue({ data: [] });
    abrir();
    expect(await screen.findByRole('group', { name: 'Por onde sai' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Quem recebe' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Disparos/ })).toBeNull();
  });

  it('o passo da mensagem tem os grupos O que mandar e Sequência de mensagens; o canal é Campanha direta', async () => {
    s.etiquetas.mockResolvedValue({ data: [] });
    abrir();
    expect(await screen.findByRole('radio', { name: 'Campanha direta' })).toHaveAttribute('aria-checked', 'true');
    await screen.findByText('3 leads');
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    for (const nome of ['O que mandar', 'Sequência de mensagens']) {
      expect(await screen.findByRole('group', { name: nome })).toBeInTheDocument();
    }
  });
});
