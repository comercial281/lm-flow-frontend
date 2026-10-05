import { useEffect, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Input, Label as UILabel } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { siteBuilderService, type MenuDoPainel, type SitePage } from '@/services/siteBuilder/siteBuilderService';
import { ROTULO_MAX, ehPagina } from '@/features/siteBuilder/public/menuConfig';
import { EXTERNOS_MAX, avisosDoExterno, menuDeFabrica, nomeDeFabrica } from '@/features/siteBuilder/menuDoPainel';
import { Secao, Secoes } from '../ui/Secao';
import { CLASSE_DO_CAMPO, CampoTexto } from '../ui/Campo';
import type { FormProps } from './tipos';

type Item = MenuDoPainel['items'][number];

interface Props extends FormProps {
  /** Muda quando as páginas foram regravadas (o Salvar do menu grava o "Exibir no menu" delas). */
  versaoDasPaginas?: number;
}

export default function TelaMenus({ site, siteForm, setF, versaoDasPaginas = 0 }: Props) {
  const menu: MenuDoPainel = (siteForm.menu as MenuDoPainel | undefined) ?? menuDeFabrica();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  // As páginas, só pra dizer quais estão desativadas (o menu do admin traz todas).
  const [paginas, setPaginas] = useState<{ siteId: string; lista: SitePage[] } | null>(null);
  const siteId = site?.id;
  useEffect(() => {
    if (!siteId) return;
    let vivo = true;
    siteBuilderService.listPages(siteId)
      .then(lista => { if (vivo) setPaginas({ siteId, lista }); })
      .catch(() => { /* sem a lista, a tela só não avisa da página desativada */ });
    return () => { vivo = false; };
  }, [siteId, versaoDasPaginas]);
  const desativadas = new Set(
    (paginas && paginas.siteId === siteId ? paginas.lista : []).filter(p => !p.active).map(p => `page:${p.slug}`),
  );

  // Sempre o menu inteiro: o servidor troca cada bloco (itens, links externos) recebido.
  const gravar = (parte: Partial<MenuDoPainel>) => setF({ menu: { ...menu, ...parte } });
  const gravarItens = (items: Item[]) => gravar({ items });
  const mudarItem = (key: string, parte: Partial<Item>) => gravarItens(menu.items.map(i => (i.key === key ? { ...i, ...parte } : i)));
  const mover = (i: number, passo: -1 | 1) => {
    const nova = [...menu.items];
    [nova[i], nova[i + passo]] = [nova[i + passo], nova[i]];
    gravarItens(nova);
  };

  const externos = menu.external;
  const mudarExterno = (i: number, parte: Partial<MenuDoPainel['external'][number]>) =>
    gravar({ external: externos.map((e, j) => (j === i ? { ...e, ...parte } : e)) });
  const acrescentarExterno = () => gravar({ external: [...externos, { label: '', url: '' }] });
  const removerExterno = async (i: number) => {
    const ok = await confirmar({
      titulo: 'Remover link',
      descricao: `O link "${externos[i].label || 'sem nome'}" sai do menu quando você salvar.`,
      rotuloDaAcao: 'Remover',
      destrutivo: true,
    });
    if (ok) gravar({ external: externos.filter((_, j) => j !== i) });
  };

  // Por que um item ligado pode não aparecer no site: o destino dele está desligado.
  const tabs = siteForm.home?.search?.tabs;
  const semDestino = (item: Item): string | null => {
    switch (item.key) {
      case 'sale': case 'rent': case 'launch':
        return tabs && tabs[item.key] === false ? 'Aba escondida em Busca rápida: não aparece no site.' : null;
      case 'about':
        return siteForm.sections?.stats === false ? 'Faixa de números desligada em Aparência: não aparece no site.' : null;
      case 'contact':
        return siteForm.sections?.lead_capture === false ? 'Captura de lead desligada em Aparência: não aparece no site.' : null;
      case 'financing':
        return site?.financiamento && !site.financiamento.enabled ? 'Página de financiamento desligada: não aparece no site.' : null;
      case 'listing':
        return site?.anuncie && !site.anuncie.enabled ? 'Página Anuncie seu imóvel desligada: não aparece no site.' : null;
      default:
        return ehPagina(item.key) && desativadas.has(item.key)
          ? 'Página desativada em Páginas: não aparece no site até ser ativada.'
          : null;
    }
  };

  return (
    <Secoes>
      <Secao
        titulo="Itens do menu"
        descricao={(
          <>
            <p>A ordem e o nome de cada item no menu do topo do site, no computador e no celular. Arraste pela alça ou use as setas para mudar a ordem. Nome em branco usa o nome de sempre.</p>
            <p className="mt-2">Item sem destino some sozinho do site: aba sem imóvel, Blog sem artigo publicado, página desligada.</p>
            <p className="mt-2">Depois que você salvar esta tela, o rodapé do site passa a repetir este menu, com as páginas que estiverem nele.</p>
          </>
        )}
      >
        <Reorder.Group axis="y" values={menu.items} onReorder={gravarItens} className="space-y-3">
          {menu.items.map((item, i) => (
            <ItemDoMenu key={item.key} item={item} primeiro={i === 0} ultimo={i === menu.items.length - 1}
              aviso={item.enabled ? semDestino(item) : null}
              mudar={parte => mudarItem(item.key, parte)} mover={passo => mover(i, passo)} />
          ))}
        </Reorder.Group>
        <p className="text-sm text-muted-foreground">
          Página criada entra aqui sozinha. Desligar uma página aqui é o mesmo que desmarcar Exibir no menu na tela Páginas.
        </p>
      </Secao>

      <Secao
        titulo="Links externos"
        descricao={`Até ${EXTERNOS_MAX} links para fora do site, como o CRECI ou um portal parceiro. Aparecem no fim do menu e abrem em outra aba.`}
      >
        {externos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum link externo.</p>}
        <div className="space-y-4">
          {externos.map((e, i) => {
            const avisos = avisosDoExterno(e);
            return (
              <div key={i} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] sm:items-start">
                <CampoTexto id={`externo-${i}-nome`} rotulo="Nome no menu" valor={e.label} maxLength={ROTULO_MAX}
                  placeholder="CRECI" aviso={avisos.nome ?? undefined} aoMudar={label => mudarExterno(i, { label })} />
                <CampoTexto id={`externo-${i}-endereco`} rotulo="Endereço" valor={e.url} inputMode="url"
                  placeholder="https://..." aviso={avisos.endereco ?? undefined} aoMudar={url => mudarExterno(i, { url })} />
                <Button type="button" variant="ghost" size="sm" className="sm:mt-7" onClick={() => removerExterno(i)}
                  aria-label={`Remover o link ${e.label || i + 1}`}>
                  <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Remover
                </Button>
              </div>
            );
          })}
        </div>
        {externos.length < EXTERNOS_MAX && (
          <Button type="button" variant="outline" onClick={acrescentarExterno}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Adicionar link
          </Button>
        )}
      </Secao>
      {dialogoDeConfirmacao}
    </Secoes>
  );
}

