import { describe, expect, it } from 'vitest';
import { FLOW_TRIGGER_GROUPS } from './trigger';
import type { PaletteItem } from './palette';
import { isPersonalFlow, personalBlockState, personalTriggerGroups } from './personal';

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
