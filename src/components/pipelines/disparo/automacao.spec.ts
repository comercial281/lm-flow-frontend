import { describe, expect, it } from 'vitest';
import type { AutomationOption } from '@/services/broadcasts/broadcastsService';
import { avisoDoGatilho, inicioDaPrevia, linhaDaPrevia, linhasDoResumo, motivoSemDisparo, numeroProprio } from './automacao';

// Textos do passo 2 do disparo quando o escolhido é "Automação" (spec 23/10/2026).

const opcao = (parcial: Partial<AutomationOption> = {}): AutomationOption => ({
  id: 'a1',
  name: 'Boas-vindas',
  team: true,
  owner_name: null,
  number_mode: 'inherit',
  inbox_id: null,
  inbox_name: null,
  first_step: { kind: 'send_whatsapp', text: 'Oi {{nome}}', config: {} },
  more_blocks: 8,
  trigger_data: [],
  ...parcial,
});

describe('linhaDaPrevia', () => {
  it('primeiro bloco Mensagem: o texto entre aspas e quantos blocos vêm depois', () => {
    expect(linhaDaPrevia(opcao())).toBe('Primeira mensagem: "Oi {{nome}}" · e mais 8 blocos');
  });

  it('primeiro bloco Esperar: o nome do bloco com o tempo, pelo formatador do construtor', () => {
    const o = opcao({ first_step: { kind: 'wait', text: null, config: { mode: 'interval', minutes: 10 } } });
    expect(linhaDaPrevia(o)).toBe('Começa com: Esperar 10 minutos · e mais 8 blocos');
  });

  it('Esperar só com segundos e Esperar sem tempo gravado (1 dia, o padrão)', () => {
    expect(inicioDaPrevia(opcao({ first_step: { kind: 'wait', text: null, config: { seconds: 30 } } })))
      .toBe('Começa com: Esperar 30 segundos');
    expect(inicioDaPrevia(opcao({ first_step: { kind: 'wait', text: null, config: {} } })))
      .toBe('Começa com: Esperar 1 dia');
  });

  it('outros blocos pelo nome da paleta: Aguardar resposta, Condição e a ação de lead', () => {
    expect(inicioDaPrevia(opcao({ first_step: { kind: 'wait_for_reply', text: null, config: {} } })))
      .toBe('Começa com: Aguardar resposta');
    expect(inicioDaPrevia(opcao({ first_step: { kind: 'condition', text: null, config: {} } })))
      .toBe('Começa com: Condição');
    expect(inicioDaPrevia(opcao({ first_step: { kind: 'hand_to_ai', text: null, config: {} } })))
      .toBe('Começa com: Passar para a IA');
  });

  it('Mensagem sem texto (só mídia) cai no nome do bloco', () => {
    expect(inicioDaPrevia(opcao({ first_step: { kind: 'send_whatsapp', text: null, config: {} } })))
      .toBe('Começa com: Mensagem');
  });

  it('sem blocos depois, sem o " · e mais"', () => {
    expect(linhaDaPrevia(opcao({ more_blocks: 0 }))).toBe('Primeira mensagem: "Oi {{nome}}"');
  });

  it('um bloco depois, no singular', () => {
    expect(linhaDaPrevia(opcao({ more_blocks: 1 }))).toBe('Primeira mensagem: "Oi {{nome}}" · e mais 1 bloco');
  });
});

