import { describe, it, expect } from 'vitest';
import { loginFeedback } from './loginFeedback';

// Um erro no formato que o axios entrega.
const doServidor = (data: unknown, status = 401) => ({ response: { status, data } });

describe('o que a tela de login diz quando não dá para entrar', () => {
  it('mostra o motivo do servidor, palavra por palavra', () => {
    const r = loginFeedback(
      doServidor({ success: false, error: { code: 'X', message: 'Este acesso está suspenso.' } }),
    );

    expect(r.description).toBe('Este acesso está suspenso.');
    expect(r.fromServer).toBe(true);
  });

  // O formato que a recusa por cargo usa: `error` é texto genérico em inglês e a
  // explicação vem em `message`, um nível acima. Ler só o primeiro faz a tela
  // mostrar a frase genérica e mandar procurar o problema no lugar errado.
  it('lê o segundo formato de erro da API', () => {
    const r = loginFeedback(
      doServidor({ error: 'Forbidden - Insufficient permissions', message: 'Seu acesso foi desativado.' }, 403),
    );

    expect(r.description).toBe('Seu acesso foi desativado.');
    expect(r.fromServer).toBe(true);
  });

  // ⚠️ A regra da casa: sem motivo do servidor, a frase NÃO afirma a causa.
  // Dizer "credenciais inválidas" quando o pedido nem voltou é o que custou
  // três rodadas de investigação acusando a senha de quem estava certo.
  it('sem resposta do servidor, diz só que o pedido não voltou', () => {
    const r = loginFeedback(new Error('Network Error'));

    expect(r.fromServer).toBe(false);
    expect(r.description).toContain('não respondeu');
    expect(r.description.toLowerCase()).not.toContain('senha');
    expect(r.description.toLowerCase()).not.toContain('credenciais');
  });

  it('resposta sem corpo de erro não vira explicação', () => {
    const r = loginFeedback(doServidor({}, 500));

    expect(r.fromServer).toBe(false);
    expect(r.description).toContain('não respondeu');
  });

  // Requisição derrubada por tempo esgotado volta sem corpo nenhum — foi assim
  // que a frase de reserva virou diagnóstico nas abas de Relatórios.
  it('pedido derrubado sem corpo não vira explicação', () => {
    const r = loginFeedback({ request: {}, message: 'timeout of 15000ms exceeded' });

    expect(r.fromServer).toBe(false);
    expect(r.description).toContain('não respondeu');
  });
});
