import { Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { FASES } from '@/features/properties/listingKind';
import CampoMesAno from '../../lista/CampoMesAno';
import { CampoNumero } from './campos';
import { CLASSE_SELETOR, type PropsDaSecao } from './tipos';

export default function SecaoObra({ form: f, setF }: PropsDaSecao) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <UILabel>Fase da obra</UILabel>
        <Seletor value={f.stage} onChange={e => setF({ stage: e.target.value })} className={CLASSE_SELETOR}>
          {FASES.map(x => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}
        </Seletor>
      </div>
      {f.stage !== 'ready' && (
        <div>
          <UILabel>Previsão de entrega</UILabel>
          <CampoMesAno rotulo="previsão de entrega" valor={f.delivery_forecast ?? ''}
            aoMudar={v => setF({ delivery_forecast: v })} />
        </div>
      )}
      <CampoNumero rotulo="Total de unidades" valor={f.total_units} aoMudar={v => setF({ total_units: v })} />
      <CampoNumero rotulo="Torres" valor={f.towers} aoMudar={v => setF({ towers: v })} />
      <CampoNumero rotulo="Andares" valor={f.floors} aoMudar={v => setF({ floors: v })} />
    </div>
  );
}
