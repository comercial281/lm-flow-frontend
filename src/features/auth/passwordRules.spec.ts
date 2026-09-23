import { describe, it, expect } from 'vitest';
import { checkNewPassword, MIN_SENHA } from './passwordRules';

describe('a senha que a pessoa cria pelo link', () => {
  it('aceita duas senhas iguais com o mínimo de caracteres', () => {
    expect(checkNewPassword('minhasenha', 'minhasenha')).toEqual({ ok: true, message: '' });
  });

  it('recusa senha curta, dizendo o mínimo', () => {
    const r = checkNewPassword('abc', 'abc');
    expect(r.ok).toBe(false);
    expect(r.message).toContain(String(MIN_SENHA));
  });

  // O teclado do celular acrescenta espaço sozinho. Uma senha que só atinge o
  // mínimo por causa dele é uma senha que a pessoa não consegue digitar amanhã.
  it('não conta espaço nas pontas para chegar ao mínimo', () => {
    expect(checkNewPassword('  abc  ', '  abc  ').ok).toBe(false);
  });

  it('recusa quando a confirmação é diferente', () => {
    const r = checkNewPassword('minhasenha', 'minhasenh');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('não são iguais');
  });

  // A régua tem que ser a MESMA do servidor: se ela aceitasse o que ele recusa,
  // a pessoa levaria o erro depois de clicar, sem saber o que corrigir.
  it('recusa senha vazia sem estourar', () => {
    expect(checkNewPassword('', '').ok).toBe(false);
    expect(checkNewPassword(undefined as unknown as string, '').ok).toBe(false);
  });
});
