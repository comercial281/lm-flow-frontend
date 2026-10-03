import EmBreve from './EmBreve';
import type { PropsDaSecao } from './tipos';

// Revenda. Nesta versão só o "Tem placa" que já existia; o resto chega em B4.
export default function SecaoDadosInternos({ form: f, setF }: PropsDaSecao) {
  return (
    <>
      <label className="mt-4 flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={f.on_sign ?? false} onChange={e => setF({ on_sign: e.target.checked })} className="rounded" />
        <span className="text-sm">Tem placa</span>
      </label>
      <EmBreve />
    </>
  );
}
