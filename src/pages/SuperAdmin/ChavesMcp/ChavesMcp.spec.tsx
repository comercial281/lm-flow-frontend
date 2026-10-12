// src/pages/SuperAdmin/ChavesMcp/ChavesMcp.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const svc = vi.hoisted(() => ({ listar: vi.fn(), gerar: vi.fn(), revogar: vi.fn() }));
vi.mock('@/services/superAdmin/mcpKeysService', () => ({ mcpKeysService: svc }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import ChavesMcp from './index';

const ativa = { id: 'k1', name: 'Claude do Tony', key_prefix: 'AbC123', created_by_email: 'tony@x.com',
  created_at: '2026-10-11T10:00:00Z', last_used_at: null, revoked_at: null, active: true };

const abrir = () => render(<MemoryRouter><ChavesMcp /></MemoryRouter>);

describe('Chaves do MCP', () => {
  beforeEach(() => { vi.clearAllMocks(); svc.listar.mockResolvedValue([ativa]); });

  it('lista com o começo da chave e a situação', async () => {
    abrir();
    expect(await screen.findByText('Claude do Tony')).toBeInTheDocument();
    expect(screen.getByText(/AbC123/)).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
    expect(screen.getByText('Nunca usada')).toBeInTheDocument();
  });

  it('gera e mostra o endereço uma vez só', async () => {
    svc.gerar.mockResolvedValue({ ...ativa, id: 'k2', name: 'Celular', url: 'https://api.x/mcp/lmf_segredo' });
    abrir();
    await screen.findByText('Claude do Tony');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar chave' }));
    await userEvent.type(screen.getByLabelText('Nome da chave'), 'Celular');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar' }));
    expect(svc.gerar).toHaveBeenCalledWith('Celular');
    expect(await screen.findByDisplayValue('https://api.x/mcp/lmf_segredo')).toBeInTheDocument();
    expect(screen.getByText(/não aparece de novo/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Já guardei' }));
    await waitFor(() => expect(screen.queryByDisplayValue('https://api.x/mcp/lmf_segredo')).not.toBeInTheDocument());
  });

  it('revoga com confirmação', async () => {
    svc.revogar.mockResolvedValue({ ...ativa, active: false, revoked_at: '2026-10-11T11:00:00Z' });
    abrir();
    await screen.findByText('Claude do Tony');
    await userEvent.click(screen.getByRole('button', { name: 'Revogar Claude do Tony' }));
    await userEvent.click(screen.getByRole('button', { name: 'Revogar' }));
    expect(svc.revogar).toHaveBeenCalledWith('k1');
    expect(await screen.findByText('Revogada')).toBeInTheDocument();
  });

  it('erro ao carregar mostra tentar de novo', async () => {
    svc.listar.mockRejectedValue(new Error('x'));
    abrir();
    expect(await screen.findByText('Não deu para carregar as chaves')).toBeInTheDocument();
  });
});
