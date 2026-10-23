import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ResolverPausasDialog from './ResolverPausasDialog';
import { textoDePausados } from '@/features/flowAutomations/pausas';

const resolve = vi.fn();
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { resolveNumberConflicts: (...a: unknown[]) => resolve(...a) },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
import { toast } from 'sonner';

const base = { open: true, flowId: 'f1', count: 3, flowFinal: '92', canAlways: true, onClose: vi.fn(), onResolved: vi.fn() };

describe('ResolverPausasDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); resolve.mockResolvedValue({ resumed: 2, stopped: 0, skipped: 1, failed: 0 }); });

  it('singular e plural do título', () => {
    expect(textoDePausados(1)).toBe('1 lead pausado: já conversa em outro número');
    expect(textoDePausados(3)).toBe('3 leads pausados: já conversam em outro número');
  });

  it('manda pelo número do fluxo com "sempre", recarrega e avisa os que não puderam', async () => {
    render(<ResolverPausasDialog {...base} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Mandar pelo número do fluxo (final 92)' }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith('f1', { choice: 'flow', always: true }));
    await waitFor(() => expect(base.onResolved).toHaveBeenCalled());
    expect(toast.warning).toHaveBeenCalledWith('1 não pôde ir pela conversa: o número dela não manda mensagem sozinho.');
  });

  it('sem permissão de editar, não mostra "Fazer sempre assim" e manda always false', async () => {
    render(<ResolverPausasDialog {...base} canAlways={false} />);
    expect(screen.queryByText('Fazer sempre assim neste fluxo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mandar pela conversa dele' }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith('f1', { choice: 'conversation', always: false }));
  });

  it('failed com algum sucesso vira aviso; só failed vira erro; tudo zero diz que não há nada', async () => {
    resolve.mockResolvedValueOnce({ resumed: 1, stopped: 0, skipped: 0, failed: 2 });
    const { unmount } = render(<ResolverPausasDialog {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mandar pela conversa dele' }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('1 lead seguiu, 2 não deram certo.'));
    unmount();
    resolve.mockResolvedValueOnce({ resumed: 0, stopped: 0, skipped: 0, failed: 2 });
    const r2 = render(<ResolverPausasDialog {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mandar pela conversa dele' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('2 não deram certo.'));
    r2.unmount();
    resolve.mockResolvedValueOnce({ resumed: 0, stopped: 0, skipped: 0, failed: 0 });
    render(<ResolverPausasDialog {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mandar pela conversa dele' }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Nada pra resolver.'));
  });

  it('depois do 422 os botões voltam a ficar ativos', async () => {
    resolve.mockRejectedValue({ response: { data: { errors: ['Falhou aqui.'] } } });
    render(<ResolverPausasDialog {...base} />);
    const b = screen.getByRole('button', { name: 'Mandar pela conversa dele' });
    fireEvent.click(b);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect((b as HTMLButtonElement).disabled).toBe(false));
  });

  it('mostra o erro do servidor', async () => {
    resolve.mockRejectedValue({ response: { data: { errors: ['Falhou aqui.'] } } });
    render(<ResolverPausasDialog {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mandar pela conversa dele' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falhou aqui.'));
  });
});
