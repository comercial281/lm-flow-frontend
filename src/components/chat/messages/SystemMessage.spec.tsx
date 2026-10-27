import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import SystemMessage from './SystemMessage';
import type { Message } from '@/types/chat/api';

vi.mock('@/utils/time/timeHelpers', () => ({
  formatMessageTime: () => '15:42',
}));

const msg = (content: string, event?: Record<string, unknown>): Message =>
  ({
    id: '1',
    content,
    content_attributes: event ? { event } : {},
    created_at: '2026-10-20T18:42:00Z',
    message_type: 2,
  }) as unknown as Message;

const etiquetas = [
  { id: 'l1', title: 'quente', color: '#2EAD4F' },
  { id: 'l2', title: 'novo-lead', color: '#5B6EE0' },
];

describe('SystemMessage', () => {
  it('visit_scheduled vira cartão com título e data', () => {
    render(
      <SystemMessage
        message={msg('Visita agendada para sábado, 24/10 às 17:00', {
          type: 'visit_scheduled',
          by: 'Cirlei',
          scheduled_at: '2026-10-24T20:00:00Z',
          property: 'Apto 52',
          realtor: 'Cirlei',
        })}
      />,
    );
    expect(screen.getByText('Visita agendada')).toBeInTheDocument();
    expect(screen.getByText('Sábado, 24 out às 17h')).toBeInTheDocument();
    expect(screen.getByText('Apto 52 · com Cirlei')).toBeInTheDocument();
    expect(screen.getByText('Agendada por Cirlei')).toBeInTheDocument();
    expect(screen.getByText('15:42')).toBeInTheDocument();
    expect(document.querySelector('[data-pilula]')).toBeNull();
  });

  it('deal_lost mostra o motivo', () => {
    render(
      <SystemMessage
        message={msg('Negócio perdido', {
          type: 'deal_lost',
          by: 'Cirlei',
          pipeline: 'Vendas',
          stage: 'Visita',
          reason: 'Sem renda pra financiar',
        })}
      />,
    );
    expect(screen.getByText('Negócio perdido')).toBeInTheDocument();
    expect(screen.getByText('Motivo: Sem renda pra financiar')).toBeInTheDocument();
    expect(screen.getByText('Vendas · saiu da etapa Visita')).toBeInTheDocument();
    expect(screen.getByText('Marcado por Cirlei')).toBeInTheDocument();
    // o tom do perdido substitui o fundo padrão do cartão
    const cartao = document.querySelector('[data-cartao="perdido"]') as HTMLElement;
    expect(cartao).not.toHaveClass('bg-card');
    expect(cartao).toHaveClass('bg-[#FCEFEE]');
  });

  it('visit_completed mostra 4 estrelas', () => {
    render(
      <SystemMessage
        message={msg('Visita realizada', {
          type: 'visit_completed',
          by: 'Cirlei',
          property: 'Apto 52',
          rating: 4,
          feedback: 'Gostou da planta',
        })}
      />,
    );
    expect(screen.getByRole('img', { name: '4 de 5 estrelas' })).toBeInTheDocument();
    expect(screen.getByText('"Gostou da planta"')).toBeInTheDocument();
    expect(screen.getByText('Retorno de Cirlei')).toBeInTheDocument();
  });

  it('type desconhecido cai na pílula com o content', () => {
    const frase = 'Visita agendada para sábado, 24/10 às 17:00 · Apto 52 (Cirlei)';
    render(<SystemMessage message={msg(frase, { type: 'algo_novo', by: 'Cirlei' })} />);
    const pilula = document.querySelector('[data-pilula]') as HTMLElement;
    expect(pilula).not.toBeNull();
    expect(within(pilula).getByText(frase)).toBeInTheDocument();
    expect(within(pilula).getByText('15:42')).toBeInTheDocument();
    expect(screen.queryByText('Visita agendada')).toBeNull();
  });

  it('etiqueta adicionada: uma linha só, com nome, etiqueta e hora', () => {
    render(<SystemMessage message={msg('Cirlei adicionou quente', undefined)} labels={etiquetas} />);
    const pilulas = document.querySelectorAll('[data-pilula]');
    expect(pilulas).toHaveLength(1);
    const pilula = pilulas[0] as HTMLElement;
    expect(within(pilula).getByText('Cirlei').tagName).toBe('B');
    expect(within(pilula).getByText('quente')).toBeInTheDocument();
    expect(within(pilula).getByText('15:42')).toBeInTheDocument();
    expect(pilula).toHaveTextContent('Cirlei adicionou quente 15:42');
    // ícone de etiqueta, mesmo quando o nome da etiqueta lembra outra coisa
    expect(pilula.querySelector('svg.lucide-tag')).not.toBeNull();
  });

  it('etiqueta com nome de agenda continua com o ícone de etiqueta', () => {
    render(
      <SystemMessage
        message={msg('Cirlei adicionou visita-agendada', undefined)}
        labels={[{ id: 'l3', title: 'visita-agendada', color: '#2EAD4F' }]}
      />,
    );
    const pilula = document.querySelector('[data-pilula]') as HTMLElement;
    expect(pilula.querySelector('svg.lucide-tag')).not.toBeNull();
    expect(pilula.querySelector('svg.lucide-calendar')).toBeNull();
  });

  it('etiqueta removida sai riscada', () => {
    render(<SystemMessage message={msg('Cirlei removeu novo-lead', undefined)} labels={etiquetas} />);
    const chip = screen.getByText('novo-lead').closest('[data-etiqueta]') as HTMLElement;
    expect(chip).toHaveClass('line-through');
  });

  it('cartão não é link nem botão', () => {
    render(
      <SystemMessage
        message={msg('Tarefa concluída', { type: 'task_completed', by: 'Cirlei', title: 'Ligar', on_time: true })}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('tarefa concluída: título riscado', () => {
    render(
      <SystemMessage
        message={msg('Tarefa concluída', { type: 'task_completed', by: 'Cirlei', title: 'Ligar pra confirmar', on_time: true })}
      />,
    );
    expect(screen.getByText('Ligar pra confirmar')).toHaveClass('line-through');
    expect(screen.getByText('Concluída por Cirlei, no prazo')).toBeInTheDocument();
  });

  it('rodapé da IA ganha o brilho', () => {
    render(
      <SystemMessage
        message={msg('Visita agendada', { type: 'visit_scheduled', by_ai: true, scheduled_at: '2026-10-24T20:00:00Z' })}
      />,
    );
    const rodape = screen.getByText('Agendada pela IA Vendedora');
    expect(rodape.closest('[data-rodape-ia]')).not.toBeNull();
  });

  it('pílula de evento: retorno da visita com estrelas', () => {
    render(<SystemMessage message={msg('Retorno', { type: 'visit_feedback', by: 'Cirlei', rating: 3 })} />);
    const pilula = document.querySelector('[data-pilula]') as HTMLElement;
    expect(within(pilula).getByText('Cirlei').tagName).toBe('B');
    expect(within(pilula).getByText('deu o retorno da visita')).toBeInTheDocument();
    expect(within(pilula).getByRole('img', { name: '3 de 5 estrelas' })).toBeInTheDocument();
  });

  it('linha de sistema sem evento continua com o texto, agora em pílula', () => {
    render(<SystemMessage message={msg('Atribuído a Cirlei pela Roleta', undefined)} />);
    const pilula = document.querySelector('[data-pilula]') as HTMLElement;
    expect(within(pilula).getByText('Atribuído a Cirlei pela Roleta')).toBeInTheDocument();
    expect(pilula.querySelector('svg')).not.toBeNull();
  });
});
