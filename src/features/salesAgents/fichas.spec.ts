import { describe, expect, it } from 'vitest';
import type { AgentNumber, HouseVoice } from '@/services/salesAgents/salesAgentsService';
import { O_QUE_A_VOZ_FAZ, previaDaApresentacao, vozDoNumero } from './fichas';

const numero = (voice: AgentNumber['voice']): AgentNumber => ({
  id: 'n1', inbox_id: 'i1', phone: null, inbox_name: 'Número Ana', enabled: true, connected: true, voice, triggers: null, position: 0,
  owner_user_id: 'u1', owner_name: 'Ana',
});
const casa: HouseVoice = { kind: 'consultora', name: 'Maria', gender: 'ela', intro: 'sou do time da Aurora Imóveis' };

describe('vozDoNumero', () => {
  it('número sem ficha própria usa a da casa inteira', () => {
    expect(vozDoNumero(numero(null), casa)).toEqual({ kind: 'consultora', name: 'Maria', gender: 'ela', intro: 'sou do time da Aurora Imóveis' });
  });

  it('número sem nome herda o da casa; o que ele tem de próprio vence', () => {
    const v = vozDoNumero(numero({ kind: 'corretor', intro: 'sou a Ana, corretora' }), casa);
    expect(v).toMatchObject({ kind: 'corretor', name: 'Maria', gender: 'ela', intro: 'sou a Ana, corretora' });
  });

  it('texto em branco conta como ausente', () => {
    expect(vozDoNumero(numero({ name: '  ' }), casa).name).toBe('Maria');
  });

  it('casa nula (agente não migrado) não quebra', () => {
    expect(vozDoNumero(numero(null), null)).toEqual({});
  });
});

describe('previaDaApresentacao', () => {
  it('usa o "como se apresenta" com a inicial maiúscula', () => {
    expect(previaDaApresentacao({ kind: 'corretor', name: 'Ana', intro: 'sou a Ana, corretora' }))
      .toBe('Oi, Maria! Sou a Ana, corretora. Vi que você se interessou pelo Residencial Teste. Me conta: é pra morar ou pra investir?');
  });

  it('não repete o ponto final que a pessoa já pôs', () => {
    expect(previaDaApresentacao({ intro: 'sou a Bia.' })).toContain('Oi, Maria! Sou a Bia. Vi que');
  });

  it('sem apresentação: consultora fala do time, corretor e dono falam pelo nome', () => {
    expect(previaDaApresentacao({ kind: 'consultora' })).toContain('Oi, Maria! Aqui é do time da Aurora Imóveis. Vi que');
    expect(previaDaApresentacao({ kind: 'corretor', name: 'Caio' })).toContain('Oi, Maria! Aqui é Caio. Vi que');
    expect(previaDaApresentacao({ kind: 'corretor', gender: 'ela' })).toContain('Aqui é a corretora.');
    expect(previaDaApresentacao({ kind: 'dono_gerente', gender: 'ele' })).toContain('Aqui é o dono.');
  });
});

describe('O_QUE_A_VOZ_FAZ', () => {
  it('uma frase pra cada voz, sem travessão', () => {
    expect(Object.keys(O_QUE_A_VOZ_FAZ).sort()).toEqual(['consultora', 'corretor', 'dono_gerente']);
    expect(Object.values(O_QUE_A_VOZ_FAZ).some((t) => /[—–]/.test(t))).toBe(false);
  });
});
