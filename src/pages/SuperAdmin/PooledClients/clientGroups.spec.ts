import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { groupJidsFrom, groupsPatch, groupLabel, isGroupJid, sortGroupsForPicker, nameRuleHint } from './clientGroups';

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
