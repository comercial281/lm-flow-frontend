import { describe, expect, it } from 'vitest';
import { linhaDoCondominio } from './nomeDoCondominio';

describe('linhaDoCondominio', () => {
  it('nome sem prefixo ganha "Condomínio"', () => {
    expect(linhaDoCondominio('Cyrela Arti Perdizes')).toBe('Condomínio Cyrela Arti Perdizes');
  });
  it.each([
    'Condomínio Vila Verde', 'condominio vila verde', 'CONDOMÍNIO Alto', 'Edifício Itália', 'edificio Copan',
    'Residencial Jardins', 'Residência Alba', 'residencia Alba', 'Conjunto Nacional',
  ])('nome que já começa com o prefixo fica como está: %s', nome => {
    expect(linhaDoCondominio(nome)).toBe(nome);
  });
  it('espaço sobrando nas pontas sai', () => {
    expect(linhaDoCondominio('  Edifício Itália ')).toBe('Edifício Itália');
    expect(linhaDoCondominio(' Vila Verde ')).toBe('Condomínio Vila Verde');
  });
});
