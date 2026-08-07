import { describe, it, expect } from 'vitest';
import { roletaFormProblems, splitBackendProblems, backendProblems, type RoletaFormCheckInput } from './roletaFormChecks';

// "Preenchi tudo direitinho e deu erro" — 07/08/2026.
//
// A tela conferia com uma escada de `if` + toast: parava no primeiro problema,
// o aviso sumia sozinho, e a recusa do servidor era substituída pela mensagem
// do axios ("Request failed with status code 422"). Estes exemplos travam o
// comportamento novo: TODOS os problemas de uma vez, em linguagem de tela.

const INBOX_A = 'inbox-a';
const INBOX_B = 'inbox-b';

function form(over: Partial<RoletaFormCheckInput> = {}): RoletaFormCheckInput {
  return {
    inboxId: INBOX_A,
    multiEnabled: false,
    configs: [],
    editingId: null,
    instances: [{ inbox_id: INBOX_A, is_active: true }],
    members: [{ user_id: 'u1', personal_whatsapp_number: '5511999998888' }],
    mode: 'rodizio',
    gestorNum: '5511977776666',
    horarioOn: false,
    janelas: [],
    instanceLabel: id => (id === INBOX_A ? 'Vendas 01' : 'Vendas 02'),
    userName: id => (id === 'u1' ? 'João' : 'Maria'),
    ...over,
  };
}

describe('roletaFormProblems', () => {
  it('não reclama de um formulário completo', () => {
    expect(roletaFormProblems(form())).toEqual([]);
  });

  // ⚠️ Compartilhar o número entre roletas é PERMITIDO desde 07/08/2026 (duas
  // campanhas, fontes diferentes, mesmo WhatsApp). Este exemplo trava a
  // permissão: se voltar a acusar erro aqui, a funcionalidade regrediu.
  it('NÃO reclama de um número que também está em outra roleta', () => {
    const p = roletaFormProblems(form({
      configs: [{
        id: 'r1', inbox_id: INBOX_A, display_name: 'Roleta do Centro',
        instances: [{ inbox_id: INBOX_A }],
      }],
    }));
    expect(p).toEqual([]);
  });

  // O que continua exclusivo: quem atende quem escreve direto para o número.
  it('acusa quando outra roleta já atende quem escreve direto naquele número', () => {
    const p = roletaFormProblems(form({
      instances: [{ inbox_id: INBOX_A, is_active: true, answers_direct_inbound: true }],
      configs: [{
        id: 'r1', inbox_id: INBOX_A, display_name: 'Roleta do Centro',
        instances: [{ inbox_id: INBOX_A, answers_direct_inbound: true }],
      }],
    }));
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('Roleta do Centro');
    expect(p[0]).toContain('escreve');
  });

  it('deixa marcar quando nenhuma outra roleta reivindica o número', () => {
    const p = roletaFormProblems(form({
      instances: [{ inbox_id: INBOX_A, is_active: true, answers_direct_inbound: true }],
      configs: [{
        id: 'r1', inbox_id: INBOX_A, display_name: 'Roleta do Centro',
        instances: [{ inbox_id: INBOX_A, answers_direct_inbound: false }],
      }],
    }));
    expect(p).toEqual([]);
  });

  it('não acusa conflito da roleta consigo mesma ao editar', () => {
    const p = roletaFormProblems(form({
      editingId: 'r1',
      instances: [{ inbox_id: INBOX_A, is_active: true, answers_direct_inbound: true }],
      configs: [{
        id: 'r1', inbox_id: INBOX_A, display_name: 'Roleta do Centro',
        instances: [{ inbox_id: INBOX_A, answers_direct_inbound: true }],
      }],
    }));
    expect(p).toEqual([]);
  });

  // O ponto da mudança: a lista inteira de uma vez, não só o primeiro problema.
  it('junta TODOS os problemas numa lista só', () => {
    const p = roletaFormProblems(form({
      inboxId: '',
      gestorNum: '',
      members: [{ user_id: '', personal_whatsapp_number: '' }],
    }));
    expect(p.length).toBeGreaterThanOrEqual(3);
    expect(p.some(x => x.includes('instância'))).toBe(true);
    expect(p.some(x => x.includes('número do gestor'))).toBe(true);
    expect(p.some(x => x.includes('ao menos um corretor'))).toBe(true);
  });

  // Antes esta linha era descartada em silêncio: salvava com sucesso e o
  // corretor simplesmente não aparecia na roleta.
  it('acusa o corretor escolhido sem WhatsApp, pelo nome', () => {
    const p = roletaFormProblems(form({
      members: [{ user_id: 'u1', personal_whatsapp_number: '  ' }],
    }));
    expect(p.some(x => x.includes('Falta o WhatsApp de João'))).toBe(true);
  });

  it('acusa a linha com WhatsApp e sem corretor', () => {
    const p = roletaFormProblems(form({
      members: [
        { user_id: 'u1', personal_whatsapp_number: '5511999998888' },
        { user_id: '', personal_whatsapp_number: '5511911112222' },
      ],
    }));
    expect(p.some(x => x.includes('linha 2'))).toBe(true);
  });

  it('acusa o mesmo corretor duas vezes', () => {
    const p = roletaFormProblems(form({
      members: [
        { user_id: 'u1', personal_whatsapp_number: '5511999998888' },
        { user_id: 'u1', personal_whatsapp_number: '5511911112222' },
      ],
    }));
    expect(p.some(x => x.includes('João está na lista duas vezes'))).toBe(true);
  });

  it('no modo Manual não exige corretor cadastrado', () => {
    expect(roletaFormProblems(form({ mode: 'manual', members: [] }))).toEqual([]);
  });

  it('acusa o mesmo número em duas linhas de "Números que atendem"', () => {
    const p = roletaFormProblems(form({
      multiEnabled: true,
      instances: [{ inbox_id: INBOX_A, is_active: true }, { inbox_id: INBOX_A, is_active: true }],
    }));
    expect(p.some(x => x.includes('Vendas 01') && x.includes('duas linhas'))).toBe(true);
  });

  it('barra o segundo número quando o cliente não tem a liberação', () => {
    const p = roletaFormProblems(form({
      multiEnabled: false,
      instances: [{ inbox_id: INBOX_A, is_active: true }, { inbox_id: INBOX_B, is_active: true }],
    }));
    expect(p.some(x => x.includes('não está liberada'))).toBe(true);
  });

  // Número desativado não conta para a trava — mesmo critério do backend.
  it('deixa guardar um segundo número desativado sem a liberação', () => {
    const p = roletaFormProblems(form({
      multiEnabled: false,
      instances: [{ inbox_id: INBOX_A, is_active: true }, { inbox_id: INBOX_B, is_active: false }],
    }));
    expect(p).toEqual([]);
  });

  describe('horário de funcionamento', () => {
    it('recusa uma faixa que começa e termina no mesmo horário', () => {
      const p = roletaFormProblems(form({ horarioOn: true, janelas: [{ start: '08:00', end: '08:00' }] }));
      expect(p.some(x => x.includes('nunca abriria'))).toBe(true);
    });

    it('recusa horário fora do formato', () => {
      const p = roletaFormProblems(form({ horarioOn: true, janelas: [{ start: '25:99', end: '18:00' }] }));
      expect(p.some(x => x.includes('Horário inválido'))).toBe(true);
    });

    it('aceita uma faixa normal', () => {
      const p = roletaFormProblems(form({ horarioOn: true, janelas: [{ start: '08:00', end: '18:00' }] }));
      expect(p).toEqual([]);
    });

    // Desligado = 24h: nem olha as faixas.
    it('ignora as faixas com o horário desligado', () => {
      const p = roletaFormProblems(form({ horarioOn: false, janelas: [{ start: '99:99', end: '99:99' }] }));
      expect(p).toEqual([]);
    });
  });
});

