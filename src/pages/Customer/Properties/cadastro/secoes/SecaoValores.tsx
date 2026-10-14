import { Input, Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { OCUPACOES, descontoDaAvaliacao, textoDoDesconto, type Ocupacao } from '@/features/properties/listingKind';
import { dicaSe, useCampoTravado } from '@/features/properties/cadastro/travasDoSite';
import { Pilulas } from './campos';
import { numeroOuNulo, type PropsDaSecao } from './tipos';

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
          <Input id="campo-valor-venda" type="number" disabled={trava.venda} value={f.sale_price ?? ''} onChange={e => setF({ sale_price: numeroOuNulo(e.target.value) })}
            placeholder="450000" className="mt-1" />
        </div>
      )}
      {leilao && (
        <>
          <div title={dicaSe(trava.avaliacao)}>
            <UILabel htmlFor="campo-valor-avaliacao">Valor de avaliação (R$)</UILabel>
            <Input id="campo-valor-avaliacao" type="number" disabled={trava.avaliacao} value={f.appraisal_value ?? ''}
              onChange={e => setF({ appraisal_value: numeroOuNulo(e.target.value) })} className="mt-1" />
          </div>
          {desconto && <p data-testid="desconto-leilao" className="text-sm font-medium text-emerald-700 dark:text-emerald-300 sm:col-span-2">{desconto}</p>}
          <Pilulas rotulo="Ocupação" valor={f.occupancy ?? ''} opcoes={OCUPACOES.map(o => ({ valor: o.valor, rotulo: o.rotulo }))} desabilitado={trava.ocupacao}
            aoMudar={v => setF({ occupancy: v as Ocupacao })} />
        </>
      )}
      {aluguel && (
        <div title={dicaSe(trava.aluguel)}>
          <UILabel htmlFor="campo-valor-aluguel">Valor de aluguel (R$)</UILabel>
          <Input id="campo-valor-aluguel" type="number" disabled={trava.aluguel} value={f.rent_price ?? ''} onChange={e => setF({ rent_price: numeroOuNulo(e.target.value) })}
            placeholder="2500" className="mt-1" />
        </div>
      )}
      <div title={dicaSe(trava.condominio)}>
        <UILabel htmlFor="campo-condominio">Condomínio (R$/mês)</UILabel>
        <Input id="campo-condominio" type="number" disabled={trava.condominio} value={f.condo_fee ?? ''} onChange={e => setF({ condo_fee: numeroOuNulo(e.target.value) })}
          placeholder="800" className="mt-1" />
      </div>
      <div title={dicaSe(trava.iptu || trava.periodoIptu)}>
        <UILabel htmlFor="campo-iptu">IPTU (R$)</UILabel>
        <div className="mt-1 flex gap-2">
          <Input id="campo-iptu" type="number" disabled={trava.iptu} value={f.iptu ?? ''} onChange={e => setF({ iptu: numeroOuNulo(e.target.value) })}
            placeholder="1200" />
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
