import { CampoTexto } from './campos';
import type { PropsDaSecao } from './tipos';

// Só a equipe vê. Não vai para site, portal nem IA.
export default function SecaoComissao({ form: f, setF }: PropsDaSecao) {
  const mudar = (parte: { percent?: string; notes?: string }) =>
    setF({ commission: { ...f.commission, ...parte } });
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <CampoTexto rotulo="Percentual" valor={f.commission?.percent} placeholder="5" aoMudar={v => mudar({ percent: v })} />
      <div className="sm:col-span-2">
        <CampoTexto rotulo="Observação" multilinha valor={f.commission?.notes} aoMudar={v => mudar({ notes: v })} />
      </div>
    </div>
  );
}
