import { Input, Label as UILabel } from '@/components/ui/ds';
import { numeroOuNulo, type PropsDaSecao } from './tipos';

const CAMPOS = [
  { label: 'Quartos', key: 'bedrooms' as const },
  { label: 'Banheiros', key: 'bathrooms' as const },
  { label: 'Suítes', key: 'suites' as const },
  { label: 'Vagas', key: 'parking_spaces' as const },
  { label: 'Área útil (m²)', key: 'useful_area_m2' as const },
  { label: 'Área total (m²)', key: 'total_area_m2' as const },
];

// Quartos, suítes, banheiros, vagas e áreas. A revenda usa na seção Composição;
// o empreendimento, como resumo, em Tipologias e valores.
export function GradeDeComposicao({ form: f, setF }: Pick<PropsDaSecao, 'form' | 'setF'>) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {CAMPOS.map(({ label, key }) => (
        <div key={key}>
          <UILabel>{label}</UILabel>
          <Input type="number" value={f[key] ?? ''} onChange={e => setF({ [key]: numeroOuNulo(e.target.value) })}
            min={0} className="mt-1" />
        </div>
      ))}
    </div>
  );
}

export default function SecaoComposicao({ form, setF }: PropsDaSecao) {
  return <div className="mt-4"><GradeDeComposicao form={form} setF={setF} /></div>;
}
