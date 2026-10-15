import { describe, it, expect } from 'vitest';
import type { PipelineItem } from '@/types/analytics';
import { linhaDaEtapa, posicaoDoMiniCard, proximaTarefa, telefoneDoMiniCard, textoDaTarefa } from './miniCard';

const card = (extra: Partial<PipelineItem> = {}) =>
  ({ id: 'i1', status: 'open', contact: { id: 'c1', phone_number: '+5511982353462' }, tasks_info: {}, ...extra }) as unknown as PipelineItem;
const comDono = { assignee: { id: 'u1', name: 'Ana' } } as unknown as Partial<PipelineItem>;

describe('telefoneDoMiniCard', () => {
  it('lead com dono mostra o número formatado e deixa copiar', () => {
    const t = telefoneDoMiniCard(card(comDono), { carregadas: true, temOferta: false });
    expect(t).toEqual({ texto: '(11) 98235-3462', mascarado: false, copiar: '+5511982353462' });
  });

  it('oferta da roleta aberta pra quem vê: mascarado e sem copiar', () => {
    const t = telefoneDoMiniCard(card(), { carregadas: true, temOferta: true });
    expect(t?.mascarado).toBe(true);
    expect(t?.copiar).toBeNull();
    expect(t?.texto).not.toContain('98235');
  });

  it('lead sem dono com a lista de ofertas ainda chegando também mascara', () => {
    expect(telefoneDoMiniCard(card(), { carregadas: false, temOferta: false })?.mascarado).toBe(true);
  });

  it('sem telefone, sem linha', () => {
    expect(telefoneDoMiniCard(card({ contact: { id: 'c1' } } as never), { carregadas: true, temOferta: false })).toBeNull();
  });
});

describe('linhaDaEtapa', () => {
  it('conta os dias, com menos de 1 dia no zero', () => {
    expect(linhaDaEtapa(card({ days_in_current_stage: 0 }))).toBe('Nesta etapa há menos de 1 dia');
    expect(linhaDaEtapa(card({ days_in_current_stage: 1 }))).toBe('Nesta etapa há 1 dia');
    expect(linhaDaEtapa(card({ days_in_current_stage: 4 }))).toBe('Nesta etapa há 4 dias');
  });

  it('card ganho ou perdido, ou sem o dado, não tem a linha', () => {
    expect(linhaDaEtapa(card({ status: 'won', days_in_current_stage: 4 }))).toBeNull();
    expect(linhaDaEtapa(card({ status: 'lost', days_in_current_stage: 4 }))).toBeNull();
    expect(linhaDaEtapa(card())).toBeNull();
  });
});

describe('proximaTarefa', () => {
  const agora = new Date('2026-10-15T12:00:00-03:00');
  const comTarefas = (due: (string | null)[]) =>
    card({ tasks_info: { open_tasks: due.map(d => ({ category_option_id: null, due_at: d })) } } as never);

  it('pega a de prazo mais próximo; sem prazo vai pro fim', () => {
    const t = proximaTarefa(comTarefas([null, '2026-10-17T10:00:00-03:00', '2026-10-16T09:30:00-03:00']), agora);
    expect(t).toEqual({ dueAt: '2026-10-16T09:30:00-03:00', atrasada: false });
  });

  it('prazo vencido é atrasada', () => {
    expect(proximaTarefa(comTarefas(['2026-10-14T10:00:00-03:00']), agora)?.atrasada).toBe(true);
  });

  it('só tarefa sem prazo: não é atrasada', () => {
    expect(proximaTarefa(comTarefas([null]), agora)).toEqual({ dueAt: null, atrasada: false });
  });

  it('sem tarefa aberta (ou servidor antigo), nada', () => {
    expect(proximaTarefa(comTarefas([]), agora)).toBeNull();
    expect(proximaTarefa(card(), agora)).toBeNull();
  });
});

describe('textoDaTarefa', () => {
  const agora = new Date('2026-10-15T12:00:00-03:00');
  it('título e quando, com o dia em minúscula no meio da frase', () => {
    expect(textoDaTarefa('Mandar simulação', '2026-10-16T09:30:00-03:00', agora)).toBe('Mandar simulação · amanhã às 09:30');
  });
  it('sem título vira "Tarefa marcada"; sem prazo diz', () => {
    expect(textoDaTarefa(null, null, agora)).toBe('Tarefa marcada · sem prazo');
    expect(textoDaTarefa('  ', '2026-10-15T15:00:00-03:00', agora)).toBe('Tarefa marcada · hoje às 15:00');
  });
});

describe('posicaoDoMiniCard', () => {
  const tela = { largura: 1400, altura: 900 };
  const mini = { largura: 288, altura: 160 };
  it('abre à direita quando cabe', () => {
    expect(posicaoDoMiniCard({ left: 100, right: 420, top: 200 }, tela, mini, false)).toEqual({ left: 428, top: 200, lado: 'direita' });
  });
  it('última coluna abre à esquerda', () => {
    expect(posicaoDoMiniCard({ left: 900, right: 1220, top: 200 }, tela, mini, true)).toEqual({ left: 604, top: 200, lado: 'esquerda' });
  });
  it('sem espaço à direita, vira pra esquerda; nunca sai da tela embaixo', () => {
    const p = posicaoDoMiniCard({ left: 1000, right: 1320, top: 850 }, tela, mini, false);
    expect(p.lado).toBe('esquerda');
    expect(p.top).toBe(900 - 160 - 8);
  });
});
