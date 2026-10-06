import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// A regra do dono muda o que a tela PROMETE. Ela vale quando o servidor diz
// que vale (o eco na resposta, que cobre os 5 min de cache das funcionalidades
// logo depois do Ligar) e, na falta dele, pela chave do cliente.
const toggles = vi.hoisted(() => ({ value: {} as Record<string, boolean> }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({
  useClientToggle: (key: string) => toggles.value[key] === true,
}));

import { ownerRuleForChannel, resolveOwnerRule, useNumberOwnerRule } from './useNumberOwnerRule';

const CHAVE = ['numero', 'dono', 'unico'].join('_');

beforeEach(() => {
  toggles.value = {};
});

describe('resolveOwnerRule', () => {
  it('o eco do servidor vence a chave, nos dois sentidos', () => {
    expect(resolveOwnerRule(true, false)).toBe(true);
    expect(resolveOwnerRule(false, true)).toBe(false);
  });

  it('sem eco, vale a chave do cliente', () => {
    expect(resolveOwnerRule(null, true)).toBe(true);
    expect(resolveOwnerRule(undefined, false)).toBe(false);
  });
});

describe('ownerRuleForChannel — o que ChannelSettings passa pro cartão', () => {
  it('em WhatsApp, o eco do cartão', () => {
    expect(ownerRuleForChannel(true, { number_owner_rule: true })).toBe(true);
    expect(ownerRuleForChannel(true, { number_owner_rule: false })).toBe(false);
  });

  it('em WhatsApp sem cartão (ainda carregando), nulo — cai na chave do cliente', () => {
    expect(ownerRuleForChannel(true, null)).toBeNull();
    expect(ownerRuleForChannel(true, undefined)).toBeNull();
  });

  it('fora de WhatsApp (L11), nunca promete a regra — mesmo com o cartão dizendo que sim', () => {
    expect(ownerRuleForChannel(false, { number_owner_rule: true })).toBe(false);
    expect(ownerRuleForChannel(false, null)).toBe(false);
  });
});

describe('useNumberOwnerRule', () => {
  it('cliente sem a chave e sem eco: desligada', () => {
    expect(renderHook(() => useNumberOwnerRule()).result.current).toBe(false);
  });

  it('chave ligada e sem eco: ligada', () => {
    toggles.value = { [CHAVE]: true };
    expect(renderHook(() => useNumberOwnerRule(null)).result.current).toBe(true);
  });

  it('o eco do servidor manda', () => {
    toggles.value = { [CHAVE]: true };
    expect(renderHook(() => useNumberOwnerRule(false)).result.current).toBe(false);
  });
});

// Os dois scanners do catálogo (sync/audit) acham a chave por REGEX na chamada
// literal. Constante no lugar dela tira a chave do catálogo no deploy seguinte,
// calado. E a chave mora num lugar só (Global Constraints). A busca é montada
// em pedaços: escrita literal, ela contaria como uso da chave por este spec.
describe('a chave no código', () => {
  const RAIZ = resolve(__dirname, '../../..');
  const SRC = join(RAIZ, 'src');

  function arquivos(dir: string, saida: string[] = []): string[] {
    for (const nome of readdirSync(dir)) {
      const cheio = join(dir, nome);
      if (statSync(cheio).isDirectory()) arquivos(cheio, saida);
      else if (/\.(ts|tsx)$/.test(nome) && !/\.spec\.tsx?$/.test(nome)) saida.push(cheio);
    }
    return saida;
  }

  it('está escrita literal na chamada do useClientToggle', () => {
    const fonte = readFileSync(join(__dirname, 'useNumberOwnerRule.ts'), 'utf8');
    expect(fonte).toContain(['useClientToggle(', "'", CHAVE, "'", ')'].join(''));
  });

  it('só aparece em useNumberOwnerRule.ts', () => {
    const usos = arquivos(SRC)
      .filter(f => readFileSync(f, 'utf8').includes(CHAVE))
      .map(f => relative(RAIZ, f));
    expect(usos).toEqual(['src/features/numbers/useNumberOwnerRule.ts']);
  });
});
