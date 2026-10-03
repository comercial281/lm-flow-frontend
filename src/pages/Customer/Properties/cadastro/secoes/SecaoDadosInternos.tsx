import type { DadosInternos } from '@/services/properties/propertiesService';
import { CampoReais, CampoTexto } from './campos';
import type { PropsDaSecao } from './tipos';

// Revenda. Só a equipe vê.
export default function SecaoDadosInternos({ form: f, setF }: PropsDaSecao) {
  const info = f.internal_info;
  const mudar = (parte: Partial<DadosInternos>) =>
    setF({ internal_info: { ...info, ...parte } });
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">Só a sua equipe vê. Nada daqui vai para site, portal ou IA.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoTexto rotulo="Onde ficam as chaves" valor={info?.keys_location} aoMudar={v => mudar({ keys_location: v })} />
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 pb-2">
            <input type="checkbox" checked={f.on_sign ?? false} onChange={e => setF({ on_sign: e.target.checked })} className="rounded" />
            <span className="text-sm">Tem placa</span>
          </label>
        </div>
        <CampoTexto rotulo="Matrícula" valor={info?.registration_number} aoMudar={v => mudar({ registration_number: v })} />
        <CampoTexto rotulo="Código do IPTU" valor={info?.iptu_code} aoMudar={v => mudar({ iptu_code: v })} />
        <CampoTexto rotulo="Cartório" valor={info?.notary} aoMudar={v => mudar({ notary: v })} />
        <CampoReais rotulo="Valor de avaliação (R$)" valor={info?.appraised_value} aoMudar={v => mudar({ appraised_value: v })} />
        <div className="sm:col-span-2">
          <CampoTexto rotulo="Comentários internos" multilinha valor={info?.notes} aoMudar={v => mudar({ notes: v })} />
        </div>
      </div>
    </div>
  );
}
