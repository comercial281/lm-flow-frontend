import { describe, it, expect } from 'vitest';
import { notifyActionFor, notifyChoiceOf, viasFor, withNotifyChoice } from './notification';

describe('bloco Notificação: Avisar quem + Por onde', () => {
  it('ida e volta dos 5 tipos', () => {
    const casos: Array<[string, { quem: string; onde: string }]> = [
      ['notify_group', { quem: 'grupo', onde: 'whatsapp' }],
      ['notify_user', { quem: 'pessoa', onde: 'whatsapp' }],
      ['notify_push', { quem: 'pessoa', onde: 'app' }],
      ['notify_broker', { quem: 'corretor', onde: 'whatsapp' }],
      ['notify_gestor', { quem: 'gestor', onde: 'whatsapp' }],
    ];
    for (const [tipo, escolha] of casos) {
      expect(notifyChoiceOf(tipo)).toEqual(escolha);
      expect(notifyActionFor(escolha as never)).toBe(tipo);
    }
  });

  it('só a pessoa tem mais de uma via', () => {
    expect(viasFor('pessoa')).toEqual(['whatsapp', 'app']);
    expect(viasFor('grupo')).toEqual(['whatsapp']);
    expect(viasFor('corretor')).toEqual(['whatsapp']);
    expect(viasFor('gestor')).toEqual(['whatsapp']);
  });

  it('pessoa WhatsApp para app leva o user_id pra user_ids e mantém a mensagem', () => {
    const cfg = { action_type: 'notify_user', params: { user_id: 'u1', message: 'Oi' } };
    expect(withNotifyChoice(cfg, { quem: 'pessoa', onde: 'app' })).toEqual({
      action_type: 'notify_push', params: { user_ids: ['u1'], message: 'Oi', title: '' },
    });
  });

  it('app para WhatsApp leva o primeiro user_ids pro user_id', () => {
    const cfg = { action_type: 'notify_push', params: { user_ids: ['u1', 'u2'], message: 'Oi', title: 'T' } };
    expect(withNotifyChoice(cfg, { quem: 'pessoa', onde: 'whatsapp' })).toEqual({
      action_type: 'notify_user', params: { user_id: 'u1', message: 'Oi' },
    });
  });

  it('de pessoa para grupo zera user_id/user_ids e mantém a mensagem', () => {
    const cfg = { action_type: 'notify_user', params: { user_id: 'u1', message: 'Oi' } };
    expect(withNotifyChoice(cfg, { quem: 'grupo', onde: 'whatsapp' })).toEqual({
      action_type: 'notify_group', params: { group_jid: '', message: 'Oi' },
    });
    const push = { action_type: 'notify_push', params: { user_ids: ['u1'], message: 'Oi' } };
    expect(withNotifyChoice(push, { quem: 'gestor', onde: 'whatsapp' })).toEqual({
      action_type: 'notify_gestor', params: { message: 'Oi' },
    });
  });

  it('escolha com via que o destino não tem cai na via dele', () => {
    const cfg = { action_type: 'notify_group', params: { message: 'Oi' } };
    expect(withNotifyChoice(cfg, { quem: 'gestor', onde: 'app' }).action_type).toBe('notify_gestor');
  });

  it('voltar pro tipo gravado devolve os campos gravados, com a mensagem de agora', () => {
    const gravado = { action_type: 'notify_group', params: { group_jid: 'g1@g.us', instance: 'inst-1', message: 'Oi' } };
    const pessoa = withNotifyChoice(gravado, { quem: 'pessoa', onde: 'whatsapp' }, gravado);
    expect(pessoa).toEqual({ action_type: 'notify_user', params: { user_id: '', message: 'Oi' } });
    const editada = { ...pessoa, params: { ...pessoa.params, message: 'Oi de novo' } };
    expect(withNotifyChoice(editada, { quem: 'grupo', onde: 'whatsapp' }, gravado)).toEqual({
      action_type: 'notify_group', params: { group_jid: 'g1@g.us', instance: 'inst-1', message: 'Oi de novo' },
    });
  });

  it('push gravado: app -> WhatsApp -> app devolve título e destinatários gravados', () => {
    const gravado = { action_type: 'notify_push', params: { user_ids: ['u1', 'u2'], title: 'Lead quente', message: 'Oi' } };
    const zap = withNotifyChoice(gravado, { quem: 'pessoa', onde: 'whatsapp' }, gravado);
    const volta = withNotifyChoice(zap, { quem: 'pessoa', onde: 'app' }, gravado);
    expect(volta).toEqual(gravado);
    expect((volta.params as { user_ids: string[] }).user_ids).not.toBe(gravado.params.user_ids);
  });

  it('sem config gravada (ou indo pra outro tipo), segue zerando', () => {
    const gravado = { action_type: 'notify_group', params: { group_jid: 'g1', message: 'Oi' } };
    expect(withNotifyChoice(gravado, { quem: 'gestor', onde: 'whatsapp' }, gravado)).toEqual({
      action_type: 'notify_gestor', params: { message: 'Oi' },
    });
  });
});
