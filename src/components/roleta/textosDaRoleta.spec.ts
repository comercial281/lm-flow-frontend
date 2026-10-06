import { describe, expect, it } from 'vitest';
import { textoDaOferta } from './textosDaRoleta';

describe('textoDaOferta', () => {
  it('diz a quem foi OFERECIDO e por qual roleta', () => {
    expect(textoDaOferta('Bruno', { name: 'Zona Sul' })).toBe('Oferecido a Bruno pela Roleta Zona Sul');
  });

  it('sem corretor na resposta, diz só pra qual roleta foi', () => {
    expect(textoDaOferta(null, { name: 'Zona Sul' })).toBe('Mandado pra Roleta Zona Sul');
  });
});
