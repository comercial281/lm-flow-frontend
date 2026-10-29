import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { groupJidsFrom, groupsPatch, groupLabel, isGroupJid, sortGroupsForPicker, searchGroups, nameRuleHint } from './clientGroups';
import {
  allowedGroupsFrom, allowedGroupsPatch, addAllowedGroup, removeAllowedGroup,
  suggestAllowedGroups, allowedRow, ALLOWED_KIND_LABEL,
} from './clientGroups';

// O bloco *Grupos WhatsApp* da janela Funções é o único lugar onde o grupo de um
// cliente que JÁ EXISTE pode ser definido ou trocado. O que estes casos protegem:
// os dois JIDs viajam sempre juntos (PATCH parcial já apagou grupo antes), só
// JID de grupo passa, e o grupo gravado que sumiu da lista continua à vista.
describe('grupos de WhatsApp do cliente (painel raiz)', () => {
  const grupos = [
    { jid: '111@g.us', name: 'Leal Mídia x Fornecedor' },
    { jid: '222@g.us', name: 'APTO PREMIUM x Leal Mídia' },
    { jid: '333@g.us', name: 'Time interno' },
    { jid: '444@g.us', name: 'Moeda Forte x Leal Mídia ✅' },
  ];

  it('lê os dois JIDs da ficha e descarta o que não é grupo', () => {
    expect(groupJidsFrom({ whatsapp_reminder_group_jid: '222@g.us', whatsapp_logs_group_jid: '5511999@s.whatsapp.net' }))
      .toEqual({ reminder: '222@g.us', logs: '' });
    expect(groupJidsFrom(undefined)).toEqual({ reminder: '', logs: '' });
  });

  it('só aceita JID de grupo', () => {
    expect(isGroupJid('222@g.us')).toBe(true);
    expect(isGroupJid('5511999@s.whatsapp.net')).toBe(false);
    expect(isGroupJid('')).toBe(false);
    expect(isGroupJid(null)).toBe(false);
  });

  it('o PATCH leva SEMPRE os dois grupos, mesmo quando só um mudou', () => {
    const atual = { reminder: '222@g.us', logs: '333@g.us' };
    expect(groupsPatch(atual, { reminder: '444@g.us' })).toEqual({
      whatsapp_reminder_group_jid: '444@g.us',
      whatsapp_logs_group_jid: '333@g.us',
    });
  });

  it('limpar um grupo manda vazio e preserva o outro', () => {
    const atual = { reminder: '222@g.us', logs: '333@g.us' };
    expect(groupsPatch(atual, { reminder: '' })).toEqual({
      whatsapp_reminder_group_jid: '',
      whatsapp_logs_group_jid: '333@g.us',
    });
  });

  it('valor que não é grupo nunca chega ao servidor como grupo', () => {
    expect(groupsPatch({ reminder: '', logs: '' }, { reminder: '5511999@s.whatsapp.net' }))
      .toEqual({ whatsapp_reminder_group_jid: '', whatsapp_logs_group_jid: '' });
  });

  it('sem cadastro, a linha diz que o grupo do cliente é reconhecido pelo nome', () => {
    expect(groupLabel('', grupos, 'reminder')).toEqual({ text: 'Sem cadastro — reconhecido pelo nome do grupo', source: 'nome' });
    expect(groupLabel('', grupos, 'logs')).toEqual({ text: 'Sem cadastro', source: 'nome' });
  });

  it('grupo gravado e encontrado mostra o NOME', () => {
    expect(groupLabel('222@g.us', grupos, 'reminder')).toEqual({ text: 'APTO PREMIUM x Leal Mídia', source: 'cadastro' });
  });

  it('grupo gravado que sumiu da lista continua à vista, com aviso', () => {
    const r = groupLabel('999@g.us', grupos, 'reminder');
    expect(r.source).toBe('fora');
    expect(r.text).toBe('999@g.us');
    expect(r.warning).toMatch(/não aparece entre os grupos/);
  });

  it('com a lista ainda não carregada, mostra o JID sem acusar nada', () => {
    expect(groupLabel('999@g.us', null, 'reminder')).toEqual({ text: '999@g.us', source: 'cadastro' });
  });

  it('o seletor põe o grupo que começa com o nome do cliente primeiro, depois os de cliente, depois o resto', () => {
    expect(sortGroupsForPicker(grupos, 'Apto Premium').map(g => g.jid)).toEqual(['222@g.us', '444@g.us', '111@g.us', '333@g.us']);
  });

  // Desde 29/10/2026: os grupos passaram a ser renomeados com o número no FIM
  // ("PANDORA | LEAL MÍDIA [#185]") e caíam no fim da lista, depois das reuniões
  // de prospecção. Nomes tirados da lista real do número operacional.
  it('grupo com [#NNN] em qualquer lugar vem antes do resto, do número mais novo pro mais velho', () => {
    const reais = [
      { jid: 'a@g.us', name: 'ALEX I. [13/10 às 11h] | LEAL MÍDIA' },
      { jid: 'b@g.us', name: '[#154] DAIANE ROSA - LEAL MÍDIA' },
      { jid: 'c@g.us', name: 'teste-ignorar' },
      { jid: 'd@g.us', name: 'BASEL SOLUCTIONS - LEAL MÍDIA [#178]' },
      { jid: 'e@g.us', name: 'LOGS - LM FLOW' },
      { jid: 'f@g.us', name: '🟦 [#102] CRISTIAN SILVA - LEAL MÍDIA' },
      { jid: 'g@g.us', name: 'PANDORA | LEAL MÍDIA [#185]' },
    ];
    expect(sortGroupsForPicker(reais, 'Mais que Imóveis').map(g => g.name)).toEqual([
      'PANDORA | LEAL MÍDIA [#185]',
      'BASEL SOLUCTIONS - LEAL MÍDIA [#178]',
      '[#154] DAIANE ROSA - LEAL MÍDIA',
      '🟦 [#102] CRISTIAN SILVA - LEAL MÍDIA',
      'LOGS - LM FLOW',
      'ALEX I. [13/10 às 11h] | LEAL MÍDIA',
      'teste-ignorar',
    ]);
  });

  it('o grupo com o nome do cliente sobe mesmo com número ou etiqueta na frente', () => {
    const reais = [
      { jid: 'a@g.us', name: 'PANDORA | LEAL MÍDIA [#185]' },
      { jid: 'b@g.us', name: '[LOGS] FRANK CASTELLATO - LEAL MÍDIA [#183]' },
      { jid: 'c@g.us', name: '[#154] DAIANE ROSA - LEAL MÍDIA' },
      { jid: 'd@g.us', name: 'FRANK CASTELLATO - LEAL MÍDIA [#183]' },
    ];
    expect(sortGroupsForPicker(reais, 'Frank Castellato').map(g => g.jid)).toEqual(['b@g.us', 'd@g.us', 'a@g.us', 'c@g.us']);
    expect(sortGroupsForPicker(reais, 'Daiane Rosa')[0].jid).toBe('c@g.us');
  });

  it('a busca acha pelo nome sem acento nem caixa e pelo número', () => {
    const reais = [
      { jid: 'a@g.us', name: 'PANDORA | LEAL MÍDIA [#185]' },
      { jid: 'b@g.us', name: 'IMOBILIÁRIA MOEDA FORTE - LEAL MÍDIA [#149]' },
    ];
    expect(searchGroups(reais, 'pandora').map(g => g.jid)).toEqual(['a@g.us']);
    expect(searchGroups(reais, 'imobiliaria').map(g => g.jid)).toEqual(['b@g.us']);
    expect(searchGroups(reais, '185').map(g => g.jid)).toEqual(['a@g.us']);
    expect(searchGroups(reais, ' LEAL  mídia ').map(g => g.jid)).toEqual(['a@g.us', 'b@g.us']);
    expect(searchGroups(reais, '')).toEqual(reais);
  });

  it('a dica da regra de nome cita o nome do cliente', () => {
    expect(nameRuleHint('Moeda Forte')).toContain('"Moeda Forte x Leal Mídia"');
  });

  // O intervalo de acentos vai ESCRITO como escape, nunca com os caracteres
  // combinantes literais: qualquer normalização de editor os apaga em silêncio e
  // a comparação passa a nunca casar. Terceira vez desta cicatriz no repo.
  it('o intervalo de acentos é escrito como escape unicode no fonte', () => {
    const fonte = readFileSync(resolve(__dirname, 'clientGroups.ts'), 'utf8');
    expect(fonte).toContain('\\u0300-\\u036f');
  });
});

