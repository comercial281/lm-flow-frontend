import { Seletor } from '@/components/base/Seletor';
import {
  LISTA_FABRICA, ORDENS, ROTULO_ORDEM, ehOrdem, type LayoutDosCartoes, type ListaConfig,
} from '@/features/siteBuilder/public/listaConfig';
import { Secao, Secoes } from '../ui/Secao';
import { CLASSE_DO_CAMPO, Campo } from '../ui/Campo';
import type { FormProps } from './tipos';

// Lista de imóveis (Meu site › Personalizar): a ordem com que a busca do site
// abre e o visual dos cartões. Manda SEMPRE o `listing` inteiro.

const VISUAIS: { id: LayoutDosCartoes; rotulo: string }[] = [
  { id: 'grid', rotulo: 'Grade' },
  { id: 'rows', rotulo: 'Linhas largas' },
];

export default function TelaLista({ siteForm, setF }: FormProps) {
  const lista: ListaConfig = siteForm.listing ?? LISTA_FABRICA;
  const mudar = (parte: Partial<ListaConfig>) => setF({ listing: { ...lista, ...parte } });

  return (
    <Secoes>
      <Secao
        titulo="Ordem padrão"
        descricao={'Como os imóveis aparecem quando alguém abre a busca do site. O visitante pode trocar em "Ordenar por".'}
      >
        <Campo id="lista-ordem" rotulo="Ordem padrão"
          ajuda="Imóvel sem preço (ou sem área, em Maior área) fica no fim da lista.">
          <Seletor id="lista-ordem" className={`w-full sm:w-72 ${CLASSE_DO_CAMPO}`} value={lista.default_sort}
            onChange={e => { if (ehOrdem(e.target.value)) mudar({ default_sort: e.target.value }); }}>
            {ORDENS.map(o => <option key={o} value={o}>{ROTULO_ORDEM[o]}</option>)}
          </Seletor>
        </Campo>
      </Secao>

      <Secao titulo="Visual dos cartões" descricao="Como cada imóvel aparece na busca do site.">
        <div role="group" aria-label="Visual dos cartões" className="flex flex-wrap gap-3">
          {VISUAIS.map(v => (
            <button key={v.id} type="button" aria-pressed={lista.card_layout === v.id} onClick={() => mudar({ card_layout: v.id })}
              className={`w-44 rounded-lg border p-2 text-left text-sm ${lista.card_layout === v.id ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}>
              <Miniatura visual={v.id} />
              <span className="mt-2 block">{v.rotulo}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {lista.card_layout === 'rows'
            ? 'Um imóvel por linha. Foto à esquerda, dados ao lado e preço com os botões à direita no computador (embaixo dos dados no tablet). No celular, a foto fica em cima.'
            : 'Três cartões por linha no computador (dois no tablet, um no celular), com a foto em cima e os dados embaixo.'}
        </p>
      </Secao>
    </Secoes>
  );
}

function Miniatura({ visual }: { visual: LayoutDosCartoes }) {
  if (visual === 'rows') {
    return (
      <span aria-hidden className="flex h-16 flex-col justify-center gap-1.5 rounded bg-muted px-2">
        {[0, 1].map(k => (
          <span key={k} className="flex h-5 items-center gap-1 rounded-sm border border-border bg-white p-0.5">
            <span className="h-full w-6 rounded-[2px] bg-zinc-300" />
            <span className="h-1 flex-1 rounded bg-zinc-200" />
            <span className="h-1.5 w-4 rounded bg-zinc-400" />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span aria-hidden className="flex h-16 items-center justify-center gap-1 rounded bg-muted px-2">
      {[0, 1, 2].map(k => (
        <span key={k} className="flex h-12 flex-1 flex-col overflow-hidden rounded-sm border border-border bg-white">
          <span className="h-6 bg-zinc-300" />
          <span className="m-1 h-1 rounded bg-zinc-200" />
        </span>
      ))}
    </span>
  );
}
