import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Label as UILabel } from '@/components/ui/ds';
import { EMPTY_TYPOLOGY, typologyName, type PropertyTypology } from '@/features/properties/typologies';
import { numeroOuNulo, type PropsDaSecao } from './tipos';

// Empreendimento. As várias plantas do mesmo empreendimento e, abaixo da
// tabela, os valores soltos (venda, condomínio, IPTU), que seguem valendo como
// o RESUMO que alimenta busca, filtro e card — normalmente o da planta de entrada.
export default function SecaoTipologias({ form: f, setF }: PropsDaSecao) {
  const lista = f.typologies ?? [];
  const addTypology = () => setF({ typologies: [...lista, { ...EMPTY_TYPOLOGY }] });
  const removeTypology = (index: number) => setF({ typologies: lista.filter((_, i) => i !== index) });
  const setTypology = (index: number, patch: Partial<PropertyTypology>) =>
    setF({ typologies: lista.map((t, i) => (i === index ? { ...t, ...patch } : t)) });

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="block text-sm font-medium">Tipologias do empreendimento</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tem mais de uma planta (2 dorms, 3 dorms, cobertura…)? Cadastre cada uma aqui.
              Deixe vazio quando o imóvel é uma unidade só.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addTypology} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            Adicionar tipologia
          </Button>
        </div>

        {lista.length > 0 && (
          <div className="mt-3 space-y-3">
            {lista.map((t, i) => (
              <div key={i} className="rounded-md border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {typologyName(t, i)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Remover tipologia"
                    aria-label={`Remover ${typologyName(t, i)}`}
                    onClick={() => removeTypology(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="col-span-2 sm:col-span-3 lg:col-span-2">
                    <UILabel className="text-xs text-muted-foreground">Nome da planta</UILabel>
                    <Input
                      value={t.name ?? ''}
                      onChange={e => setTypology(i, { name: e.target.value })}
                      placeholder="Tipo A / Final 3"
                      className="mt-1"
                    />
                  </div>
                  {([
                    ['bedrooms', 'Dorms'],
                    ['suites', 'Suítes'],
                    ['bathrooms', 'Banheiros'],
                    ['parking_spaces', 'Vagas'],
                    ['units_available', 'Unid. disp.'],
                  ] as Array<[keyof PropertyTypology, string]>).map(([key, label]) => (
                    <div key={key}>
                      <UILabel className="text-xs text-muted-foreground">{label}</UILabel>
                      <Input
                        type="number"
                        min={0}
                        value={(t[key] as number | null | undefined) ?? ''}
                        onChange={e => setTypology(i, { [key]: e.target.value ? parseInt(e.target.value, 10) : null })}
                        className="mt-1"
                      />
                    </div>
                  ))}
                  {([
                    ['useful_area_m2', 'Área útil (m²)'],
                    ['total_area_m2', 'Área total (m²)'],
                    ['sale_price', 'Valor de venda (R$)'],
                    ['rent_price', 'Aluguel (R$)'],
                  ] as Array<[keyof PropertyTypology, string]>).map(([key, label]) => (
                    <div key={key} className="col-span-1 sm:col-span-1 lg:col-span-1">
                      <UILabel className="text-xs text-muted-foreground">{label}</UILabel>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={(t[key] as number | null | undefined) ?? ''}
                        onChange={e => setTypology(i, { [key]: numeroOuNulo(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                  ))}
                  <div className="col-span-2 sm:col-span-3 lg:col-span-6">
                    <UILabel className="text-xs text-muted-foreground">Observação (opcional)</UILabel>
                    <Input
                      value={t.notes ?? ''}
                      onChange={e => setTypology(i, { notes: e.target.value })}
                      placeholder="Ex.: última unidade, vista para o parque…"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <UILabel htmlFor="campo-valor-venda">Valor de venda</UILabel><span aria-hidden="true" className="text-sm"> (R$) *</span>
          <Input id="campo-valor-venda" type="number" value={f.sale_price ?? ''} onChange={e => setF({ sale_price: numeroOuNulo(e.target.value) })}
            placeholder="450000" className="mt-1" />
        </div>
        <div>
          <UILabel>Condomínio (R$/mês)</UILabel>
          <Input type="number" value={f.condo_fee ?? ''} onChange={e => setF({ condo_fee: numeroOuNulo(e.target.value) })}
            placeholder="800" className="mt-1" />
        </div>
        <div>
          <UILabel>IPTU (R$/ano)</UILabel>
          <Input type="number" value={f.iptu ?? ''} onChange={e => setF({ iptu: numeroOuNulo(e.target.value) })}
            placeholder="1200" className="mt-1" />
        </div>
      </div>
    </div>
  );
}
