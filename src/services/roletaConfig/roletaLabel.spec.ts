import { describe, it, expect } from 'vitest';
import { roletaLabel } from './roletaConfigService';

// Qual nome de roleta aparece na tela.
//
// O card do CRM mostrava o nome do NÚMERO de entrada
// ("apto-premium-bernardo-numero-principal") enquanto a lista de roletas já
// mostrava o apelido ("Apto Premium") — duas telas, dois nomes, e ninguém
// conseguindo seguir o lead de uma pra outra.
describe('roletaLabel', () => {
  it('prefere o apelido resolvido pelo backend', () => {
    expect(roletaLabel({
      display_name: 'Apto Premium',
      name: 'Apto Premium',
      inbox_name: 'apto-premium-bernardo-numero-principal',
    })).toBe('Apto Premium');
  });

  it('usa o apelido digitado quando o backend ainda não devolveu o resolvido', () => {
    expect(roletaLabel({ display_name: null, name: 'Plantão do fim de semana' }))
      .toBe('Plantão do fim de semana');
  });

  it('cai no nome do canal quando ninguém batizou a roleta', () => {
    expect(roletaLabel({ display_name: null, name: null, inbox_name: 'kyra' })).toBe('kyra');
  });

  // Nome só com espaços é o mesmo que nome nenhum: sem isso o seletor mostraria
  // um item em branco, impossível de identificar.
  it('ignora nome em branco', () => {
    expect(roletaLabel({ display_name: '   ', name: '  ', inbox_name: 'yara' })).toBe('yara');
  });

  it('nunca devolve vazio', () => {
    expect(roletaLabel(null)).toBe('Roleta');
    expect(roletaLabel({})).toBe('Roleta');
  });
});
