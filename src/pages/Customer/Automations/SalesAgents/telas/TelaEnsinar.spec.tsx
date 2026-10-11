import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const listLessons = vi.hoisted(() => vi.fn());
const listDocuments = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => ({ ...(await orig<object>()), salesAgentsService: { listLessons, listDocuments, update: vi.fn() } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import TelaEnsinar from './TelaEnsinar';

function Endereco() { return <output aria-label="endereço">{useLocation().search}</output>; }
function abrir(url = '/ia-vendedora?ia=ia-1&tela=ensinar') {
  render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/ia-vendedora" element={<>
    <TelaEnsinar agent={agenteDeTeste()} onCountChange={vi.fn()} aoSalvo={vi.fn()} /><Endereco /></>} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  listLessons.mockResolvedValue({ licoes: [{ id: 'r', kind: 'rule', content: 'x', context: null, enabled: true, created_at: '', origin: 'manual', in_use: false }], limites: { per_kind: 12, conversations: 6 } });
  listDocuments.mockResolvedValue([]);
});

describe('TelaEnsinar', () => {
  it('sem página abre Instruções e grava no endereço', async () => {
    abrir();
    expect(await screen.findByRole('heading', { name: 'Instruções' })).toBeInTheDocument();
    expect(screen.getByLabelText('endereço').textContent).toContain('pagina=instrucoes');
  });

  it('trilho com 2 grupos, 5 páginas, e pendência nas Regras', async () => {
    abrir();
    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(await screen.findByRole('button', { name: /Regras.*tem pendência/ })).toBeInTheDocument();
  });

  it('trocar de página empurra no endereço', async () => {
    abrir('/ia-vendedora?ia=ia-1&tela=ensinar&pagina=instrucoes');
    await userEvent.click(screen.getByRole('button', { name: /Prova social/ }));
    expect(screen.getByLabelText('endereço').textContent).toContain('pagina=prova');
    expect(screen.getByRole('heading', { name: 'Prova social' })).toBeInTheDocument();
  });
});
