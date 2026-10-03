import { Input, Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { TRANSACTION_TYPE_LABELS, PROPERTY_TYPE_LABELS } from '@/services/properties/propertiesService';
import { SITUACOES, rotuloDaSituacao } from '@/features/properties/listingKind';
import { CLASSE_SELETOR, type PropsDaSecao } from './tipos';

export default function SecaoBasico({ form: f, setF }: PropsDaSecao) {
  const kind = f.listing_kind ?? 'resale';
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <UILabel htmlFor="campo-titulo">Título</UILabel><span aria-hidden="true" className="text-sm"> *</span>
        <Input
          id="campo-titulo"
          value={f.title}
          onChange={e => setF({ title: e.target.value })}
          placeholder="Ex: Apartamento 3 quartos - Jardim Europa"
          className="mt-1"
        />
      </div>

      {/* Empreendimento é sempre venda: o tipo de negócio só aparece na revenda. */}
      {kind !== 'development' && (
        <div>
          <UILabel>Tipo de negócio</UILabel>
          <Seletor value={f.transaction_type} onChange={e => setF({ transaction_type: e.target.value })} className={CLASSE_SELETOR}>
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Seletor>
        </div>
      )}

      <div>
        <UILabel>Tipo de imóvel</UILabel>
        <Seletor value={f.property_type} onChange={e => setF({ property_type: e.target.value })} className={CLASSE_SELETOR}>
          {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Seletor>
      </div>

      <div>
        <UILabel>Situação</UILabel>
        <Seletor value={f.status} onChange={e => setF({ status: e.target.value })} className={CLASSE_SELETOR}>
          {SITUACOES[kind].map(s => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
          {!SITUACOES[kind].some(s => s.valor === f.status) && (
            <option value={f.status}>{rotuloDaSituacao('resale', f.status)}</option>
          )}
        </Seletor>
      </div>
    </div>
  );
}
