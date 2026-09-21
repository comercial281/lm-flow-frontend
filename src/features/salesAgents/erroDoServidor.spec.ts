import { describe, expect, it } from 'vitest';
import { fatoDaFalha, motivoDaFalha, motivoEscrito } from './erroDoServidor';

/**
 * ⚠️ A regra que estes casos travam: **a tela nunca fica sem dizer o que aconteceu**.
 *
 * Foi a ausência disto que fez o relatório da semana passar por seis rodadas de
 * conserto: 404 (servidor não publicado), 500 (quebrou), 502 (hospedagem), teto de
 * tempo e queda de rede chegavam ao gestor como a MESMA frase genérica, e nenhuma
 * delas se conserta igual.
 */
describe('motivoEscrito', () => {
  it('lê o formato padrão da API', () => {
    const e = { response: { data: { error: { code: 'X', message: 'Não há rascunho para editar.' } } } };
    expect(motivoEscrito(e)).toBe('Não há rascunho para editar.');
  });

  // A recusa por cargo tem outro formato, e ler só o primeiro fazia "seu cargo não
  // permite esta ação" virar a frase genérica.
  it('lê o formato da recusa por cargo', () => {
    const e = { response: { data: { error: 'forbidden', message: 'Seu cargo não permite esta ação.' } } };
    expect(motivoEscrito(e)).toBe('Seu cargo não permite esta ação.');
  });

  it('devolve nulo quando não há corpo legível', () => {
    expect(motivoEscrito({ response: { status: 404 } })).toBeNull();
    expect(motivoEscrito({ message: 'Network Error' })).toBeNull();
    // Corpo em HTML (o 404 do roteador, o 502 da hospedagem) não é motivo.
    expect(motivoEscrito({ response: { status: 502, data: '<html>bad gateway</html>' } })).toBeNull();
  });
});

describe('fatoDaFalha', () => {
  it('separa o servidor que não conhece o endereço', () => {
    expect(fatoDaFalha({ response: { status: 404 } })).toContain('404');
    expect(fatoDaFalha({ response: { status: 404 } })).toContain('deploy do backend');
  });

  it('separa a hospedagem do servidor', () => {
    expect(fatoDaFalha({ response: { status: 502 } })).toContain('hospedagem');
    expect(fatoDaFalha({ response: { status: 500 } })).toContain('quebrou');
  });

  it('separa "não houve resposta" de qualquer código', () => {
    expect(fatoDaFalha({ message: 'Network Error' })).toContain('sem resposta');
    expect(fatoDaFalha(new Error('boom'))).toContain('sem resposta');
  });

  it('diz o código mesmo quando não sabe interpretá-lo', () => {
    expect(fatoDaFalha({ response: { status: 418 } })).toContain('418');
  });
});

describe('motivoDaFalha', () => {
  it('prefere o que o servidor escreveu', () => {
    const e = { response: { status: 422, data: { error: { message: 'Semana sem movimento.' } } } };
    expect(motivoDaFalha(e, 'Não consegui gerar a prévia.')).toBe('Semana sem movimento.');
  });

  // ⚠️ O caso que importa: sem corpo, a frase NÃO pode ser só "não consegui".
  it('nunca devolve vazio, e carrega o fato quando não há motivo escrito', () => {
    const texto = motivoDaFalha({ response: { status: 404 } }, 'Não consegui rodar o diagnóstico.');

    expect(texto).toContain('Não consegui rodar o diagnóstico.');
    expect(texto).toContain('404');
    expect(texto.length).toBeGreaterThan(20);
  });

  it('funciona sem a frase de contexto', () => {
    expect(motivoDaFalha({ response: { status: 500 } })).toContain('500');
  });
});
