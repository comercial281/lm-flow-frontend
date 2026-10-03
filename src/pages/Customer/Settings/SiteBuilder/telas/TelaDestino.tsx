import type { Dispatch, SetStateAction } from 'react';
import SaleRentDestination from '@/components/pipelines/SaleRentDestination';
import type { LeadDestinationOptions } from '@/components/pipelines/useLeadDestinationOptions';
import type { SiteRoutingState } from '../siteLeadRouting';

interface Props {
  leadRouting: SiteRoutingState;
  setLeadRouting: Dispatch<SetStateAction<SiteRoutingState>>;
  routingOptions: LeadDestinationOptions;
  marcarAlterado: () => void;
}

export default function TelaDestino({ leadRouting, setLeadRouting, routingOptions, marcarAlterado }: Props) {
  return (
    <>
      {/* Destino do lead: para onde vão os leads dos formulários do site e
          quem atende, separado por Venda e Locação (spec 2026-09-30). Sem
          funil = funil padrão; sem roleta = entra sem responsável, como todo
          site funcionou até aqui. A etiqueta do imóvel é aplicada por cima. */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold mb-1">Destino do lead</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Para onde vai o lead dos formulários do site. O imóvel decide se ele é de Venda ou de
          Locação; no formulário da home e no imóvel de Venda + Locação, quem preenche escolhe.
          Funil em branco usa o funil padrão; roleta em branco deixa o lead sem responsável.
        </p>
        <SaleRentDestination
          sale={leadRouting.sale}
          rent={leadRouting.rent}
          rentSameAsSale={leadRouting.rentSameAsSale}
          onSale={patch => { setLeadRouting(prev => ({ ...prev, sale: { ...prev.sale, ...patch } })); marcarAlterado(); }}
          onRent={patch => { setLeadRouting(prev => ({ ...prev, rent: { ...prev.rent, ...patch } })); marcarAlterado(); }}
          onRentSameAsSale={v => { setLeadRouting(prev => ({ ...prev, rentSameAsSale: v })); marcarAlterado(); }}
          options={routingOptions}
          showRent={leadRouting.supported}
          showLabel
        />
      </section>
    </>
  );
}
