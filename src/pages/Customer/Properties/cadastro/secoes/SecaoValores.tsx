import { Input, Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { OCUPACOES, descontoDaAvaliacao, textoDoDesconto, type Ocupacao } from '@/features/properties/listingKind';
import { Pilulas } from './campos';
import { numeroOuNulo, type PropsDaSecao } from './tipos';

// Revenda. O preço que aparece segue a finalidade (o backend exige o do tipo de negócio).
export default function SecaoValores({ form: f, setF }: PropsDaSecao) {
  const leilao = f.listing_kind === 'auction';
  const venda = leilao || f.transaction_type === 'sale' || f.transaction_type === 'sale_rent';
  const aluguel = f.transaction_type === 'rent' || f.transaction_type === 'sale_rent' || f.transaction_type === 'season';
  const desconto = leilao ? textoDoDesconto(descontoDaAvaliacao(f.sale_price, f.appraisal_value)) : null;
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {venda && (
        <div>
          <UILabel htmlFor="campo-valor-venda">Valor de venda</UILabel><span aria-hidden="true" className="text-sm">{leilao ? ' (R$)' : ' (R$) *'}</span>
          <Input id="campo-valor-venda" type="number" value={f.sale_price ?? ''} onChange={e => setF({ sale_price: numeroOuNulo(e.target.value) })}
            placeholder="450000" className="mt-1" />
        </div>
      )}
      {leilao && (
        <>
          <div>
            <UILabel htmlFor="campo-valor-avaliacao">Valor de avaliação (R$)</UILabel>
            <Input id="campo-valor-avaliacao" type="number" value={f.appraisal_value ?? ''}
              onChange={e => setF({ appraisal_value: numeroOuNulo(e.target.value) })} className="mt-1" />
          </div>
          {desconto && <p data-testid="desconto-leilao" className="text-sm font-medium text-emerald-700 dark:text-emerald-300 sm:col-span-2">{desconto}</p>}
          <Pilulas rotulo="Ocupação" valor={f.occupancy ?? ''} opcoes={OCUPACOES.map(o => ({ valor: o.valor, rotulo: o.rotulo }))}
            aoMudar={v => setF({ occupancy: v as Ocupacao })} />
        </>
      )}
      {aluguel && (
        <div>
          <UILabel>Valor de aluguel (R$)</UILabel>
          <Input type="number" value={f.rent_price ?? ''} onChange={e => setF({ rent_price: numeroOuNulo(e.target.value) })}
            placeholder="2500" className="mt-1" />
        </div>
      )}
      <div>
        <UILabel>Condomínio (R$/mês)</UILabel>
        <Input type="number" value={f.condo_fee ?? ''} onChange={e => setF({ condo_fee: numeroOuNulo(e.target.value) })}
          placeholder="800" className="mt-1" />
      </div>
      <div>
        <UILabel htmlFor="campo-iptu">IPTU (R$)</UILabel>
        <div className="mt-1 flex gap-2">
          <Input id="campo-iptu" type="number" value={f.iptu ?? ''} onChange={e => setF({ iptu: numeroOuNulo(e.target.value) })}
            placeholder="1200" />
          <Seletor aria-label="Período do IPTU" value={f.iptu_period ?? ''} className="w-32 shrink-0"
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
