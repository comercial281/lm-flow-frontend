import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Chave, { MENSAGEM_ERRO_CHAVE, MENSAGEM_RECUSA_CHAVE } from './Chave';

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMock }));

const chave = () => screen.getByRole('switch', { name: 'Mandar lembrete no WhatsApp' });

describe('Chave: efeito na hora', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra o efeito e o estado em texto, não só cor', () => {
    render(<Chave rotulo="Mandar lembrete no WhatsApp" ligada={false} aoMudar={vi.fn()} />);
    expect(screen.getByText('Mandar lembrete no WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Desligado')).toBeInTheDocument();
    expect(chave()).toHaveAttribute('aria-checked', 'false');
  });

  it('liga, salva e confirma com "Ligado"', async () => {
    const aoMudar = vi.fn().mockResolvedValue(undefined);
    render(<Chave rotulo="Mandar lembrete no WhatsApp" ligada={false} aoMudar={aoMudar} />);
    await userEvent.click(chave());
    expect(aoMudar).toHaveBeenCalledWith(true);
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Ligado'));
    expect(chave()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Ligado')).toBeInTheDocument();
  });

  it('servidor recusou: volta sozinha e diz o que o servidor disse', async () => {
    const aoMudar = vi.fn().mockRejectedValue({ response: { status: 422, data: { message: 'Escolha um número antes' } } });
    render(<Chave rotulo="Mandar lembrete no WhatsApp" ligada={false} aoMudar={aoMudar} />);
    await userEvent.click(chave());
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Escolha um número antes'));
    expect(chave()).toHaveAttribute('aria-checked', 'false');
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('queda de rede: volta e usa a frase padrão; 403 culpa o cargo', async () => {
    const aoMudar = vi.fn().mockRejectedValueOnce(new Error('Network Error')).mockRejectedValueOnce({ response: { status: 403 } });
    render(<Chave rotulo="Mandar lembrete no WhatsApp" ligada={false} aoMudar={aoMudar} />);
    await userEvent.click(chave());
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(MENSAGEM_ERRO_CHAVE));
    await userEvent.click(chave());
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(MENSAGEM_RECUSA_CHAVE));
    expect(chave()).toHaveAttribute('aria-checked', 'false');
  });

  it('aoMudar devolveu false (desistiu): volta sem aviso nenhum', async () => {
    const aoMudar = vi.fn().mockResolvedValue(false);
    render(<Chave rotulo="Mandar lembrete no WhatsApp" ligada={false} aoMudar={aoMudar} />);
    await userEvent.click(chave());
    await waitFor(() => expect(chave()).toHaveAttribute('aria-checked', 'false'));
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('não aceita segundo clique enquanto o primeiro não voltou', async () => {
    let terminar: () => void = () => {};
    const aoMudar = vi.fn(() => new Promise<void>(r => { terminar = r; }));
    render(<Chave rotulo="Mandar lembrete no WhatsApp" ligada={false} aoMudar={aoMudar} />);
    await userEvent.click(chave());
    await userEvent.click(chave());
    expect(aoMudar).toHaveBeenCalledTimes(1);
    terminar();
    await waitFor(() => expect(chave()).not.toBeDisabled());
  });

  it('feminino e sem rótulo visível (linha de tabela) mantém o nome acessível', () => {
    render(<Chave rotulo="Mandar lembrete no WhatsApp" ligada genero="a" semRotuloVisivel aoMudar={vi.fn()} />);
    expect(screen.getByText('Ligada')).toBeInTheDocument();
    expect(chave()).toBeInTheDocument();
    expect(screen.queryByText('Mandar lembrete no WhatsApp')).not.toBeInTheDocument();
  });

  it('acompanha a mudança que vem de fora (a lista recarregou)', () => {
    const { rerender } = render(<Chave rotulo="Mandar lembrete no WhatsApp" ligada={false} aoMudar={vi.fn()} />);
    rerender(<Chave rotulo="Mandar lembrete no WhatsApp" ligada aoMudar={vi.fn()} />);
    expect(chave()).toHaveAttribute('aria-checked', 'true');
  });
});
