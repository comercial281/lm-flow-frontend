import { useState } from 'react';
import LeadDestinationFields, { type LeadDestinationValue } from './LeadDestinationFields';
import type { LeadDestinationOptions } from './useLeadDestinationOptions';

interface Props {
  sale: LeadDestinationValue;
  rent: LeadDestinationValue;
  rentSameAsSale: boolean;
  onSale: (patch: Partial<LeadDestinationValue>) => void;
  onRent: (patch: Partial<LeadDestinationValue>) => void;
  onRentSameAsSale: (value: boolean) => void;
  options: LeadDestinationOptions;
  /** false = servidor antigo, sem locação: só o destino único de sempre. */
  showRent: boolean;
  showLabel?: boolean;
}

type Aba = 'venda' | 'locacao';

/**
 * Destino do lead de VENDA e de LOCAÇÃO (spec 2026-09-30, D4–D6), no portal e
 * no site. Locação começa em "Mesmo destino da venda": ninguém que não mexer
 * aqui vê o lead mudar de lugar. Desligado, a locação vale só com o que está
 * nela — roleta vazia não herda a da venda.
 */
export default function SaleRentDestination({
  sale, rent, rentSameAsSale, onSale, onRent, onRentSameAsSale, options, showRent, showLabel = false,
}: Props) {
  const [aba, setAba] = useState<Aba>('venda');

  if (!showRent) {
    return <LeadDestinationFields value={sale} onChange={onSale} options={options} showLabel={showLabel} />;
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Finalidade do lead" className="flex gap-1.5">
        {([['venda', 'Venda'], ['locacao', 'Locação']] as const).map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            role="tab"
            aria-selected={aba === chave}
            onClick={() => setAba(chave)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              aba === chave ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'venda' ? (
        <LeadDestinationFields key="venda" value={sale} onChange={onSale} options={options} showLabel={showLabel} />
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={rentSameAsSale}
              onChange={e => onRentSameAsSale(e.target.checked)}
            />
            Mesmo destino da venda
          </label>
          {rentSameAsSale ? (
            <p className="text-xs text-muted-foreground">
              O lead de imóvel para alugar vai para o mesmo funil, roleta e responsável da venda.
            </p>
          ) : (
            <LeadDestinationFields key="locacao" value={rent} onChange={onRent} options={options} showLabel={showLabel} />
          )}
        </div>
      )}
    </div>
  );
}
