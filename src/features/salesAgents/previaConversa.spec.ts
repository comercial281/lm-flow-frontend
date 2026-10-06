import { describe, expect, it } from 'vitest';
import type { EmojiDaIa, PersonaDaIa, TomDaIa } from '@/services/salesAgents/salesAgentsService';
import { previaConversa } from './previaConversa';

const PERSONAS: PersonaDaIa[] = ['broker', 'owner', 'assistant'];
const TONS: TomDaIa[] = ['close', 'formal'];
const EMOJIS: EmojiDaIa[] = ['none', 'light'];
const EMOJI = /\p{Extended_Pictographic}/u;
const daIa = (m: { de: string; texto: string }[]) => m.filter((x) => x.de === 'ia').map((x) => x.texto).join(' ');

describe('previaConversa', () => {
  it('as 12 combinações têm 7 mensagens, começando pelo lead', () => {
    for (const persona of PERSONAS) for (const tom of TONS) for (const emoji of EMOJIS) {
      const m = previaConversa({ persona, tom, emoji, nome: 'Bia', imobiliaria: 'Aurora' });
      expect(m).toHaveLength(7);
      expect(m[0].de).toBe('lead');
    }
  });

  it('a consultora se apresenta em nome da imobiliária, sem se dizer virtual', () => {
    for (const tom of TONS) {
      expect(daIa(previaConversa({ persona: 'assistant', tom, emoji: 'none', nome: 'Bia', imobiliaria: 'Aurora' }))).toContain('consultora da Aurora');
    }
  });

  // A cicatriz do HandoffVoice: no número de uma corretora, "vou passar pro meu colega".
  it('o próprio corretor nunca fala em passar, colega, time ou equipe', () => {
    for (const tom of TONS) {
      expect(daIa(previaConversa({ persona: 'broker', tom, emoji: 'none', nome: 'Bruno', imobiliaria: 'Aurora' }))).not.toMatch(/passar|colega|time|equipe|encaminhar/i);
    }
  });

  it('o dono se apresenta como dono', () => {
    expect(daIa(previaConversa({ persona: 'owner', tom: 'close', emoji: 'none', nome: 'Carlos', imobiliaria: 'Aurora' }))).toContain('Carlos, dono da Aurora');
  });

  it('o dono passa pro time dele', () => {
    expect(daIa(previaConversa({ persona: 'owner', tom: 'close', emoji: 'none', nome: 'Carlos', imobiliaria: 'Aurora' }))).toContain('corretor do meu time');
    expect(daIa(previaConversa({ persona: 'owner', tom: 'formal', emoji: 'none', nome: 'Carlos', imobiliaria: 'Aurora' }))).toContain('minha equipe');
  });

  it('sem emoji não tem emoji; com emoji tem', () => {
    expect(daIa(previaConversa({ persona: 'owner', tom: 'close', emoji: 'none', nome: 'Carlos', imobiliaria: 'Aurora' }))).not.toMatch(EMOJI);
    expect(daIa(previaConversa({ persona: 'owner', tom: 'close', emoji: 'light', nome: 'Carlos', imobiliaria: 'Aurora' }))).toMatch(EMOJI);
  });

  it('formal não usa "Oi!"; próximo usa', () => {
    expect(previaConversa({ persona: 'assistant', tom: 'formal', emoji: 'none', nome: 'Bia', imobiliaria: 'Aurora' })[1].texto).toMatch(/^Olá!/);
    expect(previaConversa({ persona: 'assistant', tom: 'close', emoji: 'none', nome: 'Bia', imobiliaria: 'Aurora' })[1].texto).toMatch(/^Oi!/);
  });

  it('sem tom e emoji, usa o padrão (próximo, sem emoji)', () => {
    const m = previaConversa({ persona: 'owner', nome: 'Carlos', imobiliaria: 'Aurora' });
    expect(m[1].texto).toMatch(/^Oi!/);
    expect(daIa(m)).not.toMatch(EMOJI);
  });

  it('sem nome e sem imobiliária, usa nomes de exemplo', () => {
    expect(previaConversa({ persona: 'broker', tom: 'close', emoji: 'none', nome: ' ', imobiliaria: '' })[1].texto).toContain('Bruno, da Aurora Imóveis');
  });
});
