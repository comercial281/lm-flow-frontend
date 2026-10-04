import { Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Input, Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { HOME_FABRICA, type AtalhoManual, type HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { ROTULO_TIPO, opcoesDeTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import type { FormProps } from './tipos';

const MAX_ATALHOS = 8;
const OPCOES_TIPO = opcoesDeTipo(Object.keys(ROTULO_TIPO));
const ATALHO_NOVO: AtalhoManual = { label: '', transaction: 'sale', property_type: null, city: null, neighborhood: null, price_max: null };

export default function TelaMaisBuscados({ siteForm, setF }: FormProps) {
  const home: HomeConfig = siteForm.home ?? HOME_FABRICA;
  const ms = home.most_searched;
  // Sempre o objeto `home` inteiro: o servidor troca cada bloco recebido por completo.
  const mudar = (parte: Partial<HomeConfig['most_searched']>) => setF({ home: { ...home, most_searched: { ...ms, ...parte } } });
  const mudarItem = (i: number, parte: Partial<AtalhoManual>) =>
    mudar({ items: ms.items.map((it, k) => (k === i ? { ...it, ...parte } : it)) });
  const texto = (v: string) => v.trim() === '' ? null : v;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Checkbox id="buscados-ativo" checked={ms.enabled} onCheckedChange={v => mudar({ enabled: v === true })} />
        <UILabel htmlFor="buscados-ativo" className="cursor-pointer">Mostrar mais buscados na página inicial</UILabel>
      </div>

      {ms.enabled && (
        <>
          <div role="group" aria-label="Como montar os atalhos" className="flex flex-wrap gap-2">
            <Button type="button" variant={ms.mode === 'auto' ? 'default' : 'outline'} aria-pressed={ms.mode === 'auto'}
              onClick={() => mudar({ mode: 'auto' })}>Automático</Button>
            <Button type="button" variant={ms.mode === 'manual' ? 'default' : 'outline'} aria-pressed={ms.mode === 'manual'}
              onClick={() => mudar({ mode: 'manual' })}>Escolher eu mesmo</Button>
          </div>

          {ms.mode === 'auto' ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Montados pelos seus imóveis: os tipos e bairros com mais opções.</p>
              <p>Atualiza sozinho quando você cadastra ou vende imóveis.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ms.items.map((it, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <UILabel htmlFor={`atalho-${i}-rotulo`}>Rótulo</UILabel>
                      <Input id={`atalho-${i}-rotulo`} className="mt-1" value={it.label}
                        onChange={e => mudarItem(i, { label: e.target.value })} />
                    </div>
                    <div>
                      <UILabel htmlFor={`atalho-${i}-finalidade`}>Finalidade</UILabel>
                      <Seletor id={`atalho-${i}-finalidade`} className="mt-1 w-full" value={it.transaction ?? ''}
                        onChange={e => mudarItem(i, { transaction: e.target.value === 'rent' ? 'rent' : e.target.value === 'sale' ? 'sale' : null })}>
                        <option value="">Qualquer</option>
                        <option value="sale">Comprar</option>
                        <option value="rent">Alugar</option>
                      </Seletor>
                    </div>
                    <div>
                      <UILabel htmlFor={`atalho-${i}-tipo`}>Tipo</UILabel>
                      <Seletor id={`atalho-${i}-tipo`} className="mt-1 w-full" value={it.property_type ?? ''}
                        onChange={e => mudarItem(i, { property_type: e.target.value || null })}>
                        <option value="">Qualquer tipo</option>
                        {OPCOES_TIPO.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                      </Seletor>
                    </div>
                    <div>
                      <UILabel htmlFor={`atalho-${i}-cidade`}>Cidade</UILabel>
                      <Input id={`atalho-${i}-cidade`} className="mt-1" value={it.city ?? ''}
                        onChange={e => mudarItem(i, { city: texto(e.target.value) })} />
                    </div>
                    <div>
                      <UILabel htmlFor={`atalho-${i}-bairro`}>Bairro</UILabel>
                      <Input id={`atalho-${i}-bairro`} className="mt-1" value={it.neighborhood ?? ''}
                        onChange={e => mudarItem(i, { neighborhood: texto(e.target.value) })} />
                    </div>
                    <div>
                      <UILabel htmlFor={`atalho-${i}-preco`}>Preço até</UILabel>
                      <Input id={`atalho-${i}-preco`} className="mt-1" type="number" min={0} inputMode="numeric"
                        value={it.price_max ?? ''}
                        onChange={e => mudarItem(i, { price_max: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => mudar({ items: ms.items.filter((_, k) => k !== i) })}>
                    <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Remover
                  </Button>
                </div>
              ))}
              {ms.items.length < MAX_ATALHOS && (
                <Button type="button" variant="outline" onClick={() => mudar({ items: [...ms.items, { ...ATALHO_NOVO }] })}>
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Adicionar atalho
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
