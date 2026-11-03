import { describe, expect, it } from 'vitest';
import { finalidadeDasMarcas, marcasDaFinalidade } from './finalidade';

describe('finalidade em duas marcas', () => {
  it('ida e volta de venda, aluguel e os dois', () => {
    for (const t of ['sale', 'rent', 'sale_rent'] as const) {
      expect(finalidadeDasMarcas(marcasDaFinalidade(t), t)).toBe(t);
    }
  });
  it('temporada abre com Para alugar e continua temporada enquanto só essa marca ficar', () => {
    expect(marcasDaFinalidade('season')).toEqual({ venda: false, aluguel: true });
    expect(finalidadeDasMarcas({ venda: false, aluguel: true }, 'season')).toBe('season');
    expect(finalidadeDasMarcas({ venda: true, aluguel: true }, 'season')).toBe('sale_rent');
    expect(finalidadeDasMarcas({ venda: false, aluguel: true }, 'sale')).toBe('rent');
  });
  it('nenhuma marcada dá nulo', () => {
    expect(finalidadeDasMarcas({ venda: false, aluguel: false }, 'sale')).toBeNull();
    expect(marcasDaFinalidade(null)).toEqual({ venda: false, aluguel: false });
  });
});