describe('lista de grupos liberados (painel raiz)', () => {
  const central = [
    { jid: '111@g.us', name: 'Leal Mídia x Fornecedor' },
    { jid: '222@g.us', name: 'APTO PREMIUM x Leal Mídia' },
    { jid: '333@g.us', name: 'Time interno' },
  ];

  it('sem a chave é "não mapeado" (null); com [] é lista vazia', () => {
    expect(allowedGroupsFrom({})).toBeNull();
    expect(allowedGroupsFrom({ allowed_whatsapp_groups: [] })).toEqual([]);
  });

  it('lê a lista e descarta o que não é grupo nem tipo conhecido', () => {
    expect(allowedGroupsFrom({ allowed_whatsapp_groups: [
      { jid: '222@g.us', name: 'APTO', kind: 'cliente' },
      { jid: '5511@s.whatsapp.net', name: 'x', kind: 'cliente' },
      { jid: '333@g.us', name: 'y', kind: 'outro' },
    ] })).toEqual([{ jid: '222@g.us', name: 'APTO', kind: 'cliente' }]);
  });

  it('adicionar não repete; remover tira pelo jid', () => {
    const um = addAllowedGroup([], central[1], 'cliente');
    expect(addAllowedGroup(um, central[1], 'logs')).toEqual(um);
    expect(removeAllowedGroup(um, '222@g.us')).toEqual([]);
  });

  it('o PATCH leva a lista inteira, saneada', () => {
    expect(allowedGroupsPatch([{ jid: ' 222@g.us ', name: 'APTO', kind: 'cliente' }]))
      .toEqual({ allowed_whatsapp_groups: [{ jid: '222@g.us', name: 'APTO', kind: 'cliente' }] });
  });

  it('sugere o grupo pelo nome do cliente e os dois cadastros antigos', () => {
    expect(suggestAllowedGroups(central, 'APTO PREMIUM', { reminder: '', logs: '333@g.us' })).toEqual([
      { jid: '222@g.us', name: 'APTO PREMIUM x Leal Mídia', kind: 'cliente' },
      { jid: '333@g.us', name: 'Time interno', kind: 'logs' },
    ]);
  });

  it('sugere o grupo do cliente com o número na frente ou no fim do nome', () => {
    const reais = [
      { jid: 'a@g.us', name: 'BASEL SOLUTIONS - LEAL MÍDIA [#178]' },
      { jid: 'b@g.us', name: '🟦 [#102] BASEL SOLUTIONS | LEAL MÍDIA' },
      { jid: 'c@g.us', name: 'BASEL SOLUTIONS [12/10 às 14h] | REUNIÃO' },
    ];
    expect(suggestAllowedGroups(reais, 'Basel Solutions', { reminder: '', logs: '' }).map(g => g.jid)).toEqual(['a@g.us', 'b@g.us']);
  });

  it('linha avisa quando a central não lista mais o grupo', () => {
    expect(allowedRow({ jid: '222@g.us', name: 'velho', kind: 'cliente' }, central).text).toBe('APTO PREMIUM x Leal Mídia');
    expect(allowedRow({ jid: '999@g.us', name: 'Sumido', kind: 'logs' }, central).warning).toMatch(/não aparece/);
    expect(allowedRow({ jid: '999@g.us', name: 'Sumido', kind: 'logs' }, null)).toEqual({ text: 'Sumido' });
  });

  it('rótulos dos tipos', () => {
    expect(ALLOWED_KIND_LABEL).toEqual({ cliente: 'Com o cliente', logs: 'Interno da Leal' });
  });
});
