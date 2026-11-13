import { describe, expect, it } from 'vitest';
import { partesDoTitulo, semAsteriscos } from './destaqueNoTitulo';

describe('destaque no título', () => {
  it('separa o trecho entre asteriscos', () => {
    expect(partesDoTitulo('O imóvel certo pra sua *próxima fase.*')).toEqual({ antes: 'O imóvel certo pra sua ', marcado: 'próxima fase.', depois: '' });
  });
  it('só o primeiro par vale', () => {
    expect(partesDoTitulo('*a* e *b*')).toEqual({ antes: '', marcado: 'a', depois: ' e *b*' });
  });
  it('asterisco solto ou par vazio não é destaque', () => {
    expect(partesDoTitulo('5* estrelas')).toBeNull();
    expect(partesDoTitulo('**')).toBeNull();
  });
  it('semAsteriscos tira só o par e mantém o texto', () => {
    expect(semAsteriscos('Sem nada')).toBe('Sem nada');
    expect(semAsteriscos('Seu lar *aqui*')).toBe('Seu lar aqui');
    expect(semAsteriscos('5* estrelas')).toBe('5* estrelas');
  });
});
