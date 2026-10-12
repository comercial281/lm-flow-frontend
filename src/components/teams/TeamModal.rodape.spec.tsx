import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamModal from './TeamModal';

// Peça 17: o Salvar da janela de equipe fica no rodapé da casa, fora da rolagem,
// e o envio continua chamando quem salva.
vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (k: string) => k }),
}));

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

describe('TeamModal: rodapé da casa', () => {
  it('Salvar está no dialog-footer e o submit chama onSubmit', async () => {
    const onSubmit = vi.fn();
    render(<TeamModal open onOpenChange={vi.fn()} isNew onSubmit={onSubmit} />);
    const enviar = screen.getByRole('button', { name: 'form.actions.create' });
    const rodape = enviar.closest('[data-slot="dialog-footer"]') as HTMLElement;
    expect(rodape).not.toBeNull();
    expect(within(rodape).getByRole('button', { name: 'form.actions.cancel' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /form.name/ }), 'Time A');
    await userEvent.click(enviar);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Time A' }));
  });
});
