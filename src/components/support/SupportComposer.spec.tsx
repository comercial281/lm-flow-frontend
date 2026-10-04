import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SupportComposer from './SupportComposer';

beforeAll(() => {
  // jsdom não tem createObjectURL; a miniatura só precisa de uma string.
  URL.createObjectURL = vi.fn(() => 'blob:mini');
  URL.revokeObjectURL = vi.fn();
});

const png = () => new File([new Uint8Array(10)], 'print.png', { type: 'image/png' });

describe('SupportComposer', () => {
  it('colar print vira miniatura e vai junto no envio', async () => {
    const onEnviar = vi.fn().mockResolvedValue(undefined);
    render(<SupportComposer onEnviar={onEnviar} />);
    const caixa = screen.getByRole('textbox');
    fireEvent.paste(caixa, { clipboardData: { files: [png()], items: [] } });
    expect(await screen.findByRole('img', { name: 'print.png' })).toBeInTheDocument();
    fireEvent.change(caixa, { target: { value: 'Olha o erro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(onEnviar).toHaveBeenCalledWith('Olha o erro', [expect.any(File)]));
    await waitFor(() => expect(caixa).toHaveValue(''));
  });

  it('imagem fora da regra mostra o motivo', () => {
    render(<SupportComposer onEnviar={vi.fn()} />);
    const svg = new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' });
    fireEvent.change(screen.getByLabelText('Anexar imagem'), { target: { files: [svg] } });
    expect(screen.getByText('Envie imagens em PNG, JPG ou WEBP.')).toBeInTheDocument();
  });

  it('exigeTexto: não envia só com imagem', () => {
    const onEnviar = vi.fn();
    render(<SupportComposer onEnviar={onEnviar} exigeTexto />);
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('falha no envio mantém o texto', async () => {
    const onEnviar = vi.fn().mockRejectedValue(new Error('x'));
    render(<SupportComposer onEnviar={onEnviar} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'não perder' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(onEnviar).toHaveBeenCalled());
    expect(screen.getByRole('textbox')).toHaveValue('não perder');
  });

  it('trava a caixa enquanto envia', async () => {
    let fim: () => void = () => {};
    const onEnviar = vi.fn(() => new Promise<void>(r => { fim = r; }));
    render(<SupportComposer onEnviar={onEnviar} />);
    const caixa = screen.getByRole('textbox');
    fireEvent.change(caixa, { target: { value: 'oi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(caixa).toBeDisabled());
    expect(screen.getByLabelText('Anexar imagem')).toBeDisabled();
    fim();
    await waitFor(() => expect(caixa).not.toBeDisabled());
    expect(caixa).toHaveValue('');
  });
});
