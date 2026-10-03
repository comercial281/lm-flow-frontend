import { Input, Label as UILabel } from '@/components/ui/ds';
import { numeroOuNulo, type PropsDaSecao } from './tipos';

// Revenda. O preço que aparece segue a finalidade (o backend exige o do tipo de negócio).
export default function SecaoValores({ form: f, setF }: PropsDaSecao) {
  const venda = f.transaction_type === 'sale' || f.transaction_type === 'sale_rent';
  const aluguel = f.transaction_type === 'rent' || f.transaction_type === 'sale_rent' || f.transaction_type === 'season';
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {venda && (
        <div>
          <UILabel htmlFor="campo-valor-venda">Valor de venda</UILabel><span aria-hidden="true" className="text-sm"> (R$) *</span>
          <Input id="campo-valor-venda" type="number" value={f.sale_price ?? ''} onChange={e => setF({ sale_price: numeroOuNulo(e.target.value) })}
            placeholder="450000" className="mt-1" />
        </div>
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
        <UILabel>IPTU (R$/ano)</UILabel>
        <Input type="number" value={f.iptu ?? ''} onChange={e => setF({ iptu: numeroOuNulo(e.target.value) })}
          placeholder="1200" className="mt-1" />
      </div>
    </div>
  );
}
