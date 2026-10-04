import { Checkbox, Label as UILabel } from '@/components/ui/ds';
import { Secao, Secoes } from '../ui/Secao';
import type { FormProps } from './tipos';

const IDIOMAS = [
  { id: 'en', rotulo: 'Inglês' },
  { id: 'es', rotulo: 'Espanhol' },
  { id: 'fr', rotulo: 'Francês' },
  { id: 'it', rotulo: 'Italiano' },
  { id: 'de', rotulo: 'Alemão' },
];

export default function TelaTraducao({ siteForm, setF }: FormProps) {
  const tr = siteForm.translate ?? { enabled: false, languages: [] };

  const alternar = (id: string, marcado: boolean) => {
    const languages = marcado ? [...tr.languages, id] : tr.languages.filter(l => l !== id);
    setF({ translate: { ...tr, languages: IDIOMAS.map(i => i.id).filter(i => languages.includes(i)) } });
  };

  return (
    <Secoes>
      <Secao
        titulo="Botão de idiomas"
        descricao="Um botão no topo do site para o visitante ver as páginas em outro idioma. A tradução é automática, feita pelo Google."
      >
        <div className="flex items-center gap-3">
          <Checkbox id="traducao-ativa" checked={tr.enabled}
            onCheckedChange={v => setF({ translate: { ...tr, enabled: v === true } })} />
          <UILabel htmlFor="traducao-ativa" className="cursor-pointer text-base font-normal">Mostrar botão de idiomas no site</UILabel>
        </div>
        <fieldset className="space-y-3 pl-7" disabled={!tr.enabled}>
          <legend className="mb-3 text-sm font-medium">Idiomas que aparecem no botão</legend>
          {IDIOMAS.map(i => (
            <div key={i.id} className="flex items-center gap-3">
              <Checkbox id={`idioma-${i.id}`} disabled={!tr.enabled} checked={tr.languages.includes(i.id)}
                onCheckedChange={v => alternar(i.id, v === true)} />
              <UILabel htmlFor={`idioma-${i.id}`} className="cursor-pointer text-base font-normal">{i.rotulo}</UILabel>
            </div>
          ))}
        </fieldset>
      </Secao>
    </Secoes>
  );
}
