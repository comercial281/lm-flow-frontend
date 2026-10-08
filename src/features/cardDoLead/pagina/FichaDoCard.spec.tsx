// A Ficha da página do card (spec do funil §5.3): os blocos da janela, maiores,
// na ordem da spec; o bloco de Tarefas é o da sessão de Tarefas.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FichaDoCard from './FichaDoCard';

vi.mock('@/components/pipelines/card/LeadQuickActions', () => ({ default: () => <div data-testid="atalhos" /> }));
vi.mock('@/components/pipelines/FollowupTimeline', () => ({ default: () => <div data-testid="followup" /> }));
vi.mock('@/components/capi/CapiConversionPanel', () => ({
  default: (p: { variante?: string }) => <div data-testid="meta" data-variante={p.variante ?? 'completo'} />,
}));
vi.mock('@/components/pipelines/card/OutrasInformacoes', () => ({ default: () => <div data-testid="outras" /> }));
vi.mock('@/features/tarefas/TarefasDoLead', () => ({
  default: (p: { pipelineItemIds: string[]; criarNoCard: string | null }) => (
    <div data-testid="tarefas">tarefas de {p.pipelineItemIds.join(',')} · nova em {p.criarNoCard}</div>
  ),
}));
vi.mock('../blocos/BlocoIdentidade', () => ({ default: (p: { variante?: string }) => <div data-testid={`dados-${p.variante}`} /> }));
vi.mock('../blocos/BlocoSituacao', () => ({ AvisosDaRoleta: () => <div data-testid="roleta" /> }));
vi.mock('../blocos/BlocoSobreONegocio', () => ({ default: () => <div data-testid="negocio" /> }));
vi.mock('../blocos/BlocoEtiquetas', () => ({ default: () => <div data-testid="etiquetas" /> }));
vi.mock('../blocos/BlocoOQueAIAEntendeu', () => ({ default: () => <div data-testid="ia" /> }));
vi.mock('../blocos/BlocoImoveisDeInteresse', () => ({ default: () => <div data-testid="imoveis" /> }));
vi.mock('../blocos/BlocoRespostasDoFormulario', () => ({ default: () => <div data-testid="respostas" /> }));
vi.mock('./ColunaDoHistorico', () => ({ default: () => <div data-testid="coluna-historico" /> }));

const item = { id: 'i1', pipeline_id: 'p1', estimated_value: null, expected_close_on: null } as never;
const cardFalso = (recursos = { imoveis: true, notas: true, agendarEnvio: true }) => ({
  contato: { id: 'c1', name: 'Maria Souza' },
  nomeExibido: 'Maria Souza',
  item,
  conversa: { abrir: vi.fn(), abrindo: false },
  historico: { recarregar: vi.fn() },
  recursos,
}) as never;

describe('FichaDoCard', () => {
  it('esquerda na ordem da spec, direita com o Histórico', async () => {
    render(<FichaDoCard card={cardFalso()} item={item} aoMudarNegocio={vi.fn()} />);
    await screen.findByTestId('tarefas');
    const ordem = screen.getAllByTestId(/.+/).map(el => el.dataset.testid);

    expect(ordem).toEqual([
      'atalhos', 'tarefas', 'dados-pagina', 'roleta', 'negocio', 'etiquetas', 'followup', 'meta',
      'ia', 'imoveis', 'respostas', 'outras', 'coluna-historico',
    ]);
    expect(screen.getByRole('heading', { name: 'Ações rápidas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Etiquetas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Follow-up e Meta' })).toBeInTheDocument();
    expect(screen.getByTestId('meta')).toHaveAttribute('data-variante', 'completo');
  });

  it('com blocoDeTarefas={null}: nada no lugar', () => {
    render(<FichaDoCard card={cardFalso()} item={item} aoMudarNegocio={vi.fn()} blocoDeTarefas={null} />);
    expect(screen.queryByRole('heading', { name: 'Próximas tarefas' })).toBeNull();
    expect(screen.queryByTestId('tarefas')).toBeNull();
  });

  it('o bloco de Tarefas padrão: título "Próximas tarefas", as tarefas do card e a nova nasce nele', async () => {
    render(<FichaDoCard card={cardFalso()} item={item} aoMudarNegocio={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Próximas tarefas' })).toBeInTheDocument();
    expect(await screen.findByTestId('tarefas')).toHaveTextContent('tarefas de i1 · nova em i1');
  });

  it('imóveis de interesse só com o recurso ligado', () => {
    render(<FichaDoCard card={cardFalso({ imoveis: false, notas: true, agendarEnvio: true })} item={item} aoMudarNegocio={vi.fn()} blocoDeTarefas={null} />);
    expect(screen.queryByTestId('imoveis')).toBeNull();
  });
});
