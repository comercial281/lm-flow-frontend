import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';

const listLessons = vi.hoisted(() => vi.fn());
const listDocuments = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const conhecimentosDeFabrica = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', async (orig) => ({
  ...(await orig<object>()),
  salesAgentsService: { listLessons, listDocuments, update, conhecimentosDeFabrica },
}));
const toastErro = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: toastErro }) }));

import TelaEnsinar from './TelaEnsinar';

function Endereco() { return <output aria-label="endereço">{useLocation().search}</output>; }
function abrir(url = '/ia-vendedora?ia=ia-1&tela=ensinar', agent = agenteDeTeste()) {
  const aoSalvo = vi.fn();
  render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/ia-vendedora" element={<>
    <TelaEnsinar agent={agent} onCountChange={vi.fn()} aoSalvo={aoSalvo} /><Endereco /></>} /></Routes></MemoryRouter>);
  return { aoSalvo };
}
const contador = (extra = {}) => ({ valendo: 0, pausadas: 0, fora_por_tamanho: 0, cabem: 40, ...extra });
const resposta = (extra = {}) => ({
  licoes: [{ id: 'r', kind: 'rule', content: 'x', context: 'y', enabled: true, created_at: '', origin: 'equipe', topic: null, bad_content: null, why: null, in_use: true }],
  limites: { per_kind: 40, conversations: 6 },
  contadores: { regras: contador({ valendo: 1 }), exemplos: contador({ cabem: 20 }) },
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  listLessons.mockResolvedValue(resposta());
  listDocuments.mockResolvedValue([]);
  conhecimentosDeFabrica.mockResolvedValue([]);
});

describe('TelaEnsinar', () => {
  it('sem página abre Lições e grava no endereço', async () => {
    abrir();
    expect(await screen.findByRole('heading', { name: 'Lições' })).toBeInTheDocument();
    expect(screen.getByLabelText('endereço').textContent).toContain('pagina=licoes');
  });

  it('o trilho tem as 5 páginas na ordem da spec', async () => {
    abrir();
    const nomes = (await screen.findAllByRole('button', { name: /^(Lições|Exemplos|Regras e objeções|Conhecimentos|Arquivos)/ })).map((b) => b.textContent);
    expect(nomes.map((n) => n?.replace(/\d+$/, ''))).toEqual(['Lições', 'Exemplos', 'Regras e objeções da casa', 'Conhecimentos de fábrica', 'Arquivos e prova social']);
  });

  it('endereço antigo cai na página nova e o endereço é reescrito', async () => {
    abrir('/ia-vendedora?ia=ia-1&tela=ensinar&pagina=instrucoes');
    expect(await screen.findByRole('heading', { name: 'Regras e objeções da casa' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('endereço').textContent).toContain('pagina=casa'));
  });

  it('a bolinha de pendência das Lições é lição fora por tamanho', async () => {
    listLessons.mockResolvedValue(resposta({ contadores: { regras: contador({ valendo: 40, fora_por_tamanho: 1 }), exemplos: contador({ cabem: 20 }) } }));
    abrir();
    expect(await screen.findByRole('button', { name: /Lições.*tem pendência/ })).toBeInTheDocument();
  });

  it('a contagem de Exemplos ignora conversa real com resposta vazia (o servidor descarta)', async () => {
    abrir(undefined, agenteDeTeste({ example_conversations: [{ lead: 'a', resposta: 'ok' }, { lead: 'b', resposta: '  ' }] }));
    expect(await screen.findByRole('button', { name: /^Exemplos/ })).toHaveTextContent(/^Exemplos.*1$/);
  });

  it('trocar de página empurra no endereço', async () => {
    abrir('/ia-vendedora?ia=ia-1&tela=ensinar&pagina=licoes');
    await userEvent.click(screen.getByRole('button', { name: /Arquivos e prova social/ }));
    expect(screen.getByLabelText('endereço').textContent).toContain('pagina=arquivos');
    expect(screen.getByRole('heading', { name: 'Arquivos e prova social' })).toBeInTheDocument();
  });

  // A régua de verdade (a mesma do Configurar): a página que grava campo escondido quebra aqui, não em produção.
  it('Regras da casa grava pelo caminho de verdade (campo liberado) e a frase do servidor vem como veio', async () => {
    update.mockRejectedValueOnce({ response: { data: { error: { message: 'Regras da casa: no máximo 30 linhas.' } } } });
    abrir('/ia-vendedora?ia=ia-1&tela=ensinar&pagina=casa', agenteDeTeste({ id: 'ia-regua', house_rules: [] }));
    await userEvent.type(await screen.findByLabelText('Nova regra'), 'Fale simples');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar regra' }));
    await waitFor(() => expect(toastErro).toHaveBeenCalledWith('Regras da casa: no máximo 30 linhas.'));
    expect(update).toHaveBeenCalledWith('ia-regua', { house_rules: ['Fale simples'] });
  });
});
