// Enviar modelo: o botão de enviar fica no rodapé da casa, fora da área que rola.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageTemplateModal from './MessageTemplateModal';

const tpl = vi.hoisted(() => ({ id: 't1', name: 'boas_vindas', category: 'UTILITY', language: 'pt_BR', components: [{ type: 'BODY', text: 'Oi' }] }));
vi.mock('@/services/channels/messageTemplatesService', () => ({
  default: { getTemplates: vi.fn().mockResolvedValue({ data: [tpl] }), extractVariables: () => [] },
}));
const tEstavel = vi.hoisted(() => (k: string) => k);
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: tEstavel }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

describe('MessageTemplateModal · rodapé', () => {
  it('o enviar está no rodapé da casa e chama o envio', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageTemplateModal isOpen inboxId="i1" onClose={() => {}} onSend={onSend} />);
    await userEvent.click(await screen.findByText('boas_vindas'));
    const enviar = await screen.findByRole('button', { name: 'messageTemplates.parser.sendMessageLabel' });
    expect(enviar.closest('[data-slot="dialog-footer"]')).not.toBeNull();
    await userEvent.click(enviar);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
