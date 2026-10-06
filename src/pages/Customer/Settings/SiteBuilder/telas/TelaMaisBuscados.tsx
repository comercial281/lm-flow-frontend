import { Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Label as UILabel } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { HOME_FABRICA, type AtalhoManual, type HomeConfig } from '@/features/siteBuilder/public/homeConfig';
import { ROTULO_TIPO, opcoesDeTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { Secao, Secoes } from '@/components/base/Secao';
import { CLASSE_DO_CAMPO, CampoTexto } from '@/components/base/Campo';
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
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const remover = async (i: number) => {
    const ok = await confirmar({
      titulo: 'Remover atalho',
      descricao: `O atalho "${ms.items[i].label.trim() || `Atalho ${i + 1}`}" sai da página inicial quando você salvar.`,
      rotuloDaAcao: 'Remover',
      destrutivo: true,
    });
    if (ok) mudar({ items: ms.items.filter((_, k) => k !== i) });
  };

  return (
    <Secoes>
      <Secao
        titulo="Atalhos da busca"
        descricao='Botões na página inicial que levam direto pra uma busca pronta, como "Apartamentos no Centro". O visitante clica e já vê os imóveis.'
      >
      <div className="flex items-center gap-3">
        <Checkbox id="buscados-ativo" checked={ms.enabled} onCheckedChange={v => mudar({ enabled: v === true })} />
        <UILabel htmlFor="buscados-ativo" className="cursor-pointer text-base font-normal">Mostrar mais buscados na página inicial</UILabel>
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
                <div key={i} className="rounded-lg border border-border p-4 space-y-4">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <CampoTexto id={`atalho-${i}-rotulo`} rotulo="Rótulo" valor={it.label}
                      aviso={it.label.trim() === '' ? 'Sem rótulo, o atalho não é salvo.' : undefined}
                      aoMudar={v => mudarItem(i, { label: v })} />
                    <div className="space-y-2">
                      <UILabel htmlFor={`atalho-${i}-finalidade`}>Finalidade</UILabel>
                      {/* Sem "Qualquer": o atalho leva a uma aba da busca. Atalho antigo sem finalidade é Comprar. */}
                      <Seletor id={`atalho-${i}-finalidade`} className={`w-full ${CLASSE_DO_CAMPO}`} value={it.transaction ?? 'sale'}
                        onChange={e => mudarItem(i, { transaction: e.target.value === 'rent' ? 'rent' : 'sale' })}>
                        <option value="sale">Comprar</option>
                        <option value="rent">Alugar</option>
                      </Seletor>
                    </div>
                    <div className="space-y-2">
                      <UILabel htmlFor={`atalho-${i}-tipo`}>Tipo</UILabel>
                      <Seletor id={`atalho-${i}-tipo`} className={`w-full ${CLASSE_DO_CAMPO}`} value={it.property_type ?? ''}
                        onChange={e => mudarItem(i, { property_type: e.target.value || null })}>
                        <option value="">Qualquer tipo</option>
                        {OPCOES_TIPO.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                      </Seletor>
                    </div>
                    <CampoTexto id={`atalho-${i}-cidade`} rotulo="Cidade" valor={it.city ?? ''}
                      aoMudar={v => mudarItem(i, { city: texto(v) })} />
                    <CampoTexto id={`atalho-${i}-bairro`} rotulo="Bairro" valor={it.neighborhood ?? ''}
                      aoMudar={v => mudarItem(i, { neighborhood: texto(v) })} />
                    <CampoTexto id={`atalho-${i}-preco`} rotulo="Preço até" type="number" min={0} inputMode="numeric"
                      valor={String(it.price_max ?? '')}
                      aoMudar={v => mudarItem(i, { price_max: v === '' ? null : Number(v) })} />
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => remover(i)}>
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
      {dialogoDeConfirmacao}
      </Secao>
    </Secoes>
  );
}