describe('splitBackendProblems', () => {
  it('quebra a recusa do servidor em uma linha por campo', () => {
    expect(splitBackendProblems('Instância (WhatsApp): já existe | Prazo de aceite: maior que zero'))
      .toEqual(['Instância (WhatsApp): já existe', 'Prazo de aceite: maior que zero']);
  });

  it('devolve a mensagem inteira quando não há separador', () => {
    expect(splitBackendProblems('Sem acesso à instância: Maria (Vendas 02).'))
      .toEqual(['Sem acesso à instância: Maria (Vendas 02).']);
  });
});

describe('backendProblems', () => {
  // O caso que deixava o painel dizendo "Validation failed" e nada mais: o
  // estouro sobe pelo tratador global, cuja mensagem é uma string fixa em
  // inglês, e o motivo real fica só no `details`.
  it('usa o details quando a mensagem é o "Validation failed" genérico', () => {
    const p = backendProblems('Validation failed', [
      { field: 'inbox_id', label: 'Instância (WhatsApp)', full_messages: ['Inbox has already been taken'] },
    ]);
    expect(p).toEqual(['Instância (WhatsApp): Inbox has already been taken']);
  });

  it('não fica mudo quando nem a mensagem nem o details ajudam', () => {
    const p = backendProblems('Validation failed', []);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('sem detalhar o motivo');
  });

  it('prefere a mensagem quando ela é específica', () => {
    const p = backendProblems('Prazo de aceite: maior que zero', [{ field: 'timeout_minutes' }]);
    expect(p).toEqual(['Prazo de aceite: maior que zero']);
  });
});
