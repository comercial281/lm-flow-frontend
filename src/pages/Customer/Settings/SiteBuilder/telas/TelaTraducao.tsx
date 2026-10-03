import { Checkbox, Label as UILabel } from '@/components/ui/ds';
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
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Checkbox id="traducao-ativa" checked={tr.enabled}
          onCheckedChange={v => setF({ translate: { ...tr, enabled: v === true } })} />
        <UILabel htmlFor="traducao-ativa" className="cursor-pointer">Mostrar botão de idiomas no site</UILabel>
      </div>
      <div className="space-y-2 pl-7">
        {IDIOMAS.map(i => (
          <div key={i.id} className="flex items-center gap-3">
            <Checkbox id={`idioma-${i.id}`} disabled={!tr.enabled} checked={tr.languages.includes(i.id)}
              onCheckedChange={v => alternar(i.id, v === true)} />
            <UILabel htmlFor={`idioma-${i.id}`} className="cursor-pointer">{i.rotulo}</UILabel>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">A tradução é automática, feita pelo Google.</p>
    </section>
  );
}
