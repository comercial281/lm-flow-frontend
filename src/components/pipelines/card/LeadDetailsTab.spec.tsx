// src/components/pipelines/card/LeadDetailsTab.spec.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import LeadDetailsTab from './LeadDetailsTab';

const list = vi.hoisted(() => vi.fn());
vi.mock('@/services/contacts/leadTimelineService', () => ({ leadTimelineService: { list } }));
vi.mock('@/services/notes/notesService', () => ({
  notesService: { getByContact: vi.fn().mockResolvedValue([]), create: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/components/chat/contact-sidebar/AiUnderstandingPanel', () => ({ default: () => null }));
vi.mock('./OutrasInformacoes', () => ({ default: () => null }));
vi.mock('@/components/pipelines/CardPropertyInterests', () => ({
  default: ({ compacto }: { compacto?: boolean }) => <div data-testid="imoveis" data-compacto={String(Boolean(compacto))} />,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const item = {
  id: 'i1',
  pipeline_id: 'p1',
  stage_id: 's1',
  contact: { id: 'c1', name: 'Maria Souza', custom_attributes: {} },
} as never;

beforeEach(() => {
  list.mockReset().mockResolvedValue({
    events: [
      { id: 'mov-1', category: 'alteracao', kind: 'stage_changed', title: 'Mudou de etapa', detail: 'Novo → 1º contato',
        actor: 'Ana', occurred_at: '2026-10-07T12:00:00.000000Z', pipeline_name: 'Leads (Marketing)', tone: 'neutral' },
      { id: 'note-1', category: 'observacao', kind: 'note_added', title: 'Observação adicionada', detail: 'Ligar às 18h',
        actor: 'Ana', occurred_at: '2026-10-07T11:00:00.000000Z', pipeline_name: null, tone: 'neutral' },
    ],
    next_before: null,
  });
});

describe('LeadDetailsTab › Histórico da janela', () => {
  it('mostra o Histórico novo, compacto, e as Observações continuam numa caixa separada', async () => {
    render(
      <LeadDetailsTab item={item} mostrarImoveis={false} mostrarObservacoes versaoHistorico="0" funilAtual="Leads (Marketing)" />,
    );

    const historico = await screen.findByRole('region', { name: 'Histórico do lead' });
    expect(await within(historico).findByText('Mudou de etapa')).toBeInTheDocument();
    expect(within(historico).queryByText('Ligar às 18h')).not.toBeInTheDocument();
    expect(within(historico).queryByRole('button', { name: 'Observações' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Observações' })).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith('c1', { category: 'resumo' });
  });

  it('sem a função de Observações do cliente, só o Histórico', async () => {
    render(<LeadDetailsTab item={item} mostrarImoveis={false} mostrarObservacoes={false} versaoHistorico="0" />);

    await screen.findByRole('region', { name: 'Histórico do lead' });
    expect(screen.queryByRole('heading', { name: 'Observações' })).not.toBeInTheDocument();
  });
});

describe('LeadDetailsTab › caixas da mesma altura', () => {
  const props = { item, mostrarImoveis: true, mostrarObservacoes: true, versaoHistorico: '0' };

  it('linha de cima com três caixas: Sobre o lead, Histórico e Observações; imóveis embaixo na largura toda', async () => {
    render(<Suspense fallback={null}><LeadDetailsTab {...props} /></Suspense>);
    const linha = screen.getByTestId('linha-de-cima');
    expect(within(linha).getByRole('heading', { name: /Sobre o lead/ })).toBeInTheDocument();
    expect(within(linha).getByRole('heading', { name: /Histórico/ })).toBeInTheDocument();
    expect(within(linha).getByRole('heading', { name: /Observações/ })).toBeInTheDocument();
    expect((await screen.findByTestId('imoveis')).closest('[data-testid="linha-de-cima"]')).toBeNull();
  });

  it('sem Observações, a linha de cima fica com duas colunas (sem faixa vazia)', () => {
    render(<LeadDetailsTab {...props} mostrarImoveis={false} mostrarObservacoes={false} />);
    const linha = screen.getByTestId('linha-de-cima');
    expect(linha.className).toContain('lg:grid-cols-[1fr_1.4fr]');
    expect(linha.className).not.toContain('lg:grid-cols-[1fr_1.2fr_1.2fr]');
    expect(linha.querySelectorAll(':scope > section')).toHaveLength(2);
  });

  it('com Observações, três colunas', () => {
    render(<LeadDetailsTab {...props} mostrarImoveis={false} />);
    expect(screen.getByTestId('linha-de-cima').className).toContain('lg:grid-cols-[1fr_1.2fr_1.2fr]');
  });

  it('com imóveis, a linha de cima fica com a sobra (mín. 240 px) e os imóveis têm a altura do conteúdo', async () => {
    render(<Suspense fallback={null}><LeadDetailsTab {...props} /></Suspense>);
    const linha = screen.getByTestId('linha-de-cima');
    expect(linha.className).toContain('flex-1');
    expect(linha.className).toContain('lg:min-h-[240px]');
    expect(linha.className).not.toContain('lg:h-[236px]');
    const imoveis = await screen.findByTestId('imoveis');
    expect(imoveis).toHaveAttribute('data-compacto', 'true');
    expect(imoveis.parentElement?.className ?? '').not.toContain('lg:flex-1');
  });

  it('sem imóveis, a linha de cima ocupa a altura toda', () => {
    render(<LeadDetailsTab {...props} mostrarImoveis={false} />);
    const linha = screen.getByTestId('linha-de-cima');
    expect(linha.className).toContain('flex-1');
    expect(screen.queryByRole('heading', { name: /Imóveis de interesse/ })).not.toBeInTheDocument();
  });

  it('Sobre o lead junta Respostas do formulário com o aviso de quando não há resposta', () => {
    render(<LeadDetailsTab {...props} mostrarImoveis={false} />);
    const sobre = screen.getByRole('heading', { name: /Sobre o lead/ }).closest('section') as HTMLElement;
    expect(within(sobre).getByText('Este lead não respondeu formulário.')).toBeInTheDocument();
    expect(within(sobre).queryByText(/Ver todas/)).not.toBeInTheDocument();
  });
});

describe('LeadDetailsTab › cabeçalhos enxutos', () => {
  const props = { item, mostrarImoveis: false, mostrarObservacoes: true, versaoHistorico: '0' };

  it('o botão de atualizar fica no cabeçalho da caixa Histórico e recarrega', async () => {
    render(<LeadDetailsTab {...props} />);
    await screen.findByText('Mudou de etapa');
    const caixa = screen.getByRole('heading', { name: 'Histórico' }).closest('section') as HTMLElement;
    const cabecalho = screen.getByRole('heading', { name: 'Histórico' }).parentElement as HTMLElement;
    const botao = within(cabecalho).getByRole('button', { name: 'Atualizar histórico' });
    expect(within(caixa).getAllByRole('button', { name: 'Atualizar histórico' })).toHaveLength(1);
    const antes = list.mock.calls.length;
    await userEvent.click(botao);
    expect(list.mock.calls.length).toBeGreaterThan(antes);
  });

  it('os filtros do Histórico ficam numa linha só (sem quebrar)', async () => {
    render(<LeadDetailsTab {...props} />);
    const grupo = await screen.findByRole('group', { name: 'Filtrar o histórico' });
    expect(grupo.className).toContain('flex-nowrap');
    expect(grupo.className).toContain('overflow-x-auto');
    expect(grupo.className).not.toContain('flex-wrap');
  });

  it('Observações na janela: sem a linha do atalho, botão Postar com nome, Ctrl+Enter ainda posta', async () => {
    const { notesService } = await import('@/services/notes/notesService');
    (notesService.create as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({ id: 'n1', content: 'oi', created_at: '2026-10-14T10:00:00Z' });
    render(<LeadDetailsTab {...props} />);
    const caixa = screen.getByRole('heading', { name: 'Observações' }).closest('section') as HTMLElement;
    expect(within(caixa).queryByText(/Ctrl \+ Enter/)).not.toBeInTheDocument();
    const postar = within(caixa).getByRole('button', { name: 'Postar' });
    expect(postar).toBeDisabled();
    const campo = within(caixa).getByRole('textbox');
    expect(campo).toHaveAttribute('rows', '1');
    await userEvent.type(campo, 'oi');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(notesService.create).toHaveBeenCalledWith('c1', { content: 'oi' });
  });

  it('Observações na janela: o vazio é compacto', async () => {
    render(<LeadDetailsTab {...props} />);
    expect(await screen.findByText('Nenhum comentário ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Seja o primeiro a postar.')).not.toBeInTheDocument();
  });
});
