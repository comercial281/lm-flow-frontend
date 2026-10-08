// src/pages/Customer/Pipelines/CardCompleto/CardCompletoPage.spec.tsx
// Card completo (E4, spec do funil §5) + Review Focus 5: abre pelo endereço
// (F5, link colado), abre arquivado e de outra aba, e sem acesso avisa —
// nunca tela em branco.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CardCompletoPage from './CardCompletoPage';

const s = vi.hoisted(() => ({
  getPipelineItem: vi.fn(),
  archiveItem: vi.fn(),
  unarchiveItem: vi.fn(),
  setItemStatus: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  mover: vi.fn(),
  aoMudar: vi.fn(),
  menu: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: s.toastError, success: s.toastSuccess } }));
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: {
    getPipelineItem: s.getPipelineItem, archiveItem: s.archiveItem, unarchiveItem: s.unarchiveItem,
    setItemStatus: s.setItemStatus,
  },
}));
// O card de verdade tem a própria bateria (caracterização + hook): aqui
// interessa a página. O falso imita o "mover" avisando quem abriu.
vi.mock('@/features/cardDoLead/useCardDoLead', () => ({
  useCardDoLead: (
    item: { id: string; stage_id: string; status?: string; contact?: { id: string; name: string } },
    opcoes: { onItemStageMoved?: (i: string, e: string) => void },
  ) => ({
    item,
    contato: item.contact ?? null,
    nomeExibido: item.contact?.name ?? 'Lead sem nome',
    foraDoFunil: false,
    etapa: {
      id: item.stage_id,
      movendo: false,
      mover: async (id: string) => {
        s.mover(id);
        opcoes.onItemStageMoved?.(item.id, id);
      },
    },
    situacao: {
      item,
      fechado: item.status === 'won' || item.status === 'lost',
      aoMudar: s.aoMudar,
      rodapeSalvando: false,
      setRodapeSalvando: vi.fn(),
    },
    historico: { eventos: [], carregando: false, recarregar: vi.fn() },
    roleta: { ligadas: [], mandando: false, mandar: vi.fn(), ofertasAbertas: [], setOfertasAbertas: vi.fn(), tirando: false, setTirando: vi.fn() },
    juntar: { pode: false, juntando: false, setJuntando: vi.fn() },
    recursos: { notas: true, imoveis: true, agendarEnvio: false },
    origemManual: { texto: '', setTexto: vi.fn(), salvo: '', salvando: false, salvar: vi.fn() },
    envio: { agendando: null, setAgendando: vi.fn() },
  }),
}));
vi.mock('@/features/cardDoLead/pagina/FichaDoCard', () => ({ default: () => <div data-testid="ficha" /> }));
vi.mock('@/features/cardDoLead/blocos/DialogosDoCard', () => ({ default: () => null }));
vi.mock('@/features/cardDoLead/blocos/BlocoSituacao', () => ({ ResponsavelComFoto: () => <div data-testid="responsavel" /> }));
// As peças de situação são da Parte 3 (com a bateria delas).
vi.mock('@/components/pipelines/card/CardResultFooter', () => ({ default: () => <div data-testid="ganho-perdido" /> }));
vi.mock('@/features/pipelines/situacao/SeloSituacao', () => ({
  default: ({ status }: { status: string }) => (status === 'open' ? null : <span>{status === 'lost' ? 'PERDIDO' : 'GANHO'}</span>),
}));
vi.mock('@/components/pipelines/card/CardMoreMenu', () => ({
  default: (p: Record<string, unknown>) => {
    s.menu(p);
    return <button type="button" aria-label="Mais ações do card" />;
  },
}));
vi.mock('@/components/pipelines/CardConversationTab', () => ({ default: () => <div data-testid="aba-conversa" /> }));
vi.mock('@/components/pipelines/card/VisitsProposalsTab', () => ({ default: () => <div data-testid="aba-visitas" /> }));
vi.mock('@/components/pipelines/card/CardOriginTab', () => ({ default: () => <div data-testid="aba-origem" /> }));

const detalhe = (item: Record<string, unknown> = {}) => ({
  item: {
    id: 'i1',
    pipeline_id: 'p1',
    stage_id: 's2',
    status: 'open',
    archived_at: null,
    estimated_value: null,
    expected_close_on: null,
    contact: { id: 'c1', name: 'Maria Souza' },
    ...item,
  },
  stage_durations: [
    { stage_id: 's1', days: 2, current: false },
    { stage_id: 's2', days: 14, current: true },
  ],
  pipeline: {
    id: 'p1',
    name: 'Leads (Marketing)',
    stages: [
      { id: 's3', name: 'Proposta', color: '#f59e0b', position: 3 },
      { id: 's1', name: 'Novo', color: '#3b82f6', position: 1 },
      { id: 's2', name: '1º contato', color: '#22c55e', position: 2 },
      // A coluna do Ganho (ajuste de 08/10): tipo Concluída.
      { id: 's9', name: 'Concluído', color: '#10b981', position: 9, stage_type: 'completed' },
    ],
  },
});
const erroHttp = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

function abrirPagina(endereco = '/pipelines/p1/card/i1') {
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/pipelines/:pipelineId/card/:itemId" element={<CardCompletoPage />} />
        <Route path="/pipelines/:pipelineId" element={<p>Quadro do funil</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(s).forEach(f => f.mockReset());
  s.getPipelineItem.mockResolvedValue(detalhe());
  s.unarchiveItem.mockResolvedValue({});
  s.archiveItem.mockResolvedValue({});
});

