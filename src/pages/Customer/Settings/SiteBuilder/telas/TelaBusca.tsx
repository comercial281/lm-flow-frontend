import { Checkbox, Input, Label as UILabel } from '@/components/ui/ds';
import {
  CAMPOS_BUSCA, HOME_FABRICA, TITULO_CAPA_FABRICA, type AbaId, type CampoBusca, type HomeConfig,
} from '@/features/siteBuilder/public/homeConfig';
import type { FormProps } from './tipos';

const ABAS: { id: AbaId; rotulo: string }[] = [
  { id: 'sale', rotulo: 'Comprar' },
  { id: 'rent', rotulo: 'Alugar' },
  { id: 'launch', rotulo: 'Lançamentos' },
];

const ROTULO_CAMPO: Record<CampoBusca, string> = {
  type: 'Tipo', city: 'Cidade', neighborhood: 'Bairro', price: 'Faixa de preço', bedrooms: 'Dormitórios',
  suites: 'Suítes', parking: 'Vagas', stage: 'Fase da obra', code: 'Código',
};

export default function TelaBusca({ siteForm, setF }: FormProps) {
  const home: HomeConfig = siteForm.home ?? HOME_FABRICA;
  const { search } = home;
  // Sempre o objeto `home` inteiro: o servidor troca cada bloco recebido por completo.
  const mudar = (parte: Partial<HomeConfig['search']>) => setF({ home: { ...home, search: { ...search, ...parte } } });

  const alternarCampo = (campo: CampoBusca, marcado: boolean) =>
    mudar({ fields: CAMPOS_BUSCA.filter(c => (c === campo ? marcado : search.fields.includes(c))) });

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-base font-semibold">Capa</h2>
        <div>
          <UILabel htmlFor="busca-titulo">Título</UILabel>
          <Input id="busca-titulo" className="mt-1" value={search.title ?? ''} placeholder={TITULO_CAPA_FABRICA}
            onChange={e => mudar({ title: e.target.value || null })} />
        </div>
        <div>
          <UILabel htmlFor="busca-subtitulo">Subtítulo</UILabel>
          <Input id="busca-subtitulo" className="mt-1" value={search.subtitle ?? ''}
            placeholder="Usa a descrição de Aparecer no Google"
            onChange={e => mudar({ subtitle: e.target.value || null })} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-base font-semibold">Abas</h2>
        <div className="space-y-2">
          {ABAS.map(a => (
            <div key={a.id} className="flex items-center gap-3">
              <Checkbox id={`aba-${a.id}`} checked={search.tabs[a.id]}
                onCheckedChange={v => mudar({ tabs: { ...search.tabs, [a.id]: v === true } })} />
              <UILabel htmlFor={`aba-${a.id}`} className="cursor-pointer">{a.rotulo}</UILabel>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Aba sem imóvel some sozinha do site.</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-base font-semibold">Filtros da capa</h2>
        <div className="space-y-2">
          {CAMPOS_BUSCA.map(c => (
            <div key={c} className="flex items-center gap-3">
              <Checkbox id={`campo-${c}`} checked={search.fields.includes(c)}
                onCheckedChange={v => alternarCampo(c, v === true)} />
              <UILabel htmlFor={`campo-${c}`} className="cursor-pointer">{ROTULO_CAMPO[c]}</UILabel>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Na página de busca o visitante tem todos os filtros.</p>
      </section>
    </>
  );
}
