// Janela "Adicionar Lead ao Funil": um aviso só por lead (10/10/2026).
// O quadro (onItemAdded) só recarrega; o aviso é desta janela.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { pipelinesService } from '@/services/pipelines';
import { contactsService } from '@/services/contacts';
import type { PipelineStage } from '@/types/analytics';
import AddItemModal from './AddItemModal';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), message: vi.fn() } }));
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (chave: string) => chave }),
}));
vi.mock('@/services/pipelines', () => ({
  pipelinesService: {
    getAvailableConversations: vi.fn(),
    getAvailableContacts: vi.fn(),
    addItemToPipeline: vi.fn(),
    moveItem: vi.fn(),
  },
}));
vi.mock('@/services/contacts', () => ({
  contactsService: {
    createContact: vi.fn(),
    updateContact: vi.fn(),
    searchContacts: vi.fn(),
    getContactPipelines: vi.fn(),
  },
}));

const ETAPA = { id: 's1', name: 'Novo', color: '#3B82F6', position: 1 } as unknown as PipelineStage;

const abrir = () => {
  const onItemAdded = vi.fn();
  render(
    <AddItemModal
      open
      onOpenChange={() => {}}
      pipelineId="p1"
      stages={[ETAPA]}
      preselectedStage={ETAPA}
      onItemAdded={onItemAdded}
    />,
  );
  return { onItemAdded };
};

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  vi.mocked(pipelinesService.getAvailableConversations).mockResolvedValue([
    { id: 'conv-1', contact: { id: 'k1', name: 'Maria Souza' } },
  ] as never);
  vi.mocked(pipelinesService.addItemToPipeline).mockResolvedValue({} as never);
  vi.mocked(contactsService.createContact).mockResolvedValue({ id: 'k9' } as never);
});

describe('Adicionar Lead ao Funil · um aviso só', () => {
  it('Criar novo lead: só "Lead criado e adicionado ao funil."', async () => {
    const { onItemAdded } = abrir();
    await userEvent.click(screen.getByRole('button', { name: /Criar novo lead/ }));
    await userEvent.type(screen.getByPlaceholderText('Nome do lead'), 'Ana Lima');
    await userEvent.click(screen.getByRole('button', { name: 'Criar e adicionar' }));

    await waitFor(() => expect(onItemAdded).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('addItem.created');
  });

  it('Lead reaproveitado (telefone/e-mail já cadastrado): um aviso só, "Lead já existia — adicionado ao funil."', async () => {
    vi.mocked(contactsService.createContact).mockRejectedValue({ response: { status: 422 } });
    vi.mocked(contactsService.searchContacts).mockResolvedValue({
      data: [{ id: 'k5', name: 'Ana Lima', email: 'ana@exemplo.com' }],
    } as never);
    const { onItemAdded } = abrir();
    await userEvent.click(screen.getByRole('button', { name: /Criar novo lead/ }));
    await userEvent.type(screen.getByPlaceholderText('Nome do lead'), 'Ana Lima');
    await userEvent.type(screen.getByPlaceholderText('email@exemplo.com'), 'ana@exemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Criar e adicionar' }));

    await waitFor(() => expect(onItemAdded).toHaveBeenCalledTimes(1));
    expect(pipelinesService.addItemToPipeline).toHaveBeenCalledWith('p1', expect.objectContaining({ item_id: 'k5' }));
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('addItem.reused');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('Lead existente: um aviso só, "Lead adicionado ao funil."', async () => {
    const { onItemAdded } = abrir();
    await userEvent.click(await screen.findByText('Maria Souza'));
    await userEvent.click(screen.getByRole('button', { name: 'addItem.add' }));

    await waitFor(() => expect(onItemAdded).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('addItem.success');
  });
});
