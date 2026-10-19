import { describe, it, expect } from 'vitest';
import { codigoDoUuid, uuidDoCodigo, trocarUuidsPorCodigo, enderecoComUuid } from './codigoDoLink';

// Os MESMOS pares estão no spec do backend (spec/services/links/public_id_spec.rb).
// Mudou um lado, muda o outro: o servidor escreve o código e a tela lê.
const PARES: Array<[string, string]> = [
  ['00000000-0000-0000-0000-000000000000', '1111111111111111111111'],
  ['ffffffff-ffff-ffff-ffff-ffffffffffff', 'YcVfxkQb6JRzqk5kF2tNLv'],
  ['829a6b1e-8259-4c3d-9e2f-0a1b2c3d4e5f', 'H8PhzFPbgreJefMBgig7ux'],
  ['0b6f5c1a-3d2e-4f10-8a9b-c7d6e5f40312', '2Qu7ReJ5bTo99bHR2atWs3'],
  ['5f2c8e3a-1b4d-4e6f-a7b8-c9d0e1f2a3b4', 'CkeQAcM5XSj1CpnfRCt1Js'],
];
const [U1, C1] = PARES[2];
const [U2, C2] = PARES[3];

describe('código do link (id sem cara de chave Pix)', () => {
  it.each(PARES)('%s vira %s', (uuid, codigo) => {
    expect(codigoDoUuid(uuid)).toBe(codigo);
  });

  it.each(PARES)('%s volta do código %s', (uuid, codigo) => {
    expect(uuidDoCodigo(codigo)).toBe(uuid);
  });

  it('UUID em maiúsculas dá o mesmo código', () => {
    expect(codigoDoUuid(U1.toUpperCase())).toBe(C1);
  });

  it('o código nunca tem hífen e sempre tem 22 caracteres', () => {
    for (const [uuid] of PARES) {
      const codigo = codigoDoUuid(uuid);
      expect(codigo).toHaveLength(22);
      expect(codigo).not.toContain('-');
    }
  });

  it.each([
    ['teste', 'a palavra reservada do aceite de teste'],
    [U1, 'o próprio UUID'],
    ['H8PhzFPbgreJefMBgig7u', '21 caracteres'],
    ['H8PhzFPbgreJefMBgig7uxx', '23 caracteres'],
    ['H8PhzFPbgreJefMBgig70x', 'zero (fora do alfabeto)'],
    ['H8PhzFPbgreJefMBgigOux', 'O maiúsculo (fora do alfabeto)'],
    ['H8PhzFPbgreJefMBgigIux', 'I maiúsculo (fora do alfabeto)'],
    ['H8PhzFPbgreJefMBgiglux', 'l minúsculo (fora do alfabeto)'],
    ['zzzzzzzzzzzzzzzzzzzzzz', 'número maior que um UUID'],
    ['42', 'número curto da conversa'],
  ])('"%s" não é código (%s)', (texto) => {
    expect(uuidDoCodigo(texto)).toBeNull();
  });

  it('troca todo UUID do texto pelo código, e só ele', () => {
    expect(trocarUuidsPorCodigo(`https://x.lmflow.com.br/pipelines/${U1}?card=${U2}&aba=2`))
      .toBe(`https://x.lmflow.com.br/pipelines/${C1}?card=${C2}&aba=2`);
    expect(trocarUuidsPorCodigo('/roleta/aceite/teste?prazo=10')).toBe('/roleta/aceite/teste?prazo=10');
  });
});

describe('endereço com UUID (o que a tela abre ao chegar por um link com código)', () => {
  it.each([
    [`/roleta/aceite/${C1}`, '', `/roleta/aceite/${U1}`],
    [`/conversations/${C2}`, '', `/conversations/${U2}`],
    [`/contacts/${C1}`, '', `/contacts/${U1}`],
    [`/pipelines/${C1}/card/${C2}`, '', `/pipelines/${U1}/card/${U2}`],
    [`/pipelines/${C1}`, `?card=${C2}&aba=2`, `/pipelines/${U1}?card=${U2}&aba=2`],
    [`/pipelines/${U1}`, `?card=${C2}`, `/pipelines/${U1}?card=${U2}`],
    [`/academia/curso/${C1}`, `?lesson=${C2}`, `/academia/curso/${U1}?lesson=${U2}`],
  ])('%s%s → %s', (pathname, search, esperado) => {
    expect(enderecoComUuid(pathname, search)).toBe(esperado);
  });

  it.each([
    ['/roleta/aceite/teste', '?prazo=10&destino=roleta', 'aceite de teste'],
    [`/conversations/${U1}`, '', 'endereço que já tem UUID'],
    [`/pipelines/${U1}`, `?card=${U2}`, 'card que já tem UUID'],
    ['/conversations', '', 'lista de conversas'],
    [`/lp/pinot/${C1}`, '', 'rota que não recebe id (slug de landing)'],
    [`/imovel/pinot/${C1}`, '', 'página do imóvel'],
    ['/dashboard', `?card=${C1}`, '?card= fora do funil'],
  ])('%s%s fica como está (%s)', (pathname, search) => {
    expect(enderecoComUuid(pathname, search)).toBeNull();
  });
});