describe('linhasDoResumo', () => {
  const marcado = { incluirQuemPassou: true, recomecarRodando: false };

  it('um em cada grupo: as 3 linhas no singular, com as caixinhas e a ajuda do erro', () => {
    expect(linhasDoResumo({ passed: 1, passed_error: 1, running: 1, first_time: 1 }, marcado)).toEqual([
      { chave: 'primeira', texto: '1 recebe pela primeira vez.' },
      {
        chave: 'passou',
        texto: '1 já passou por essa automação e recebe de novo',
        ajuda: '1 com erro no envio da vez passada.',
        caixinha: { marcada: true },
      },
      {
        chave: 'rodando',
        texto: '1 está com essa automação rodando agora. Recomeçar pra ele',
        ajuda: 'Desmarcado, fica de fora. Marcado, a automação dele para e começa de novo.',
        caixinha: { marcada: false },
      },
    ]);
  });

  it('no plural, e as caixinhas seguem as escolhas', () => {
    const linhas = linhasDoResumo(
      { passed: 12, passed_error: 3, running: 2, first_time: 140 },
      { incluirQuemPassou: false, recomecarRodando: true },
    );
    expect(linhas).toEqual([
      { chave: 'primeira', texto: '140 recebem pela primeira vez.' },
      {
        chave: 'passou',
        texto: '12 já passaram por essa automação e recebem de novo',
        ajuda: '3 com erro no envio da vez passada.',
        caixinha: { marcada: false },
      },
      {
        chave: 'rodando',
        texto: '2 estão com essa automação rodando agora. Recomeçar pra eles',
        ajuda: 'Desmarcado, ficam de fora. Marcado, a automação deles para e começa de novo.',
        caixinha: { marcada: true },
      },
    ]);
  });

  it('linha com zero não aparece; sem erro, sem a ajuda do erro', () => {
    expect(linhasDoResumo({ passed: 4, passed_error: 0, running: 0, first_time: 0 }, marcado)).toEqual([
      { chave: 'passou', texto: '4 já passaram por essa automação e recebem de novo', caixinha: { marcada: true } },
    ]);
  });
});

describe('avisoDoGatilho', () => {
  it('sem dado do gatilho, sem aviso', () => {
    expect(avisoDoGatilho([])).toBeNull();
  });

  it('um, dois e três dados, juntos com vírgula e "e"', () => {
    expect(avisoDoGatilho(['formulario'])).toBe('Essa automação usa dados de formulário. No disparo eles vêm vazios.');
    expect(avisoDoGatilho(['visita', 'formulario'])).toBe('Essa automação usa dados de visita e formulário. No disparo eles vêm vazios.');
    expect(avisoDoGatilho(['visita', 'formulario', 'imovel'])).toBe(
      'Essa automação usa dados de visita, formulário e imóvel do anúncio. No disparo eles vêm vazios.',
    );
  });
});

describe('numeroProprio', () => {
  it('número fixo ou do dono: o nome do número; herda ou por bloco: nada', () => {
    expect(numeroProprio(opcao({ number_mode: 'fixed', inbox_id: 'in9', inbox_name: 'IA Júlia' }))).toBe('IA Júlia');
    expect(numeroProprio(opcao({ number_mode: 'personal', inbox_id: 'in2', inbox_name: 'Corretor Ana' }))).toBe('Corretor Ana');
    expect(numeroProprio(opcao({ number_mode: 'inherit' }))).toBeNull();
    expect(numeroProprio(opcao({ number_mode: 'per_block' }))).toBeNull();
    expect(numeroProprio(opcao({ number_mode: 'fixed', inbox_id: null, inbox_name: null }))).toBeNull();
  });
});

describe('motivoSemDisparo', () => {
  it('número por bloco e número próprio que não envia disparo travam; os outros não', () => {
    expect(motivoSemDisparo(opcao({ number_mode: 'per_block' }))).toBe(
      'Escolha o número nas Configurações da automação pra poder disparar.',
    );
    expect(motivoSemDisparo(opcao({ number_mode: 'fixed', inbox_id: null }))).toBe(
      'O número da automação não envia disparo. Troque nas Configurações da automação.',
    );
    expect(motivoSemDisparo(opcao({ number_mode: 'personal', inbox_id: null }))).toBe(
      'O número da automação não envia disparo. Troque nas Configurações da automação.',
    );
    expect(motivoSemDisparo(opcao({ number_mode: 'fixed', inbox_id: 'in9', inbox_name: 'IA Júlia' }))).toBeNull();
    expect(motivoSemDisparo(opcao({ number_mode: 'inherit' }))).toBeNull();
  });
});
