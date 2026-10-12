import { describe, expect, it } from 'vitest';
import {
  TEXTO_LIMITE_DE_ENVIOS,
  lerLimiteDeEnvios,
  segundosDoRetryAfter,
  textoDoErroDeEnvio,
} from './limiteDeEnvios';

const resposta = (status: number, corpo: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status, headers });

const CORPO_429 = {
  success: false,
  error: { code: 'TOO_MANY_REQUESTS', message: 'Muitos envios seguidos. Tente de novo em alguns minutos.' },
};

describe('segundosDoRetryAfter', () => {
  it('lê segundos', () => {
    expect(segundosDoRetryAfter('120')).toBe(120);
  });

  it('lê data HTTP', () => {
    const agora = Date.parse('2026-10-11T12:00:00Z');
    expect(segundosDoRetryAfter('Sun, 11 Oct 2026 12:05:00 GMT', agora)).toBe(300);
  });

  it('ausente, inválido, zero ou passado: null', () => {
    expect(segundosDoRetryAfter(null)).toBeNull();
    expect(segundosDoRetryAfter('')).toBeNull();
    expect(segundosDoRetryAfter('amanhã')).toBeNull();
    expect(segundosDoRetryAfter('0')).toBeNull();
    expect(segundosDoRetryAfter('Sun, 11 Oct 2026 11:00:00 GMT', Date.parse('2026-10-11T12:00:00Z'))).toBeNull();
  });

  it('valor exagerado tem teto de 15 minutos', () => {
    expect(segundosDoRetryAfter('86400')).toBe(900);
  });
});

describe('lerLimiteDeEnvios', () => {
  it('429: a frase do servidor e a espera do Retry-After', async () => {
    const r = await lerLimiteDeEnvios(resposta(429, { ...CORPO_429, error: { ...CORPO_429.error, message: 'Calma aí.' } }, { 'Retry-After': '540' }));
    expect(r).toEqual({ mensagem: 'Calma aí.', esperarSegundos: 540 });
  });

  it('429 sem corpo JSON nem cabeçalho: a reserva, sem espera', async () => {
    const r = await lerLimiteDeEnvios(resposta(429, 'Retry later\n'));
    expect(r).toEqual({ mensagem: TEXTO_LIMITE_DE_ENVIOS, esperarSegundos: null });
  });

  it('429 com mensagem vazia: a reserva', async () => {
    const r = await lerLimiteDeEnvios(resposta(429, { error: { message: '   ' } }));
    expect(r?.mensagem).toBe(TEXTO_LIMITE_DE_ENVIOS);
  });

  it('outro erro não é o limite (e não lê o corpo)', async () => {
    const res = resposta(500, { error: { message: 'boom' } });
    expect(await lerLimiteDeEnvios(res)).toBeNull();
    expect(res.bodyUsed).toBe(false);
  });

  it('aguenta resposta falsa de teste, sem cabeçalhos', async () => {
    expect(await lerLimiteDeEnvios({ status: 429, json: async () => CORPO_429 })).toEqual({
      mensagem: CORPO_429.error.message,
      esperarSegundos: null,
    });
    expect(await lerLimiteDeEnvios({ status: 500 })).toBeNull();
  });
});

describe('textoDoErroDeEnvio', () => {
  it('no limite, a frase do servidor; fora dele, a da tela', async () => {
    expect(await textoDoErroDeEnvio(resposta(429, CORPO_429), 'da tela')).toBe(CORPO_429.error.message);
    expect(await textoDoErroDeEnvio(resposta(502, {}), 'da tela')).toBe('da tela');
  });
});
