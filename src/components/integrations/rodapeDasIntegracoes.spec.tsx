import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import AsanaConfigDialog from './AsanaConfigDialog';

// Janela com dois lados no rodapé (peça 17): Desconectar de um lado,
// Salvar do outro, no DialogFooter da casa.
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: () => '' }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/integrations/asanaService', () => ({
  default: {
    getConfiguration: vi.fn().mockResolvedValue({ connected: true, username: 'ana', email: 'a@x.com', tools: [] }),
    discoverTools: vi.fn().mockResolvedValue({ tools: [] }),
    saveConfiguration: vi.fn(),
    generateAuthorization: vi.fn(),
  },
}));

function abrir(onDisconnect?: () => void) {
  render(<AsanaConfigDialog open onOpenChange={vi.fn()} onSave={vi.fn()} onDisconnect={onDisconnect} agentId="1" />);
}

describe('rodapé das integrações', () => {
  it('com Desconectar: um de cada lado, no rodapé da casa', async () => {
    abrir(vi.fn());
    const salvar = await screen.findByRole('button', { name: 'Salvar' });
    const rodape = salvar.closest('[data-slot="dialog-footer"]') as HTMLElement;
    expect(rodape).not.toBeNull();
    expect(rodape.className).toContain('sm:justify-between');
    expect(within(rodape).getByRole('button', { name: 'Desconectar' })).toBeInTheDocument();
  });

  it('sem Desconectar: só o Salvar, sem separar os lados', async () => {
    abrir();
    const salvar = await screen.findByRole('button', { name: 'Salvar' });
    const rodape = salvar.closest('[data-slot="dialog-footer"]') as HTMLElement;
    expect(rodape.className).not.toContain('sm:justify-between');
    await waitFor(() => expect(within(rodape).queryByRole('button', { name: 'Desconectar' })).toBeNull());
  });
});
