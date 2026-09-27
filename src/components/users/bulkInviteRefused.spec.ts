import { describe, it, expect } from 'vitest';
import { parseRefusedInvites } from './bulkInviteRefused';

describe('parseRefusedInvites', () => {
  it('devolve lista vazia quando o servidor não manda "refused"', () => {
    expect(parseRefusedInvites({})).toEqual([]);
    expect(parseRefusedInvites(undefined)).toEqual([]);
    expect(parseRefusedInvites(null)).toEqual([]);
  });

  it('devolve lista vazia quando "refused" não é um array', () => {
    expect(parseRefusedInvites({ refused: 'oops' } as any)).toEqual([]);
    expect(parseRefusedInvites({ refused: { email: 'x' } } as any)).toEqual([]);
  });

  it('mantém o e-mail e a mensagem do servidor, verbatim (não reescreve)', () => {
    const refused = [
      { email: 'equipe@lealmidia.com.br', message: 'Este e-mail é reservado à equipe da Leal Mídia' },
    ];
    expect(parseRefusedInvites({ refused })).toEqual([
      { email: 'equipe@lealmidia.com.br', message: 'Este e-mail é reservado à equipe da Leal Mídia' },
    ]);
  });

  it('descarta item malformado (sem e-mail ou sem mensagem) sem derrubar os outros', () => {
    const refused = [
      { email: 'ok@cliente.com', message: 'Motivo válido' },
      { email: '', message: 'Sem e-mail' },
      { message: 'Sem e-mail nenhum' },
      { email: 'sem-mensagem@cliente.com' },
      { email: 'tipo-errado@cliente.com', message: 123 },
      'string solta',
      null,
    ];
    expect(parseRefusedInvites({ refused } as any)).toEqual([
      { email: 'ok@cliente.com', message: 'Motivo válido' },
    ]);
  });
});
