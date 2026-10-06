import { describe, expect, it } from 'vitest';
import { abasDeQuemAssume, escolhaDe, quemAssumeDe } from './CampoQuemAssume';

const pessoas = [{ id: 'u1', nome: 'Ana' }];
const roletas = [
  { id: 'r1', name: 'Zona Sul', is_active: true },
  { id: 'r2', name: 'Antiga', is_active: false },
];
const rotulos = (abas: ReturnType<typeof abasDeQuemAssume>) =>
  abas.map(a => [a.rotulo, a.opcoes.map(o => o.rotulo)]);

describe('CampoQuemAssume', () => {
  it('oferece as roletas ligadas; a desligada só quando é a escolhida', () => {
    expect(rotulos(abasDeQuemAssume(pessoas, roletas, null))).toEqual([
      ['Corretores', ['Ana']], ['Roleta', ['Zona Sul']],
    ]);
    expect(rotulos(abasDeQuemAssume(pessoas, roletas, { aba: 'roleta', valor: 'r2' }))[1])
      .toEqual(['Roleta', ['Zona Sul', 'Antiga (desligada)']]);
  });

  it('lista recusada por cargo some com a aba, menos quando a escolha gravada é dela', () => {
    expect(rotulos(abasDeQuemAssume(pessoas, null, null))).toEqual([['Corretores', ['Ana']]]);
    expect(rotulos(abasDeQuemAssume(null, null, { aba: 'roleta', valor: 'r9' }))).toEqual([
      ['Roleta', ['Roleta escolhida']],
    ]);
    expect(rotulos(abasDeQuemAssume(pessoas, [], { aba: 'corretor', valor: 'u9' }))[0])
      .toEqual(['Corretores', ['Ana', 'Responsável escolhido (fora da lista)']]);
  });

  it('gravado com os dois, vale o corretor; escolher um limpa o outro', () => {
    expect(escolhaDe({ default_assignee_id: 'u1', roleta_config_id: 'r1' })).toEqual({ aba: 'corretor', valor: 'u1' });
    expect(quemAssumeDe({ aba: 'roleta', valor: 'r1' })).toEqual({ default_assignee_id: null, roleta_config_id: 'r1' });
    expect(quemAssumeDe(null)).toEqual({ default_assignee_id: null, roleta_config_id: null });
  });
});
