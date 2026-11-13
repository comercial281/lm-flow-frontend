import { describe, expect, it } from 'vitest';
import { destinoDepoisDoLogin } from './destinoDepoisDoLogin';

const ORIGEM = 'https://cliente.lmflow.com.br';

describe('destino depois do login (auditoria 3E-09)', () => {
  it('aceita caminho deste endereço, com busca e âncora', () => {
    expect(destinoDepoisDoLogin('/conversations/12?aba=minhas#fim', ORIGEM)).toBe('/conversations/12?aba=minhas#fim');
  });

  it('recusa endereço de outro site', () => {
    expect(destinoDepoisDoLogin('https://outro.site/login', ORIGEM)).toBeNull();
    expect(destinoDepoisDoLogin('//outro.site/login', ORIGEM)).toBeNull();
  });

  it('recusa os disfarces que o navegador vira //outro-site', () => {
    expect(destinoDepoisDoLogin('/\\outro.site/login', ORIGEM)).toBeNull();
    expect(destinoDepoisDoLogin('/\t/outro.site/login', ORIGEM)).toBeNull();
    expect(destinoDepoisDoLogin('/\\\\outro.site', ORIGEM)).toBeNull();
  });

  it('recusa o que não é caminho', () => {
    expect(destinoDepoisDoLogin('javascript:alert(1)', ORIGEM)).toBeNull();
    expect(destinoDepoisDoLogin('conversations', ORIGEM)).toBeNull();
    expect(destinoDepoisDoLogin('', ORIGEM)).toBeNull();
    expect(destinoDepoisDoLogin(null, ORIGEM)).toBeNull();
  });
});
