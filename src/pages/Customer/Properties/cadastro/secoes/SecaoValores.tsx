import { Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { OCUPACOES, descontoDaAvaliacao, textoDoDesconto, type Ocupacao } from '@/features/properties/listingKind';
import { dicaSe, useCampoTravado } from '@/features/properties/cadastro/travasDoSite';
import { CampoDeDinheiro, Pilulas } from './campos';
import { type PropsDaSecao } from './tipos';

// Revenda. O preço que aparece segue a finalidade (o backend exige o do tipo de negócio).
export default function SecaoValores({ form: f, setF }: PropsDaSecao) {
  const leilao = f.listing_kind === 'auction';
  const venda = leilao || f.transaction_type === 'sale' || f.transaction_type === 'sale_rent';
  const aluguel = f.transaction_type === 'rent' || f.transaction_type === 'sale_rent' || f.transaction_type === 'season';
  const desconto = leilao ? textoDoDesconto(descontoDaAvaliacao(f.sale_price, f.appraisal_value)) : null;
  // Imóvel do site: só trava o que o site manda.
  const trava = {
    venda: useCampoTravado('sale_price'),
    avaliacao: useCampoTravado('appraisal_value'),
    ocupacao: useCampoTravado('occupancy'),
    aluguel: useCampoTravado('rent_price'),
    condominio: useCampoTravado('condo_fee'),
    iptu: useCampoTravado('iptu'),
    periodoIptu: useCampoTravado('iptu_period'),
  };
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {venda && (
        <div title={dicaSe(trava.venda)}>
          <UILabel htmlFor="campo-valor-venda">Valor de venda</UILabel><span aria-hidden="true" className="text-sm">{leilao ? ' (R$)' : ' (R$) *'}</span>
          <CampoDeDinheiro id="campo-valor-venda" disabled={trava.venda} valor={f.sale_price} aoMudar={v => setF({ sale_price: v })}
            placeholder="450.000" className="mt-1" />
        </div>
      )}
      {leilao && (
        <>
          <div title={dicaSe(trava.avaliacao)}>
            <UILabel htmlFor="campo-valor-avaliacao">Valor de avaliação (R$)</UILabel>
            <CampoDeDinheiro id="campo-valor-avaliacao" disabled={trava.avaliacao} valor={f.appraisal_value}
              aoMudar={v => setF({ appraisal_value: v })} className="mt-1" />
          </div>
          {desconto && <p data-testid="desconto-leilao" className="text-sm font-medium text-emerald-700 dark:text-emerald-300 sm:col-span-2">{desconto}</p>}
          <Pilulas rotulo="Ocupação" valor={f.occupancy ?? ''} opcoes={OCUPACOES.map(o => ({ valor: o.valor, rotulo: o.rotulo }))} desabilitado={trava.ocupacao}
            aoMudar={v => setF({ occupancy: v as Ocupacao })} />
        </>
      )}
      {aluguel && (
        <div title={dicaSe(trava.aluguel)}>
          <UILabel htmlFor="campo-valor-aluguel">Valor de aluguel (R$)</UILabel>
          <CampoDeDinheiro id="campo-valor-aluguel" disabled={trava.aluguel} valor={f.rent_price} aoMudar={v => setF({ rent_price: v })}
            placeholder="2.500" className="mt-1" />
        </div>
      )}
      <div title={dicaSe(trava.condominio)}>
        <UILabel htmlFor="campo-condominio">Condomínio (R$/mês)</UILabel>
        <CampoDeDinheiro id="campo-condominio" disabled={trava.condominio} valor={f.condo_fee} aoMudar={v => setF({ condo_fee: v })}
          placeholder="800" className="mt-1" />
      </div>
      <div title={dicaSe(trava.iptu || trava.periodoIptu)}>
        <UILabel htmlFor="campo-iptu">IPTU (R$)</UILabel>
        <div className="mt-1 flex gap-2">
          <CampoDeDinheiro id="campo-iptu" disabled={trava.iptu} valor={f.iptu} aoMudar={v => setF({ iptu: v })}
            placeholder="1.200" />
          <Seletor aria-label="Período do IPTU" value={f.iptu_period ?? ''} disabled={trava.periodoIptu} className="w-32 shrink-0"
            onChange={e => setF({ iptu_period: (e.target.value || null) as 'monthly' | 'yearly' | null })}>
            <option value="">—</option>
            <option value="monthly">Mensal</option>
            <option value="yearly">Anual</option>
          </Seletor>
        </div>
      </div>
    </div>
  );
}
