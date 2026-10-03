import { describe, it, expect } from 'vitest';
import { estiloDaMarca } from './watermarkPreview';

describe('estiloDaMarca', () => {
  it('centro: 40% e centralizado', () => {
    expect(estiloDaMarca('center', 60)).toMatchObject({ width: '40%', left: '50%', top: '50%', opacity: 0.6 });
  });
  it('canto inferior direito: 22% com margem de 3%', () => {
    expect(estiloDaMarca('bottom_right', 100)).toMatchObject({ width: '22%', right: '3%', bottom: '3%', opacity: 1 });
  });
  it('transparência fora da faixa é presa em 10–100', () => {
    expect(estiloDaMarca('top_left', 0).opacity).toBe(0.1);
    expect(estiloDaMarca('top_left', 500).opacity).toBe(1);
  });
});
