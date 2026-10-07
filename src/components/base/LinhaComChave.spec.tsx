import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';
import LinhaComChave from './LinhaComChave';

describe('LinhaComChave', () => {
  it('a chave tem o rótulo como nome e o que depende dela só aparece ligada', () => {
    const { rerender } = render(
      <LinhaComChave rotulo="Responder em áudio" ligada={false} aoMudar={vi.fn()}><p>vozes</p></LinhaComChave>,
    );
    expect(screen.getByRole('switch', { name: 'Responder em áudio' })).not.toBeChecked();
    expect(screen.queryByText('vozes')).toBeNull();
    rerender(<LinhaComChave rotulo="Responder em áudio" ligada aoMudar={vi.fn()}><p>vozes</p></LinhaComChave>);
    expect(screen.getByText('vozes')).toBeInTheDocument();
  });

  it('vira na hora e NÃO mostra o "Ligado" da Chave (quem avisa é o "Salvo · Desfazer")', async () => {
    const aoMudar = vi.fn().mockResolvedValue(true);
    render(<LinhaComChave rotulo="Curtir mensagens do lead" ligada={false} aoMudar={aoMudar} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Curtir mensagens do lead' }));
    expect(aoMudar).toHaveBeenCalledWith(true);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('aoMudar devolvendo false volta a chave sem aviso', async () => {
    render(<LinhaComChave rotulo="Ir atrás de quem parou de responder" ligada={false} aoMudar={vi.fn().mockResolvedValue(false)} />);
    const chave = screen.getByRole('switch', { name: 'Ir atrás de quem parou de responder' });
    await userEvent.click(chave);
    expect(chave).not.toBeChecked();
  });
});
