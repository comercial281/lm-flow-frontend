import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  persistSessionToken,
  clearSessionToken,
  readSessionToken,
  TOKEN_KEY,
} from './sessionPersistence';

/** Um armazenamento de mentira, que pode recusar como o navegador recusa. */
function lojaFalsa(opts: { recusaGravar?: boolean; fingeGravar?: boolean } = {}): Storage {
  const dados = new Map<string, string>();
  return {
    getItem: (k: string) => (dados.has(k) ? (dados.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      if (opts.recusaGravar) throw new Error('QuotaExceededError');
      // O Safari em modo restrito ACEITA o setItem e devolve vazio na leitura.
      if (!opts.fingeGravar) dados.set(k, v);
    },
    removeItem: (k: string) => { dados.delete(k); },
    clear: () => dados.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

function instalar(local: Storage | (() => never), session: Storage | (() => never)) {
  const defina = (nome: 'localStorage' | 'sessionStorage', valor: Storage | (() => never)) => {
    Object.defineProperty(window, nome, {
      configurable: true,
      get: typeof valor === 'function' ? (valor as () => never) : () => valor,
    });
  };
  defina('localStorage', local);
  defina('sessionStorage', session);
}

describe('guardar a sessão no aparelho', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { clearSessionToken(); });

  it('grava e lê quando o navegador deixa', () => {
    instalar(lojaFalsa(), lojaFalsa());

    expect(persistSessionToken('abc123')).toEqual({ persisted: true });
    expect(readSessionToken()).toBe('abc123');

    clearSessionToken();
    expect(readSessionToken()).toBeNull();
  });

  // ⚠️ O defeito que mandou corretora para a tela de "Credenciais inválidas" com
  // o login APROVADO: a gravação estourava e a exceção subia até a tela.
  it('não estoura quando a gravação é recusada — e diz que não guardou', () => {
    instalar(lojaFalsa({ recusaGravar: true }), lojaFalsa({ recusaGravar: true }));

    expect(() => persistSessionToken('abc123')).not.toThrow();
    expect(persistSessionToken('abc123').persisted).toBe(false);
  });

  it('cai na sessão da aba quando só o armazenamento permanente recusa', () => {
    const sessao = lojaFalsa();
    instalar(lojaFalsa({ recusaGravar: true }), sessao);

    expect(persistSessionToken('abc123').persisted).toBe(false);
    // A navegação de agora continua funcionando: a chave está na aba.
    expect(sessao.getItem(TOKEN_KEY)).toBe('abc123');
    expect(readSessionToken()).toBe('abc123');
  });

  // Safari em modo restrito aceita o setItem e devolve vazio na leitura. Sem a
  // conferência de volta, a tela diria que a sessão está guardada e ela não está.
  it('não acredita em gravação que a leitura não confirma', () => {
    instalar(lojaFalsa({ fingeGravar: true }), lojaFalsa({ fingeGravar: true }));

    expect(persistSessionToken('abc123').persisted).toBe(false);
  });

  // Com dados de site bloqueados, o simples ACESSO ao armazenamento estoura — e
  // a leitura roda na montagem da store, antes de qualquer tela aparecer.
  it('lê sem estourar quando o acesso ao armazenamento é proibido', () => {
    const proibido = (() => { throw new Error('SecurityError'); }) as () => never;
    instalar(proibido, proibido);

    expect(() => readSessionToken()).not.toThrow();
    expect(readSessionToken()).toBeNull();
    expect(() => clearSessionToken()).not.toThrow();
    expect(persistSessionToken('abc123').persisted).toBe(false);
  });
});
