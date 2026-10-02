import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import SecaoFunil from './SecaoFunil';
import type { Pipeline } from '@/types/analytics';

// A seção Funil do painel do lead: trocar a etapa no seletor move o lead na
// hora, pelo mesmo serviço de arrastar no quadro.

const moveItem = vi.fn();
vi.mock('@/services/pipelines', () => ({
  pipelinesService: {
    moveItem: (...args: unknown[]) => moveItem(...args),
    updateItemInPipeline: vi.fn(),
  },
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) } }));

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@evoapi/design-system/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

// O seletor vira um <select> nativo: o que importa aqui é o valor escolhido.
vi.mock('@evoapi/design-system/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select aria-label="etapa" value={value} onChange={e => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));

vi.mock('@/components/pipelines/EditItemModal', () => ({
  default: () => <div>card-do-lead</div>,
}));

vi.mock('../PipelineManagement', () => ({
  default: () => <div>escolher-funil-e-etapa</div>,
}));

const etapa = (id: string, name: string, position: number, items: Pipeline['stages'][number]['items'] = []) => ({
  id, name, color: '#888', position, created_at: '', updated_at: '', items,
});

const funil = (): Pipeline =>
  ({
    id: 'funil-1',
    name: 'Funil de vendas',
    stages: [
      etapa('etapa-nova', 'Novo lead', 0),
      etapa('etapa-qualif', 'Qualificando', 1, [
        { id: 'item-9', item_id: 'conv-1', type: 'conversation', pipeline_id: 'funil-1', stage_id: 'etapa-qualif' },
      ] as never),
      etapa('etapa-visita', 'Visita agendada', 2),
    ],
  }) as unknown as Pipeline;

describe('SecaoFunil', () => {
  beforeEach(() => {
    moveItem.mockReset();
    toastError.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra "Funil de vendas · Etapa" com a etapa atual', () => {
    render(<SecaoFunil conversationId="conv-1" pipelines={[funil()]} carregando={false} onAtualizado={vi.fn()} />);
    expect(screen.getByText('Funil de vendas · Etapa')).toBeTruthy();
    expect((screen.getByLabelText('etapa') as HTMLSelectElement).value).toBe('etapa-qualif');
    expect(screen.getByText('Abrir card do lead')).toBeTruthy();
  });

  it('trocar a etapa chama moveItem com a etapa de origem e a de destino', async () => {
    moveItem.mockResolvedValue({ success: true });
    const onAtualizado = vi.fn();
    render(<SecaoFunil conversationId="conv-1" pipelines={[funil()]} carregando={false} onAtualizado={onAtualizado} />);

    fireEvent.change(screen.getByLabelText('etapa'), { target: { value: 'etapa-visita' } });

    await waitFor(() => expect(onAtualizado).toHaveBeenCalled());
    expect(moveItem).toHaveBeenCalledWith({
      item_id: 'item-9',
      pipeline_id: 'funil-1',
      from_stage_id: 'etapa-qualif',
      to_stage_id: 'etapa-visita',
    });
  });

  it('erro ao mover: avisa e a etapa volta', async () => {
    moveItem.mockRejectedValue(new Error('falhou'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SecaoFunil conversationId="conv-1" pipelines={[funil()]} carregando={false} onAtualizado={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('etapa'), { target: { value: 'etapa-visita' } });

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Não foi possível mudar a etapa.'));
    expect((screen.getByLabelText('etapa') as HTMLSelectElement).value).toBe('etapa-qualif');
  });

  it('"Abrir card do lead" abre o card completo', () => {
    render(<SecaoFunil conversationId="conv-1" pipelines={[funil()]} carregando={false} onAtualizado={vi.fn()} />);
    fireEvent.click(screen.getByText('Abrir card do lead'));
    expect(screen.getByText('card-do-lead')).toBeTruthy();
  });

  it('lead fora de funil: só "Colocar no funil", que pergunta funil e etapa', () => {
    render(<SecaoFunil conversationId="conv-1" pipelines={[]} carregando={false} onAtualizado={vi.fn()} />);
    expect(screen.queryByLabelText('etapa')).toBeNull();
    expect(screen.queryByText('escolher-funil-e-etapa')).toBeNull();

    fireEvent.click(screen.getByText('Colocar no funil'));
    expect(screen.getByText('escolher-funil-e-etapa')).toBeTruthy();
  });

  it('oferta da roleta aberta: o seletor fica, "Abrir card do lead" some', () => {
    render(<SecaoFunil conversationId="conv-1" pipelines={[funil()]} carregando={false} onAtualizado={vi.fn()} emOferta />);
    expect(screen.getByLabelText('etapa')).toBeTruthy();
    expect(screen.queryByText('Abrir card do lead')).toBeNull();
  });
});
