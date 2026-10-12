import { describe, expect, it } from 'vitest';
import type { Message } from '@/types/chat/api';
import {
  TAMANHO_DA_PAGINA,
  aplicarPaginaRecente,
  juntarMensagens,
  mensagemDoErro,
  ordenarMensagens,
  paginaDaResposta,
  temMaisAntigas,
} from './conversaDoCard';

const m = (id: number | string, created_at: number | string, extra: Partial<Message> = {}) =>
  ({ id, content: `m${id}`, created_at, message_type: 0, attachments: [], ...extra }) as unknown as Message;
const ids = (lista: Message[]) => lista.map(x => String(x.id));

describe('ordenarMensagens', () => {
  it('ordena por data (número, texto numérico ou ISO) e deixa a em envio por último', () => {
    const lista = [m(3, 300), m('e', 100, { status: 'progress' } as Partial<Message>), m(1, '100'), m(2, '1970-01-01T00:03:20Z')];
    expect(ids(ordenarMensagens(lista))).toEqual(['1', '2', '3', 'e']);
  });
});

describe('juntarMensagens', () => {
  it('junta pelo id e a versão nova ganha', () => {
    const atual = [m(1, 100), m(2, 200, { content: 'velho' })];
    const novas = [m(2, 200, { content: 'novo' }), m(3, 300)];
    const out = juntarMensagens(atual, novas);
    expect(ids(out)).toEqual(['1', '2', '3']);
    expect(out[1].content).toBe('novo');
  });

  it('id número e texto são o mesmo', () => {
    expect(ids(juntarMensagens([m(1, 100)], [m('1', 100)]))).toEqual(['1']);
  });
});

describe('aplicarPaginaRecente', () => {
  it('mantém as antigas carregadas antes do trecho da página', () => {
    const atuais = [m(1, 100), m(2, 200), m(3, 300)];
    expect(ids(aplicarPaginaRecente(atuais, [m(3, 300), m(4, 400)]))).toEqual(['1', '2', '3', '4']);
  });

  it('mensagem apagada dentro do trecho da página some', () => {
    const atuais = [m(1, 100), m(2, 200), m(3, 300)];
    expect(ids(aplicarPaginaRecente(atuais, [m(1, 100), m(3, 300)]))).toEqual(['1', '3']);
  });

  it('mensagem mais nova que a página (chegou pelo tempo real) fica', () => {
    const atuais = [m(1, 100), m(5, 500)];
    expect(ids(aplicarPaginaRecente(atuais, [m(1, 100), m(2, 200)]))).toEqual(['1', '2', '5']);
  });

  it('página vazia zera', () => {
    expect(aplicarPaginaRecente([m(1, 100)], [])).toEqual([]);
  });
});

describe('temMaisAntigas', () => {
  it('página cheia = tem mais; menos que 20 = começo da conversa', () => {
    expect(TAMANHO_DA_PAGINA).toBe(20);
    expect(temMaisAntigas(Array.from({ length: 20 }, (_, i) => m(i, i)))).toBe(true);
    expect(temMaisAntigas(Array.from({ length: 19 }, (_, i) => m(i, i)))).toBe(false);
  });
});

describe('paginaDaResposta', () => {
  it('aceita lista, { data } e { payload }; o resto vira lista vazia', () => {
    expect(ids(paginaDaResposta([m(1, 1)]))).toEqual(['1']);
    expect(ids(paginaDaResposta({ data: [m(2, 2)] }))).toEqual(['2']);
    expect(ids(paginaDaResposta({ payload: [m(3, 3)] }))).toEqual(['3']);
    expect(paginaDaResposta(null)).toEqual([]);
    expect(paginaDaResposta({ data: 'x' })).toEqual([]);
  });
});

describe('mensagemDoErro', () => {
  it('lê error.message do servidor; senão usa o padrão', () => {
    const doServidor = { response: { data: { error: { message: 'Transcrição não configurada.' } } } };
    expect(mensagemDoErro(doServidor, 'padrão')).toBe('Transcrição não configurada.');
    expect(mensagemDoErro(new Error('Network Error'), 'padrão')).toBe('padrão');
  });
});
