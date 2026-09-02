import { describe, it, expect } from 'vitest';
import { instanciasComAcesso, instanciaResolvida, type EquipeInput } from './roletaEquipe';

// A lista de marcar substituiu a linha-a-linha. O que ela precisa acertar é
// QUEM pode entrar e por QUAL número — e é isso que estes exemplos travam.

const N1 = 'numero-1';
const N2 = 'numero-2';

function form(over: Partial<EquipeInput> = {}): EquipeInput {
  return {
    instances: [{ inbox_id: N1, is_active: true }],
    inboxDeEntrada: N1,
    membrosPorInstancia: { [N1]: [{ id: 'joao' }, { id: 'maria' }] },
    ...over,
  };
}

describe('instanciasComAcesso', () => {
  it('devolve o número em que a pessoa foi liberada', () => {
    expect(instanciasComAcesso('joao', form())).toEqual([N1]);
  });

  it('devolve vazio para quem não foi liberado — é quem ganha o "Liberar e adicionar"', () => {
    expect(instanciasComAcesso('pedro', form())).toEqual([]);
  });

  it('devolve os dois quando a pessoa atende pelos dois números', () => {
    const f = form({
      instances: [{ inbox_id: N1, is_active: true }, { inbox_id: N2, is_active: true }],
      membrosPorInstancia: { [N1]: [{ id: 'joao' }], [N2]: [{ id: 'joao' }] },
    });
    expect(instanciasComAcesso('joao', f)).toEqual([N1, N2]);
  });

  it('ignora número desativado — ele não distribui, então não conta como acesso', () => {
    const f = form({
      instances: [{ inbox_id: N1, is_active: true }, { inbox_id: N2, is_active: false }],
      membrosPorInstancia: { [N1]: [], [N2]: [{ id: 'joao' }] },
    });
    expect(instanciasComAcesso('joao', f)).toEqual([]);
  });

  // Formulário recém-aberto, ou roleta de um número só: a lista de números
  // ainda não existe e quem responde é o número de entrada.
  it('cai no número de entrada quando não há lista de números', () => {
    const f = form({ instances: [] });
    expect(instanciasComAcesso('joao', f)).toEqual([N1]);
  });

  it('não quebra sem pessoa e sem número', () => {
    expect(instanciasComAcesso('', form())).toEqual([]);
    expect(instanciasComAcesso('joao', form({ instances: [], inboxDeEntrada: '' }))).toEqual([]);
  });
});

describe('instanciaResolvida', () => {
  // É isto que faz a pergunta "atende por qual número?" sumir no caso comum.
  it('resolve sozinha quando há um acesso só', () => {
    expect(instanciaResolvida('joao', form())).toBe(N1);
  });

  it('devolve vazio com dois acessos — aí a tela precisa perguntar', () => {
    const f = form({
      instances: [{ inbox_id: N1, is_active: true }, { inbox_id: N2, is_active: true }],
      membrosPorInstancia: { [N1]: [{ id: 'joao' }], [N2]: [{ id: 'joao' }] },
    });
    expect(instanciaResolvida('joao', f)).toBe('');
  });

  it('devolve vazio para quem não tem acesso nenhum', () => {
    expect(instanciaResolvida('pedro', form())).toBe('');
  });
});
