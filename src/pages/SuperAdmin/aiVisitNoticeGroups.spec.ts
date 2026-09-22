import { describe, it, expect } from 'vitest';
import { groupLine, HINT_SEM_MARCA } from './aiVisitNoticeGroups';

// A linha de cada grupo no *Aviso de visita da IA*. O que estes casos protegem
// não é formatação: é a Leal Mídia conseguir ver, ANTES de ligar um disparo
// irreversível, se o aviso cairia no grupo da imobiliária ou no interno dela.
describe('os grupos do aviso de visita da IA', () => {
  it('separa o grupo do cliente do grupo de logs internos', () => {
    expect(groupLine({ jid: '9@g.us', name: 'APTO PREMIUM x Leal Mídia', kind: 'cliente' }))
      .toMatchObject({ badge: 'Grupo do cliente', tone: 'client' });

    const logs = groupLine({ jid: '8@g.us', name: 'LM FLOW LOGS', kind: 'logs' });
    expect(logs.badge).toBe('Logs internos');
    expect(logs.tone).toBe('internal');
    expect(logs.note).toMatch(/só sai aqui se você marcar/i);
  });

  // ⚠️ Deduzir o tipo pelo NOME chamaria de interno o grupo de uma imobiliária
  // com "log" no nome — e, pior, deixaria o grupo interno passar por grupo do
  // cliente. Quem classifica é o servidor.
  it('não deduz o tipo pelo nome do grupo', () => {
    expect(groupLine({ jid: '7@g.us', name: 'LOGÍSTICA LOG x Leal Mídia' }).tone).toBe('neutral');
    expect(groupLine({ jid: '7@g.us', name: 'LOGÍSTICA LOG x Leal Mídia' }).badge)
      .toBe('Reconhecido pelo nome');
  });

  it('avisa quando o grupo cadastrado não apareceu no número operacional', () => {
    const linha = groupLine({ jid: '9@g.us', name: '9@g.us', kind: 'cliente', found: false });

    expect(linha.tone).toBe('client');
    expect(linha.note).toMatch(/não o listou/i);
  });

  it('não põe recado nenhum no caso normal', () => {
    expect(groupLine({ jid: '9@g.us', name: 'APTO PREMIUM x Leal Mídia', kind: 'cliente', found: true }).note)
      .toBe('');
  });

  it('marca o grupo que só continua ali porque foi escolhido à mão', () => {
    expect(groupLine({ jid: '5@g.us', name: '5@g.us', source: 'escolhido', found: false }).badge)
      .toBe('Escolhido à mão');
  });

  // "Marquei nada e não sai nada" num cliente que só tem grupo interno vira
  // chamado de suporte se a tela não disser que o automático não o escolhe.
  it('diz que o automático nunca escolhe o grupo de logs', () => {
    expect(HINT_SEM_MARCA).toMatch(/logs internos nunca é escolhido sozinho/i);
  });
});
