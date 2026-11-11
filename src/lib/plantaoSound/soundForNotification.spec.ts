import { describe, it, expect } from 'vitest';
import { soundForNotification } from './soundForNotification';

// Qual som o sininho (conexão ao vivo) toca para cada aviso (Som do Plantão,
// 11/11/2026): "Lead virou seu" toca o Chegou, obrigatório; a oferta da roleta
// fica com o pop-up (que repete); o resto segue a chave "Alertas de áudio".
describe('soundForNotification', () => {
  it('"Lead virou seu" toca o Chegou', () => {
    expect(soundForNotification({ notification_type: 'lead_assigned', meta: { event: 'lead.atribuido' } })).toBe('lead');
  });

  it('lead_assigned antigo, sem evento, também', () => {
    expect(soundForNotification({ notification_type: 'lead_assigned' })).toBe('lead');
  });

  it('"A IA te passou um lead" segue o som de sempre', () => {
    expect(soundForNotification({ notification_type: 'lead_assigned', meta: { event: 'lead.ia_repassou' } })).toBe('legacy');
  });

  it('oferta da roleta não toca por aqui (quem toca é o pop-up)', () => {
    expect(soundForNotification({ notification_type: 'system_alert', meta: { event: 'roleta.oferta_recebida' } })).toBe('skip');
  });

  it('mensagem nova segue o som de sempre', () => {
    expect(soundForNotification({ notification_type: 'assigned_conversation_new_message' })).toBe('legacy');
  });
});
