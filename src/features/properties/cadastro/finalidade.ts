// Finalidade do imóvel em duas marcas: "À venda" e "Para alugar" (Tarefa 78, 01/11/2026).
// Grava `transaction_type` como sempre (sale, rent, sale_rent). Temporada saiu da tela mas
// continua no banco: um imóvel `season` abre com "Para alugar" marcado e segue `season`
// enquanto só essa marca ficar ligada.

export interface MarcasDaFinalidade { venda: boolean; aluguel: boolean }

export const AVISO_SEM_FINALIDADE = 'Marque À venda, Para alugar ou os dois.';

export function marcasDaFinalidade(t: string | null | undefined): MarcasDaFinalidade {
  return {
    venda: t === 'sale' || t === 'sale_rent',
    aluguel: t === 'rent' || t === 'sale_rent' || t === 'season',
  };
}

/** As marcas de volta no valor do servidor; nenhuma marcada = nulo. */
export function finalidadeDasMarcas(marcas: MarcasDaFinalidade, atual?: string | null): 'sale' | 'rent' | 'sale_rent' | 'season' | null {
  if (marcas.venda && marcas.aluguel) return 'sale_rent';
  if (marcas.venda) return 'sale';
  if (marcas.aluguel) return atual === 'season' ? 'season' : 'rent';
  return null;
}