interface ItemProps {
  item: Item;
  primeiro: boolean;
  ultimo: boolean;
  aviso: string | null;
  mudar: (parte: Partial<Item>) => void;
  mover: (passo: -1 | 1) => void;
}

function ItemDoMenu({ item, primeiro, ultimo, aviso, mudar, mover }: ItemProps) {
  // Arrasta só pela alça: o item inteiro arrastável roubaria o clique do campo.
  const controles = useDragControls();
  const fabrica = nomeDeFabrica(item);
  const idBase = `menu-${item.key.replace(/[^a-z0-9_-]/gi, '-')}`;

  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controles} className="list-none">
      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Arrastar pra mudar a ordem" title="Arrastar pra mudar a ordem"
            onPointerDown={e => controles.start(e)}
            className="flex-none cursor-grab touch-none text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          <div className="flex flex-none items-center gap-2">
            <Checkbox id={`${idBase}-mostrar`} checked={item.enabled} aria-label={`Mostrar ${fabrica} no menu`}
              onCheckedChange={c => mudar({ enabled: c === true })} />
            <UILabel htmlFor={`${idBase}-mostrar`} className="cursor-pointer">Mostrar</UILabel>
          </div>
          <Input aria-label={`Nome no menu: ${fabrica}`} className={`min-w-0 flex-1 ${CLASSE_DO_CAMPO}`}
            maxLength={ROTULO_MAX} value={item.label ?? ''} placeholder={fabrica}
            onChange={e => mudar({ label: e.target.value === '' ? null : e.target.value })} />
          <div className="flex flex-none items-center gap-1">
            <Button type="button" variant="ghost" size="icon" aria-label={`Subir ${fabrica}`} title="Subir" disabled={primeiro}
              onClick={() => mover(-1)}>
              <ChevronUp className="h-4 w-4" aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Descer ${fabrica}`} title="Descer" disabled={ultimo}
              onClick={() => mover(1)}>
              <ChevronDown className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
        {ehPagina(item.key) && <p className="text-sm text-muted-foreground">Página criada em Páginas.</p>}
        {aviso && <p className="text-sm text-amber-700 dark:text-amber-400">{aviso}</p>}
      </div>
    </Reorder.Item>
  );
}
