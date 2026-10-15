import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GruposLiberadosBloco } from './GruposLiberadosBloco';

const svc = vi.hoisted(() => ({ dadosDeProvisionamento: vi.fn() }));
vi.mock('@/services/superAdmin/clientesService', () => ({ clientesService: svc }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const central = [
  { jid: '222@g.us', name: 'APTO PREMIUM x Leal Mídia' },
  { jid: '333@g.us', name: 'LM FLOW LOGS' },
];
const base = { id: 't1', name: 'APTO PREMIUM' } as never;
const legado = { reminder: '', logs: '' };

describe('bloco Grupos WhatsApp (lista liberada)', () => {
  beforeEach(() => { svc.dadosDeProvisionamento.mockResolvedValue({ whatsapp_groups: central, templates: [] }); });

  it('cliente não mapeado mostra o aviso e pré-preenche a sugestão ao montar a lista', async () => {
    const patch = vi.fn().mockResolvedValue({});
    render(<GruposLiberadosBloco cliente={{ ...base, settings: {} }} groupJids={legado} patch={patch} />);

    expect(screen.getByText(/Ainda não mapeado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Montar lista' }));
    await waitFor(() => expect(screen.getByText('APTO PREMIUM x Leal Mídia')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Salvar lista' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith({
      allowed_whatsapp_groups: [{ jid: '222@g.us', name: 'APTO PREMIUM x Leal Mídia', kind: 'cliente' }],
      whatsapp_reminder_group_jid: '', whatsapp_logs_group_jid: '',
    }));
  });

  it('adiciona um grupo interno e remove outro', async () => {
    const patch = vi.fn().mockResolvedValue({});
    const settings = { allowed_whatsapp_groups: [{ jid: '222@g.us', name: 'APTO PREMIUM x Leal Mídia', kind: 'cliente' }] };
    render(<GruposLiberadosBloco cliente={{ ...base, settings }} groupJids={legado} patch={patch} />);

    expect(screen.getByText('Com o cliente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar grupo' }));
    await waitFor(() => expect(screen.getByLabelText('Grupo')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: '333@g.us' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'logs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover APTO PREMIUM x Leal Mídia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar lista' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith(expect.objectContaining({
      allowed_whatsapp_groups: [{ jid: '333@g.us', name: 'LM FLOW LOGS', kind: 'logs' }],
    })));
  });
});
