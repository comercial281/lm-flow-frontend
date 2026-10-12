import type { ReactNode } from 'react';
import { Secao } from '@/components/base/Secao';
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
  /** Títulos das seções: `unico` sem locação; `venda` e `locacao` com. */
  titulos: { unico: string; venda: string; locacao: string };
  /** Frase de cada seção (a do `unico` também vale pra `venda` quando ela não vem). */
  descricoes?: { unico?: ReactNode; venda?: ReactNode; locacao?: ReactNode };
}

/**
 * Destino do lead de VENDA e de LOCAÇÃO (spec 2026-09-30, D4–D6), no portal e
 * no site. Locação começa em "Mesmo destino da venda": ninguém que não mexer
 * aqui vê o lead mudar de lugar. Desligado, a locação vale só com o que está
 * nela — roleta vazia não herda a da venda.
 *
 * Desde 12/10/2026 são DUAS SEÇÕES (`Secao`), uma embaixo da outra, e não as
 * abas em pílula roxa de antes: pílula não é aba da casa, e as duas telas que
 * usam o bloco (Portal → Configurar, Meu site → Destino) já moram dentro de
 * abas ou de um menu de telas — aba dentro de aba é proibido. Quem chama põe
 * dentro de `Secoes`.
 */
export default function SaleRentDestination({
  sale, rent, rentSameAsSale, onSale, onRent, onRentSameAsSale, options, showRent, showLabel = false,
  titulos, descricoes = {},
}: Props) {
  if (!showRent) {
    return (
      <Secao titulo={titulos.unico} descricao={descricoes.unico}>
        <LeadDestinationFields value={sale} onChange={onSale} options={options} showLabel={showLabel} />
      </Secao>
    );
  }

  return (
    <>
      <Secao titulo={titulos.venda} descricao={descricoes.venda ?? descricoes.unico}>
        <LeadDestinationFields key="venda" value={sale} onChange={onSale} options={options} showLabel={showLabel} />
      </Secao>
      <Secao titulo={titulos.locacao} descricao={descricoes.locacao}>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={rentSameAsSale}
            onChange={e => onRentSameAsSale(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Mesmo destino da venda
        </label>
        {rentSameAsSale ? (
          <p className="text-sm text-muted-foreground">
            O lead de imóvel para alugar vai para o mesmo funil, roleta e responsável da venda.
          </p>
        ) : (
          <LeadDestinationFields key="locacao" value={rent} onChange={onRent} options={options} showLabel={showLabel} />
        )}
      </Secao>
    </>
  );
}
