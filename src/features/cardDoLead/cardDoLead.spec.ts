import { describe, expect, it } from 'vitest';
import {
  contatoDoCard,
  itemSemFunil,
  semFunil,
  atendimentosDoContato,
  conversaDoCard,
  leadParaVisita,
  origemCurta,
  classeDaOrigem,
  podeCorrigirContato,
  respostasDoLead,
  visitaSemFeedback,
  visitasEmOrdem,
} from './cardDoLead';
import type { PipelineItem } from '@/types/analytics';

const item = (extra: Record<string, unknown>): PipelineItem =>
  ({ id: 'i1', pipeline_id: 'p1', stage_id: 's1', ...extra }) as unknown as PipelineItem;

describe('contatoDoCard', () => {
  it('lê o contato direto do card', () => {
    expect(contatoDoCard(item({ contact: { id: 'c1', name: 'Ana' } }))?.id).toBe('c1');
  });

  it('cai no contato da conversa', () => {
    expect(contatoDoCard(item({ conversation: { id: 9, contact: { id: 'c2' } } }))?.id).toBe('c2');
  });

  it('sem nada devolve null', () => {
    expect(contatoDoCard(null)).toBeNull();
  });
});

describe('conversaDoCard', () => {
  it('prefere a conversa do card', () => {
    expect(conversaDoCard(item({ conversation: { id: 9 }, whatsapp_conversation_id: 7 }))).toBe('9');
  });

  it('lead de formulário usa a conversa de WhatsApp que o servidor achou', () => {
    expect(conversaDoCard(item({ whatsapp_conversation_id: 7 }))).toBe('7');
  });

  it('sem conversa devolve null', () => {
    expect(conversaDoCard(item({}))).toBeNull();
  });
});

describe('podeCorrigirContato', () => {
  it('só com identity_correctable === true', () => {
    expect(podeCorrigirContato({ identity_correctable: true })).toBe(true);
    expect(podeCorrigirContato({ identity_correctable: false })).toBe(false);
  });

  it('servidor antigo (sem o campo) deixa travado', () => {
    expect(podeCorrigirContato({})).toBe(false);
    expect(podeCorrigirContato(null)).toBe(false);
  });
});

describe('respostasDoLead', () => {
  it('lista as respostas do formulário e os campos soltos sem repetir', () => {
    const rows = respostasDoLead({
      custom_attributes: {
        form_answers: { 'Qual o seu orçamento?': 'Até 500 mil' },
        qual_o_seu_orcamento: 'Até 500 mil',
        bairro: 'Lapa',
      },
    });

    expect(rows.map(r => r.value)).toEqual(['Até 500 mil', 'Lapa']);
  });

  it('sem respostas devolve lista vazia', () => {
    expect(respostasDoLead({ custom_attributes: {} })).toEqual([]);
    expect(respostasDoLead(null)).toEqual([]);
  });
});

describe('origemCurta', () => {
  it('rótulo da origem com o detalhe mais útil', () => {
    expect(origemCurta({ source: 'meta_lead_ads', campaign_name: 'Vista Mar' })).toBe('📋 Formulário Meta Ads · Vista Mar');
  });

  it('origem escrita à mão aparece como detalhe', () => {
    expect(origemCurta({ source: 'manual', manual_origin: 'Indicação' })).toBe('Adicionado manualmente · Indicação');
  });

  it('portal mostra o nome do portal', () => {
    expect(origemCurta({ source: 'portal', portal: 'ZAP' })).toBe('Portal · ZAP');
  });

  it('origem desconhecida sem detalhe não aparece', () => {
    expect(origemCurta({ source: 'unknown' })).toBeNull();
    expect(origemCurta(null)).toBeNull();
  });
});

describe('classeDaOrigem', () => {
  it('usa a cor da origem conhecida', () => {
    expect(classeDaOrigem({ source: 'landing' })).toContain('violet');
  });

  it('origem desconhecida fica neutra', () => {
    expect(classeDaOrigem({ source: 'xyz' })).toBe('bg-muted text-muted-foreground');
    expect(classeDaOrigem(null)).toBe('bg-muted text-muted-foreground');
  });
});

