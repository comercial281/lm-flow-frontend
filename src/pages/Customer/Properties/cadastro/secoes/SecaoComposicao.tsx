import { useEffect, useState } from 'react';
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

const ANO_MINIMO = 1800;
const ANO_MAXIMO = new Date().getFullYear() + 5;

// Revenda: a grade mais o ano de construção (só grava ano válido).
export default function SecaoComposicao({ form, setF }: PropsDaSecao) {
  const [texto, setTexto] = useState(form.construction_year != null ? String(form.construction_year) : '');
  const [erro, setErro] = useState('');

  // Imóvel carregado depois da primeira tela: acompanha o valor salvo.
  useEffect(() => {
    const salvo = form.construction_year;
    if (salvo != null) setTexto(atual => (Number(atual) === salvo ? atual : String(salvo)));
  }, [form.construction_year]);

  const mudarAno = (v: string) => {
    setTexto(v);
    if (!v) { setErro(''); setF({ construction_year: null }); return; }
    const ano = Number(v);
    if (/^\d{4}$/.test(v) && ano >= ANO_MINIMO && ano <= ANO_MAXIMO) {
      setErro('');
      setF({ construction_year: ano });
    } else {
      setErro(`Informe um ano entre ${ANO_MINIMO} e ${ANO_MAXIMO}.`);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <GradeDeComposicao form={form} setF={setF} />
      <div className="max-w-xs">
        <UILabel htmlFor="campo-ano-construcao">Ano de construção</UILabel>
        <Input id="campo-ano-construcao" inputMode="numeric" value={texto} placeholder="2015"
          aria-invalid={erro ? true : undefined} aria-describedby={erro ? 'erro-ano-construcao' : undefined}
          onChange={e => mudarAno(e.target.value.replace(/\D/g, '').slice(0, 4))} className="mt-1" />
        {erro && <p id="erro-ano-construcao" role="alert" className="mt-1 text-xs text-destructive">{erro}</p>}
      </div>
    </div>
  );
}
