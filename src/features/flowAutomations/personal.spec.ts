import { describe, expect, it } from 'vitest';
import { FLOW_TRIGGER_GROUPS } from './trigger';
import type { PaletteItem } from './palette';
import {
  isPersonalFlow, modoPessoal, personalAvailabilityState, personalBlockState, personalTriggerGroups, presaNaEquipe,
  saiPeloWhatsAppDe, tirarDaEquipe,
} from './personal';

const item = (key: string): PaletteItem => ({ key } as PaletteItem);
const sem = { temNumero: false, temIA: false };
const com = { temNumero: true, temIA: true };

describe('personal', () => {
  it('gatilhos do corretor não têm flow_called', () => {
    const evs = personalTriggerGroups(FLOW_TRIGGER_GROUPS).flatMap(g => g.events as string[]);
    expect(evs).not.toContain('flow_called');
    expect(personalTriggerGroups(FLOW_TRIGGER_GROUPS).every(g => g.events.length > 0)).toBe(true);
  });
  it('Imóvel mantém interesse e book', () => {
    const evs = personalTriggerGroups(FLOW_TRIGGER_GROUPS).flatMap(g => g.events as string[]);
    expect(evs).toContain('lead.interest_created');
    expect(evs).toContain('lead.book_requested');
  });
  it('notify_group é fora', () => {
    expect(personalBlockState(item('lead_action:notify_group'), com)).toBe('fora');
  });
  it('mensagem depende de número', () => {
    expect(personalBlockState(item('send_whatsapp'), sem)).toBe('indisponivel');
    expect(personalBlockState(item('send_whatsapp'), com)).toBe('ok');
    expect(personalBlockState(item('lead_action:send_message_funnel'), sem)).toBe('indisponivel');
    expect(personalBlockState(item('lead_action:start_followup_flow'), sem)).toBe('indisponivel');
  });
  it('IA', () => {
    expect(personalBlockState(item('hand_to_ai'), sem)).toBe('indisponivel');
    expect(personalBlockState(item('disable_ai'), sem)).toBe('ok');
    expect(personalBlockState(item('wait'), sem)).toBe('ok');
  });
  it('isPersonalFlow', () => {
    expect(isPersonalFlow({ permissions: { personal: true } as never })).toBe(true);
    expect(isPersonalFlow({})).toBe(false);
  });
});

describe('tirarDaEquipe (revisão final)', () => {
  it('sem dono ou dono = quem tira: fala dos seus leads', () => {
    expect(tirarDaEquipe({ owner_user_id: null, owner_name: null }, 'u1').descricao)
      .toBe('Esta automação passa a valer só pros seus leads e a mandar pelo seu WhatsApp.');
    expect(tirarDaEquipe({ owner_user_id: 'u1', owner_name: 'Eu' }, 'u1').titulo).toBe('Tirar da equipe?');
  });

  it('outro dono: fala dos leads dele; sem nome, "do dono"', () => {
    expect(tirarDaEquipe({ owner_user_id: 7, owner_name: 'Ana' }, 'u1').descricao)
      .toBe('Esta automação passa a valer só pros leads de Ana e a mandar pelo WhatsApp de Ana.');
    expect(tirarDaEquipe({ owner_user_id: 7, owner_name: null }, 'u1').descricao)
      .toBe('Esta automação passa a valer só pros leads do dono e a mandar pelo WhatsApp do dono.');
  });

  // Ajuste do dono do produto (16/10/2026): a pessoal do gestor.
  it('modoPessoal: corretor, dono (gestor na dele), de outro e da equipe', () => {
    const pessoal = (owner: string | null) => ({ owner_user_id: owner, permissions: { personal: true } }) as never;
    expect(modoPessoal(pessoal('u1'), { ehCorretor: true, meId: 'u1' })).toBe('corretor');
    expect(modoPessoal(pessoal('g1'), { ehCorretor: false, meId: 'g1' })).toBe('dono');
    expect(modoPessoal(pessoal('u2'), { ehCorretor: false, meId: 'g1' })).toBe('de_outro');
    expect(modoPessoal({ owner_user_id: 'g1', permissions: { personal: false } } as never, { ehCorretor: false, meId: 'g1' })).toBeNull();
    expect(modoPessoal(null, { ehCorretor: true, meId: 'u1' })).toBeNull();
  });

  it('personalAvailabilityState: só número e IA, sem a lista do cargo', () => {
    expect(personalAvailabilityState(item('send_whatsapp'), sem)).toBe('indisponivel');
    expect(personalAvailabilityState(item('lead_action:send_audio'), sem)).toBe('indisponivel');
    expect(personalAvailabilityState(item('lead_action:start_followup_flow'), sem)).toBe('indisponivel');
    expect(personalAvailabilityState(item('hand_to_ai'), { temNumero: true, temIA: false })).toBe('indisponivel');
    // Fora da lista do corretor, mas o gestor tem: nunca 'fora'.
    expect(personalAvailabilityState(item('notify_group'), sem)).toBe('ok');
    expect(personalAvailabilityState(item('lead_action:notify_group'), sem)).toBe('ok');
    expect(personalAvailabilityState(item('send_whatsapp'), com)).toBe('ok');
    expect(personalBlockState(item('notify_group'), com)).toBe('fora');
  });

  it('saiPeloWhatsAppDe e presaNaEquipe', () => {
    expect(saiPeloWhatsAppDe('Ana')).toBe('Sai pelo WhatsApp de Ana');
    expect(saiPeloWhatsAppDe('')).toBe('Sai pelo WhatsApp do dono');
    expect(presaNaEquipe({ permissions: { personal: false, fixed_number: true } } as never)).toBe(true);
    expect(presaNaEquipe({ permissions: { personal: true, fixed_number: true } } as never)).toBe(false);
    expect(presaNaEquipe({ permissions: { personal: false } } as never)).toBe(false);
  });
});