describe('leadParaVisita', () => {
  it('monta o cliente da visita com o dono do lead como corretor', () => {
    const lead = leadParaVisita(
      item({ contact: { id: 'c1', phone_number: '+5511900000001' }, assignee: { id: 'u1', name: 'Bruno' } }),
      'Ana Teste',
    );

    expect(lead).toMatchObject({ id: 'c1', name: 'Ana Teste', in_pipeline: true, owner: { id: 'u1', name: 'Bruno' } });
  });

  it('sem contato não monta nada', () => {
    expect(leadParaVisita(item({}), 'X')).toBeNull();
  });
});

describe('visitaSemFeedback', () => {
  const agora = new Date('2026-10-02T12:00:00Z');
  const visita = (extra: Record<string, unknown>) =>
    ({ status: 'completed', scheduled_at: '2026-10-01T15:00:00Z', rating: null, feedback_notes: null, ...extra }) as never;

  it('visita passada sem nota nem comentário', () => {
    expect(visitaSemFeedback(visita({}), agora)).toBe(true);
  });

  it('com nota ou comentário já tem feedback', () => {
    expect(visitaSemFeedback(visita({ rating: 4 }), agora)).toBe(false);
    expect(visitaSemFeedback(visita({ feedback_notes: 'Gostou da varanda' }), agora)).toBe(false);
  });

  it('visita futura ainda não pede feedback', () => {
    expect(visitaSemFeedback(visita({ status: 'scheduled', scheduled_at: '2026-10-05T15:00:00Z' }), agora)).toBe(false);
  });

  it('cancelada ou remarcada não pede feedback', () => {
    expect(visitaSemFeedback(visita({ status: 'cancelled' }), agora)).toBe(false);
    expect(visitaSemFeedback(visita({ status: 'rescheduled' }), agora)).toBe(false);
  });

  it('agendada que já passou e ninguém mexeu também pede', () => {
    expect(visitaSemFeedback(visita({ status: 'scheduled' }), agora)).toBe(true);
  });
});

describe('visitasEmOrdem', () => {
  it('mais recente primeiro', () => {
    const lista = visitasEmOrdem([{ scheduled_at: '2026-09-01T10:00:00Z' }, { scheduled_at: '2026-10-01T10:00:00Z' }]);
    expect(lista[0].scheduled_at).toBe('2026-10-01T10:00:00Z');
  });
});

describe('card aberto pela pessoa (Contatos)', () => {
  it('sem funil: mesmo formato do card, sem id, com dono, origem e conversa do contato', () => {
    const item = itemSemFunil(
      {
        id: 'c1',
        name: 'Ana',
        default_assignee: { id: 'u1', name: 'Bruna' },
        additional_attributes: { lead_origin: { source: 'manual', manual_origin: 'Indicação' } },
      },
      '77',
    );
    expect(semFunil(item)).toBe(true);
    expect(item.assignee?.name).toBe('Bruna');
    expect(item.lead_origin?.manual_origin).toBe('Indicação');
    expect(conversaDoCard(item)).toBe('77');
    expect(contatoDoCard(item)?.id).toBe('c1');
  });

  it('atendimentos: um por card no funil, o mais recente primeiro, com as etapas em ordem', () => {
    const lista = atendimentosDoContato([
      {
        id: 'p1', name: 'Venda',
        stages: [
          { id: 's2', name: 'Visita', color: '#0f0', position: 2, items: [] },
          { id: 's1', name: 'Novo', color: '#f00', position: 1, items: [{ id: 'i1', updated_at: 100 } as never] },
        ],
      },
      { id: 'p2', name: 'Locação', stages: [{ id: 's9', name: 'Novo', color: '#00f', position: 1, items: [{ id: 'i2', updated_at: 200 } as never] }] },
    ]);
    expect(lista.map(a => a.pipeline.name)).toEqual(['Locação', 'Venda']);
    expect(lista[1].item.stage_id).toBe('s1');
    expect(lista[1].stages.map(s => s.name)).toEqual(['Novo', 'Visita']);
    expect(semFunil(lista[0].item)).toBe(false);
  });
});
