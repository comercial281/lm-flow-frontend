// Janela "Nova lista no Bolsão": a largura acompanha o passo e o rodapé sempre
// tem "Cancelar" (antes a faixa ficava vazia no primeiro passo).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import bolsaoService from '@/services/bolsao/bolsaoService';
import BolsaoImportWizard from './BolsaoImportWizard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/bolsao/bolsaoService', () => ({
  default: { upload: vi.fn(), confirm: vi.fn(), updateBatch: vi.fn() },
}));

const LOTE = {
  id: 'b1', name: 'Lista de teste', file_name: 'lista.csv', total_rows: 2,
  headers: ['Nome', 'Telefone'], sample_rows: [['Ana', '11999990000'], ['Beto', '11988880000']],
  mapping: { '0': 'name', '1': 'phone_number' },
};

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  vi.mocked(bolsaoService.upload).mockResolvedValue(LOTE as never);
});

const abrir = () => render(<BolsaoImportWizard open onOpenChange={() => {}} onImported={() => {}} />);

describe('Nova lista no Bolsão', () => {
  it('primeiro passo tem Cancelar no rodapé e janela de 672 px', () => {
    abrir();
    const janela = screen.getByRole('dialog');
    expect(janela.className).toContain('max-w-2xl');
    expect(janela.className).not.toContain('1400px');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Está certo, importar/ })).not.toBeInTheDocument();
  });

  it('no passo de conferir a janela é larga e tem Importar', async () => {
    const { container } = abrir();
    const arquivo = new File(['Nome,Telefone'], 'lista.csv', { type: 'text/csv' });
    await userEvent.upload(container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement, arquivo);

    await waitFor(() => expect(screen.getByRole('button', { name: /Está certo, importar/ })).toBeEnabled());
    const janela = screen.getByRole('dialog');
    expect(janela.className).toContain('1400px');
    expect(janela.className).not.toContain('max-w-2xl');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('durante a importação, Esc não fecha a janela e Cancelar fica desligado', async () => {
    vi.mocked(bolsaoService.confirm).mockReturnValue(new Promise(() => {}) as never);
    const aoMudar = vi.fn();
    const { container } = render(<BolsaoImportWizard open onOpenChange={aoMudar} onImported={() => {}} />);
    const arquivo = new File(['Nome,Telefone'], 'lista.csv', { type: 'text/csv' });
    await userEvent.upload(container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement, arquivo);
    await userEvent.click(await screen.findByRole('button', { name: /Está certo, importar/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled());
    await userEvent.keyboard('{Escape}');
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('importação que termina fecha a janela e avisa a lista', async () => {
    vi.mocked(bolsaoService.confirm).mockResolvedValue({} as never);
    const aoMudar = vi.fn();
    const aoImportar = vi.fn();
    const { container } = render(<BolsaoImportWizard open onOpenChange={aoMudar} onImported={aoImportar} />);
    const arquivo = new File(['Nome,Telefone'], 'lista.csv', { type: 'text/csv' });
    await userEvent.upload(container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement, arquivo);
    await userEvent.click(await screen.findByRole('button', { name: /Está certo, importar/ }));

    await waitFor(() => expect(aoMudar).toHaveBeenCalledWith(false));
    expect(aoImportar).toHaveBeenCalledTimes(1);
  });

  it('importação que falha volta pro passo de conferir e deixa fechar', async () => {
    vi.mocked(bolsaoService.confirm).mockRejectedValue(new Error('falhou'));
    const aoMudar = vi.fn();
    const { container } = render(<BolsaoImportWizard open onOpenChange={aoMudar} onImported={() => {}} />);
    const arquivo = new File(['Nome,Telefone'], 'lista.csv', { type: 'text/csv' });
    await userEvent.upload(container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement, arquivo);
    await userEvent.click(await screen.findByRole('button', { name: /Está certo, importar/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled());
    expect(screen.getByRole('button', { name: /Está certo, importar/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(aoMudar).toHaveBeenCalledWith(false);
  });
});
