import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

const list = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const criarNumero = vi.hoisted(() => vi.fn());
const inboxesList = vi.hoisted(() => vi.fn());
const contarPorMarca = vi.hoisted(() => vi.fn());
const aviso = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: aviso }));
vi.mock('@/services/salesAgents/salesAgentsService', () => ({ salesAgentsService: { list, create, criarNumero } }));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { contarPorMarca } }));
vi.mock('@/services/channels/inboxesService', () => ({ default: { list: inboxesList } }));

import NovoAgente from './NovoAgente';

const agente = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({
    id, name, enabled: true, inbox_id: null, triggers: [], trigger_keyword: null, absorbed_into_id: null,
    numbers: [{ id: `n-${id}`, inbox_id: 'in-1', triggers: null }],
    catalog_marks: { venda: 12, locacao: 0, leilao: 0, empreendimento: 3 },
    ...extra,
  });

function Endereco() {
  const l = useLocation();
  return <output aria-label="endereço">{`${l.pathname}${l.search}`}</output>;
}
function abrir() {
  render(
    <MemoryRouter initialEntries={['/ia-vendedora/novo']}>
      <Routes>
        <Route path="/ia-vendedora/novo" element={<NovoAgente />} />
        <Route path="*" element={<Endereco />} />
      </Routes>
    </MemoryRouter>,
  );
}
const seguir = () => userEvent.click(screen.getByRole('button', { name: 'Seguir' }));

async function ateOPasso2() {
  abrir();
  await userEvent.click(await screen.findByRole('radio', { name: 'Leva até a visita' }));
  await userEvent.type(screen.getByLabelText('Nome do agente'), 'Agente A');
  await seguir();
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([agente('ag-b', 'Agente B')]);
  inboxesList.mockResolvedValue({ data: [{ id: 'in-1', name: 'Ana' }, { id: 'in-2', name: 'Bia', whatsapp_cloud: { id: 1 } }, { id: 'in-3', name: 'Caio' }] });
  contarPorMarca.mockResolvedValue({ venda: 12, locacao: 0, leilao: 0, empreendimento: 3 });
  create.mockResolvedValue({ id: 'ag-novo', name: 'Agente A' });
  criarNumero.mockResolvedValue({ id: 'num-1', warnings: [] });
});

describe('NovoAgente', () => {
  it('mostra os 4 passos e o 1 não segue sem modo e sem nome', async () => {
    abrir();
    const trilha = await screen.findByRole('list', { name: 'Passos' });
    expect(within(trilha).getAllByRole('listitem').map((i) => i.textContent)).toEqual([
      '1 · Modo operante', '2 · Números e usuários', '3 · Quem fala', '4 · Produto',
    ]);
    const seguirBtn = screen.getByRole('button', { name: 'Seguir' });
    expect(seguirBtn).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Filtra e passa' }));
    expect(seguirBtn).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Nome do agente'), 'Agente A');
    expect(seguirBtn).toBeEnabled();
  });

  it('no passo 2, o número que já tem agente mostra o nome dele e avisa da divisão', async () => {
    await ateOPasso2();
    const ana = screen.getByRole('checkbox', { name: /Ana/ });
    expect(screen.getByText('Agente B')).toBeInTheDocument();
    expect(screen.queryByText(/pra dividir este número/)).toBeNull();
    await userEvent.click(ana);
    expect(screen.getByText('pra dividir este número, o agente Agente B vai precisar de gatilhos; ele não muda até você ligar este')).toBeInTheDocument();
  });

  it('o passo 4 vem com as marcas que têm imóvel marcadas, e as sem imóvel desmarcadas', async () => {
    await ateOPasso2();
    await seguir();
    await seguir();
    expect(screen.getByRole('checkbox', { name: /Venda/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Empreendimento/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Locação/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Leilão/ })).not.toBeChecked();
    expect(screen.getByText('12 no cadastro')).toBeInTheDocument();
  });

  it('conta SEM agente: as marcas com imóvel vêm marcadas, com o número certo', async () => {
    list.mockResolvedValue([]);
    contarPorMarca.mockResolvedValue({ venda: 7, locacao: 0, leilao: 0, empreendimento: 2 });
    await ateOPasso2();
    await seguir();
    await seguir();
    expect(await screen.findByText('7 no cadastro')).toBeInTheDocument();
    expect(screen.getByText('2 no cadastro')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Venda/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Empreendimento/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Locação/ })).not.toBeChecked();
  });

  it('contagem que falha: marcas sem número e desmarcadas, e o aviso só depois de tentar criar', async () => {
    contarPorMarca.mockRejectedValue(new Error('falhou'));
    await ateOPasso2();
    await seguir();
    await seguir();
    expect(screen.getByRole('checkbox', { name: /Venda/ })).not.toBeChecked();
    expect(screen.queryByText(/no cadastro/)).toBeNull();
    expect(screen.queryByText(/Marque pelo menos um/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Criar agente desligado' }));
    expect(screen.getByText(/Marque pelo menos um/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('número da API oficial leva o sufixo no passo 2', async () => {
    await ateOPasso2();
    expect(screen.getByRole('checkbox', { name: /Bia/ }).closest('label')).toHaveTextContent('Bia (API oficial)');
  });

  it('"Criar agente desligado": cria uma vez, um criarNumero por número, e abre o Configurar', async () => {
    await ateOPasso2();
    await userEvent.click(screen.getByRole('checkbox', { name: /Ana/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Bia/ }));
    await seguir();
    await seguir();
    await userEvent.click(screen.getByRole('button', { name: 'Criar agente desligado' }));
    expect(await screen.findByLabelText('endereço')).toHaveTextContent('/ia-vendedora?ia=ag-novo&tela=configurar');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      name: 'Agente A', enabled: false, job: 'leva_visita', next_steps: ['visita'], serves: ['venda', 'empreendimento'],
    });
    expect(criarNumero.mock.calls).toEqual([['ag-novo', { inbox_id: 'in-1' }], ['ag-novo', { inbox_id: 'in-2' }]]);
  });

  it('número que falha: o agente fica, abre em pagina=numeros e o aviso diz qual não entrou', async () => {
    criarNumero.mockResolvedValueOnce({ id: 'num-1', warnings: [] }).mockRejectedValueOnce(new Error('falhou'));
    await ateOPasso2();
    await userEvent.click(screen.getByRole('checkbox', { name: /Ana/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Bia/ }));
    await seguir();
    await seguir();
    await userEvent.click(screen.getByRole('button', { name: 'Criar agente desligado' }));
    await waitFor(() => expect(screen.getByLabelText('endereço')).toHaveTextContent('/ia-vendedora?ia=ag-novo&tela=configurar&pagina=numeros'));
    expect(create).toHaveBeenCalledTimes(1);
    expect(aviso.error).toHaveBeenCalledWith(expect.stringContaining('Bia'));
  });

  it('create que falha fica na tela, sem navegar e sem criar número', async () => {
    create.mockRejectedValueOnce(new Error('falhou'));
    await ateOPasso2();
    await userEvent.click(screen.getByRole('checkbox', { name: /Ana/ }));
    await seguir();
    await seguir();
    await userEvent.click(screen.getByRole('button', { name: 'Criar agente desligado' }));
    await waitFor(() => expect(aviso.error).toHaveBeenCalled());
    expect(criarNumero).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('endereço')).toBeNull();
    expect(screen.getByRole('button', { name: 'Criar agente desligado' })).toBeEnabled();
  });

  it('Voltar volta o passo sem perder o que foi escrito', async () => {
    await ateOPasso2();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByLabelText('Nome do agente')).toHaveValue('Agente A');
  });
});