describe('CardCompletoPage', () => {
  it('F5 / link colado: abre pelo endereço, com o nome no título e "← Funil <nome>"', async () => {
    abrirPagina();

    expect(await screen.findByRole('heading', { level: 1, name: 'Maria Souza' })).toBeInTheDocument();
    expect(s.getPipelineItem).toHaveBeenCalledWith('p1', 'i1');
    expect(screen.getByRole('link', { name: /Funil Leads \(Marketing\)/ })).toHaveAttribute('href', '/pipelines/p1');
    expect(screen.getByTestId('responsavel')).toBeInTheDocument();
    expect(screen.getByTestId('ganho-perdido')).toBeInTheDocument();
    expect(screen.getByTestId('ficha')).toBeInTheDocument();
  });

  it('enquanto carrega, o esqueleto', () => {
    s.getPipelineItem.mockReturnValue(new Promise(() => {}));
    abrirPagina();
    expect(screen.getByRole('status', { name: 'Carregando o card' })).toBeInTheDocument();
  });

  it.each([
    ['de outro corretor', 404],
    ['apagado', 404],
    ['recusado pelo cargo', 403],
  ])('card %s: "Você não tem acesso a este lead", com volta ao funil', async (_caso, status) => {
    s.getPipelineItem.mockRejectedValue(erroHttp(status));
    abrirPagina();

    expect(await screen.findByText('Você não tem acesso a este lead')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao funil' })).toHaveAttribute('href', '/pipelines/p1');
  });

  it('erro de servidor: "Tentar de novo" busca de novo', async () => {
    s.getPipelineItem.mockRejectedValueOnce(erroHttp(500)).mockResolvedValueOnce(detalhe());
    abrirPagina();

    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Maria Souza' })).toBeInTheDocument();
    expect(s.getPipelineItem).toHaveBeenCalledTimes(2);
  });

  it('faixa: etapas na ordem do funil, dias, e mover pede confirmação e recarrega os dias', async () => {
    abrirPagina();
    await screen.findByRole('heading', { level: 1, name: 'Maria Souza' });

    const nomes = screen.getAllByRole('listitem').map(li => li.textContent);
    expect(nomes[0]).toContain('Novo');
    expect(nomes[2]).toContain('Proposta');
    expect(screen.getByText('14 dias · atual')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mover para Proposta' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Mover' }));

    await waitFor(() => expect(s.mover).toHaveBeenCalledWith('s3'));
    await waitFor(() => expect(s.getPipelineItem).toHaveBeenCalledTimes(2));
  });

  // Ajuste de 08/10: clicar em Concluído na faixa é marcar Ganho (a rota da situação).
  it('faixa: clicar em Concluído pergunta "Marcar … como Ganho?", marca e recarrega', async () => {
    s.setItemStatus.mockResolvedValue({ id: 'i1', status: 'won', stage_id: 's9' });
    abrirPagina();
    await screen.findByRole('heading', { level: 1, name: 'Maria Souza' });

    await userEvent.click(screen.getByRole('button', { name: 'Mover para Concluído' }));
    expect(await screen.findByRole('dialog', { name: 'Marcar Maria Souza como Ganho?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como Ganho' }));

    await waitFor(() => expect(s.setItemStatus).toHaveBeenCalledWith('p1', 'i1', { status: 'won' }));
    expect(s.mover).not.toHaveBeenCalled();
    // O card acompanha (Etapa em Concluído, selo, Histórico) pelo mesmo caminho do rodapé.
    expect(s.aoMudar).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', status: 'won', stage_id: 's9' }));
    await waitFor(() => expect(s.getPipelineItem).toHaveBeenCalledTimes(2));
  });

  it('card perdido (de outra aba): selo PERDIDO e a faixa só informa', async () => {
    s.getPipelineItem.mockResolvedValue(detalhe({ status: 'lost' }));
    abrirPagina();

    expect(await screen.findByText('PERDIDO')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mover para/ })).toBeNull();
    expect(screen.getByText('Lead fechado não muda de etapa. Reabra para mexer.')).toBeInTheDocument();
  });

  it('card arquivado abre, com o aviso e Desarquivar', async () => {
    s.getPipelineItem.mockResolvedValue(detalhe({ archived_at: '2026-10-01T10:00:00Z' }));
    abrirPagina();

    expect(await screen.findByText(/Este lead está arquivado/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desarquivar' }));

    await waitFor(() => expect(s.unarchiveItem).toHaveBeenCalledWith('p1', 'i1'));
    await waitFor(() => expect(s.getPipelineItem).toHaveBeenCalledTimes(2));
  });

  it('abas: Ficha é a padrão; a aba vai no endereço e volta no F5', async () => {
    abrirPagina('/pipelines/p1/card/i1?aba=conversa');

    expect(await screen.findByTestId('aba-conversa')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Origem' }));
    expect(await screen.findByTestId('aba-origem')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Ficha' }));
    expect(await screen.findByTestId('ficha')).toBeInTheDocument();
  });

  it('⋯: copia o link DA PÁGINA, arquiva, e Remover do funil volta ao quadro', async () => {
    abrirPagina();
    await screen.findByRole('heading', { level: 1, name: 'Maria Souza' });
    const props = s.menu.mock.calls.at(-1)![0] as {
      linkDoCard: string;
      onArquivar?: () => void;
      onDesarquivar?: () => void;
      onRemovido: () => void;
    };

    expect(props.linkDoCard).toBe('/pipelines/p1/card/i1');
    expect(props.onDesarquivar).toBeUndefined();
    await act(async () => { props.onArquivar?.(); });
    await waitFor(() => expect(s.archiveItem).toHaveBeenCalledWith('p1', 'i1'));

    act(() => props.onRemovido());
    expect(await screen.findByText('Quadro do funil')).toBeInTheDocument();
  });
});
