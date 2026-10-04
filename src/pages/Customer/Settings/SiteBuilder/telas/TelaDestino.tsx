import type { Dispatch, SetStateAction } from 'react';
import SaleRentDestination from '@/components/pipelines/SaleRentDestination';
import type { LeadDestinationOptions } from '@/components/pipelines/useLeadDestinationOptions';
import type { SiteRoutingState } from '../siteLeadRouting';
import { Secao, Secoes } from '../ui/Secao';

interface Props {
  leadRouting: SiteRoutingState;
  setLeadRouting: Dispatch<SetStateAction<SiteRoutingState>>;
  routingOptions: LeadDestinationOptions;
  marcarAlterado: () => void;
}

export default function TelaDestino({ leadRouting, setLeadRouting, routingOptions, marcarAlterado }: Props) {
  return (
    <Secoes>
      {/* Destino do lead: para onde vão os leads dos formulários do site e
          quem atende, separado por Venda e Locação (spec 2026-09-30). Sem
          funil = funil padrão; sem roleta = entra sem responsável, como todo
          site funcionou até aqui. A etiqueta do imóvel é aplicada por cima. */}
      <Secao
        titulo="Destino do contato"
        descricao={
          <>
            <p>Para onde vai quem preenche um formulário do site. O imóvel decide se é de Venda ou de Locação; no formulário da página inicial e no imóvel de Venda + Locação, quem preenche escolhe.</p>
            <p className="mt-2">Funil em branco usa o funil padrão; roleta em branco deixa o contato sem responsável.</p>
          </>
        }
      >
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
      </Secao>
    </Secoes>
  );
}
