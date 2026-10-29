import { describe, expect, it } from 'vitest';
import type { Message } from '@/types/chat/api';
import { lerEvento } from './eventoDaConversa';
import { TEXTOS_DOS_EVENTOS } from './textosDosEventos';

const msg = (event?: Record<string, unknown>): Message =>
  ({ id: '1', content: 'frase', content_attributes: event ? { event } : {} }) as unknown as Message;
const cartao = (event: Record<string, unknown>) => {
  const r = lerEvento(msg(event));
  if (!r || !('cartao' in r)) throw new Error('esperava cartão');
  return r.cartao;
};
const pilula = (event: Record<string, unknown>) => {
  const r = lerEvento(msg(event));
  if (!r || !('pilula' in r)) throw new Error('esperava pílula');
  return r.pilula;
};

describe('lerEvento', () => {
  it('visit_scheduled', () => {
    const c = cartao({ type: 'visit_scheduled', by: 'Cirlei', scheduled_at: '2026-10-25T20:00:00Z', property: 'Apto 52', realtor: 'Cirlei' });
    expect(c.familia).toBe('visita');
    expect(c.titulo).toBe('Visita agendada');
    expect(c.principal).toBe('Domingo, 25 out às 17h');
    expect(c.detalhe).toBe('Apto 52 · com Cirlei');
    expect(c.detalheIcone).toBe('local');
    expect(c.rodape).toBe('Agendada por Cirlei');
  });
  it('visit_scheduled pela IA, com minutos', () => {
    const c = cartao({ type: 'visit_scheduled', by_ai: true, scheduled_at: '2026-10-25T20:30:00Z' });
    expect(c.principal).toBe('Domingo, 25 out às 17h30');
    expect(c.rodape).toBe('Agendada pela IA Vendedora');
    expect(c.rodapeIa).toBe(true);
  });
  it('visita sem imóvel: detalhe sem imóvel', () => {
    const c = cartao({ type: 'visit_scheduled', scheduled_at: '2026-10-25T20:00:00Z', realtor: 'Cirlei' });
    expect(c.detalhe).toBe('com Cirlei');
    expect(c.detalheIcone).toBeUndefined();
    expect(c.rodape).toBeUndefined();
  });
  it('visit_rescheduled', () => {
    const c = cartao({ type: 'visit_rescheduled', by: 'Ana', scheduled_at: '2026-10-26T20:00:00Z', previous_scheduled_at: '2026-10-25T20:00:00Z' });
    expect(c.titulo).toBe('Visita remarcada');
    expect(c.icone).toBe('remarcar');
    expect(c.principal).toBe('Segunda, 26 out às 17h');
    expect(c.detalhe).toBe('Era domingo, 25 out às 17h');
    expect(c.rodape).toBe('Remarcada por Ana');
  });
  it('visit_rescheduled pela IA', () => {
    const c = cartao({ type: 'visit_rescheduled', by_ai: true, scheduled_at: '2026-10-26T20:00:00Z' });
    expect(c.rodape).toBe('Remarcada pela IA Vendedora');
    expect(c.rodapeIa).toBe(true);
  });
  it('visit_completed com retorno', () => {
    const c = cartao({ type: 'visit_completed', by: 'Ana', property: 'Apto 52', rating: 4, feedback: 'Gostou' });
    expect(c.titulo).toBe('Visita realizada');
    expect(c.principal).toBeUndefined();
    expect(c.detalhe).toBe('Apto 52');
    expect(c.detalheIcone).toBe('local');
    expect(c.estrelas).toBe(4);
    expect(c.comentario).toBe('Gostou');
    expect(c.rodape).toBe('Retorno de Ana');
  });
  it('visit_completed sem retorno', () => {
    const c = cartao({ type: 'visit_completed', by: 'Ana', property: 'Apto 52' });
    expect(c.rodape).toBe('Registrada por Ana');
    expect(c.estrelas).toBeUndefined();
  });
  it('visit_no_show', () => {
    const c = cartao({ type: 'visit_no_show', by: 'Ana', scheduled_at: '2026-10-25T20:00:00Z', property: 'Apto 52' });
    expect(c.familia).toBe('visita-encerrada');
    expect(c.titulo).toBe('Lead não compareceu');
    expect(c.principal).toBe('Domingo, 25 out às 17h');
    expect(c.detalhe).toBe('Apto 52');
    expect(c.rodape).toBe('Registrado por Ana');
  });
  it('visit_cancelled', () => {
    const c = cartao({ type: 'visit_cancelled', by: 'Ana', scheduled_at: '2026-10-25T20:00:00Z', reason: 'Lead desistiu' });
    expect(c.familia).toBe('visita-encerrada');
    expect(c.titulo).toBe('Visita cancelada');
    expect(c.principal).toBe('Era domingo, 25 out às 17h');
    expect(c.detalhe).toBe('Lead desistiu');
    expect(c.rodape).toBe('Cancelada por Ana');
  });
  it('task_created com prazo', () => {
    const c = cartao({ type: 'task_created', by: 'Ana', title: 'Ligar', due_at: '2026-10-25T20:00:00Z', assignee: 'Bia' });
    expect(c.titulo).toBe('Tarefa agendada');
    expect(c.principal).toBe('Ligar');
    expect(c.detalhe).toBe('Domingo, 25 out às 17h · para Bia');
    expect(c.detalheIcone).toBe('relogio');
    expect(c.rodape).toBe('Criada por Ana');
  });
  it('dia da semana sem "-feira"', () => {
    const c = cartao({ type: 'task_created', title: 'Ligar', due_at: '2026-10-23T13:00:00Z' });
    expect(c.detalhe).toBe('Sexta, 23 out às 10h');
  });
  it('task_created sem prazo, pela automação', () => {
    const c = cartao({ type: 'task_created', by_automation: true, title: 'Ligar', assignee: 'Bia' });
    expect(c.titulo).toBe('Tarefa criada');
    expect(c.detalhe).toBe('para Bia');
    expect(c.detalheIcone).toBeUndefined();
    expect(c.rodape).toBe('Criada pela automação');
  });
  it('task_completed', () => {
    const c = cartao({ type: 'task_completed', by: 'Ana', title: 'Ligar', on_time: true });
    expect(c.titulo).toBe('Tarefa concluída');
    expect(c.principal).toBe('Ligar');
    expect(c.riscado).toBe(true);
    expect(c.rodape).toBe('Concluída por Ana, no prazo');
    expect(cartao({ type: 'task_completed', by: 'Ana', title: 'x', on_time: false }).rodape).toBe('Concluída por Ana, atrasada');
    expect(cartao({ type: 'task_completed', by: 'Ana', title: 'x' }).rodape).toBe('Concluída por Ana');
  });
  it('deal_won com imóvel', () => {
    const c = cartao({ type: 'deal_won', by: 'Ana', property: 'Apto 52', pipeline: 'Vendas' });
    expect(c.familia).toBe('ganho');
    expect(c.titulo).toBe('Negócio ganho');
    expect(c.principal).toBe('Apto 52');
    expect(c.detalhe).toBe('Vendas');
    expect(c.rodape).toBe('Marcado por Ana');
  });
  it('deal_won sem imóvel, pela proposta', () => {
    const c = cartao({ type: 'deal_won', by_proposal: true, pipeline: 'Vendas' });
    expect(c.principal).toBe('Vendas');
    expect(c.detalhe).toBeUndefined();
    expect(c.rodape).toBe('Pela proposta aceita');
  });
  it('deal_lost', () => {
    const c = cartao({ type: 'deal_lost', by: 'Cirlei', pipeline: 'Vendas', stage: 'Visita', reason: 'Sem renda pra financiar' });
    expect(c.familia).toBe('perdido');
    expect(c.titulo).toBe('Negócio perdido');
    expect(c.principal).toBe('Motivo: Sem renda pra financiar');
    expect(c.detalhe).toBe('Vendas · saiu da etapa Visita');
    expect(c.rodape).toBe('Marcado por Cirlei');
  });
  it('perdido sem motivo: principal com o funil', () => {
    const c = cartao({ type: 'deal_lost', by_automation: true, pipeline: 'Vendas', stage: 'Visita' });
    expect(c.principal).toBe('Vendas');
    expect(c.detalhe).toBe('saiu da etapa Visita');
    expect(c.rodape).toBe('Pela automação');
  });
  it('visit_confirmed vira pílula', () => {
    const p = pilula({ type: 'visit_confirmed', by: 'Cirlei', scheduled_at: '2026-10-25T20:00:00Z' });
    expect(p).toEqual({ icone: 'check', nome: 'Cirlei', texto: 'confirmou a visita de domingo, 25 out às 17h' });
  });
  it('visit_confirmed sem data: frase sem "de" pendurado', () => {
    expect(pilula({ type: 'visit_confirmed', by: 'Cirlei' })).toEqual({ icone: 'check', nome: 'Cirlei', texto: 'confirmou a visita' });
  });
  it('visit_feedback vira pílula com estrelas', () => {
    expect(pilula({ type: 'visit_feedback', by: 'Cirlei', rating: 4 })).toEqual({
      icone: 'estrela', nome: 'Cirlei', texto: 'deu o retorno da visita', estrelas: 4,
    });
  });
  it('deal_reopened vira pílula', () => {
    expect(pilula({ type: 'deal_reopened', by: 'Cirlei' })).toEqual({ icone: 'remarcar', nome: 'Cirlei', texto: 'reabriu o negócio' });
  });
  it('ai_paused_manual vira pílula do robô', () => {
    expect(pilula({ type: 'ai_paused_manual', by: 'Bruno' })).toEqual({
      icone: 'robo', nome: 'Bruno', texto: 'respondeu à mão e a IA saiu do atendimento',
    });
    expect(pilula({ type: 'ai_paused_manual' })).toEqual({
      icone: 'robo', nome: 'Alguém da equipe', texto: 'respondeu à mão e a IA saiu do atendimento',
    });
  });
  it('ai_resumed vira pílula do robô', () => {
    expect(pilula({ type: 'ai_resumed', by: 'Bruno' })).toEqual({ icone: 'robo', nome: 'Bruno', texto: 'religou a IA' });
    expect(pilula({ type: 'ai_resumed', by_automation: true })).toEqual({ icone: 'robo', nome: 'Uma automação', texto: 'religou a IA' });
    expect(pilula({ type: 'ai_resumed' })).toEqual({ icone: 'robo', nome: 'Alguém da equipe', texto: 'religou a IA' });
  });
  it('type desconhecido → null', () => {
    expect(lerEvento(msg({ type: 'algo_novo' }))).toBeNull();
  });
  it('sem content_attributes → null', () => {
    expect(lerEvento({ id: '1', content: 'x' } as unknown as Message)).toBeNull();
    expect(lerEvento(msg())).toBeNull();
  });
  it('nenhum texto tem travessão', () => {
    const textos: string[] = [];
    const varrer = (v: unknown) => {
      if (typeof v === 'string') textos.push(v);
      else if (typeof v === 'function') textos.push(String(v('X')));
      else if (v && typeof v === 'object') Object.values(v).forEach(varrer);
    };
    varrer(TEXTOS_DOS_EVENTOS);
    expect(textos.length).toBeGreaterThan(20);
    for (const t of textos) expect(t).not.toMatch(/[—–]/);
  });
});
