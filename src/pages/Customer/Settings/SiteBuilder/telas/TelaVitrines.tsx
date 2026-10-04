import { useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { ChevronDown, ChevronUp, GripVertical, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Button, Checkbox, Input, Label as UILabel } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { HOME_FABRICA, type HomeConfig, type RegrasVitrine, type Vitrine } from '@/features/siteBuilder/public/homeConfig';
import { ROTULO_TIPO, opcoesDeTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { FASES } from '@/features/properties/listingKind';
import { Secao, Secoes } from '../ui/Secao';
import { CLASSE_DO_CAMPO, CampoTexto } from '../ui/Campo';
import type { FormProps } from './tipos';

// Teto do servidor (Sites::HomeConfig::MAX_SHOWCASES), contando as 2 de fábrica.
const MAX_VITRINES = 6;
const OPCOES_TIPO = opcoesDeTipo(Object.keys(ROTULO_TIPO));
const REGRA_VAZIA: RegrasVitrine = {
  transaction: null, listing_kind: null, property_types: [], cities: [], neighborhoods: [],
  price_min: null, price_max: null, stages: [], featured_only: false,
};
const TITULO_FABRICA: Record<string, string> = Object.fromEntries(HOME_FABRICA.showcases.map(v => [v.id, v.title]));
const DICA_FABRICA: Record<Vitrine['kind'], string> = {
  launches: 'Só empreendimentos.',
  featured: 'Imóveis marcados como destaque ou exclusivos.',
  custom: '',
};

// Id curto gerado aqui; o servidor troca se colidir.
function novoId(lista: Vitrine[]): string {
  let id = '';
  do id = `v${Math.random().toString(36).slice(2, 8)}`; while (lista.some(v => v.id === id));
  return id;
}

export default function TelaVitrines({ siteForm, setF }: FormProps) {
  const home: HomeConfig = siteForm.home ?? HOME_FABRICA;
  const lista = home.showcases;
  const [aberta, setAberta] = useState<string | null>(null);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  // Sempre o objeto `home` inteiro: o servidor troca cada bloco recebido por completo.
  const gravar = (showcases: Vitrine[]) => setF({ home: { ...home, showcases } });
  const mudar = (id: string, parte: Partial<Vitrine>) => gravar(lista.map(v => (v.id === id ? { ...v, ...parte } : v)));
  const mover = (i: number, passo: -1 | 1) => {
    const nova = [...lista];
    [nova[i], nova[i + passo]] = [nova[i + passo], nova[i]];
    gravar(nova);
  };
  const acrescentar = () => {
    const id = novoId(lista);
    gravar([...lista, { id, kind: 'custom', enabled: true, title: 'Vitrine', rules: { ...REGRA_VAZIA } }]);
    setAberta(id);
  };
  const remover = async (v: Vitrine) => {
    const ok = await confirmar({
      titulo: 'Remover vitrine',
      descricao: `A vitrine "${v.title || 'Vitrine'}" sai da página inicial quando você salvar.`,
      rotuloDaAcao: 'Remover',
      destrutivo: true,
    });
    if (ok) gravar(lista.filter(x => x.id !== v.id));
  };

  return (
    <Secoes>
      <Secao
        titulo="Faixas de imóveis"
        descricao="Cada vitrine é uma faixa de imóveis na página inicial, com até 6, os mais recentes primeiro. Vitrine sem imóvel some sozinha do site. Arraste pela alça ou use as setas para mudar a ordem."
      >
      <Reorder.Group axis="y" values={lista} onReorder={gravar} className="space-y-3">
        {lista.map((v, i) => (
          <ItemVitrine key={v.id} vitrine={v} primeira={i === 0} ultima={i === lista.length - 1}
            aberta={aberta === v.id} alternarEditor={() => setAberta(aberta === v.id ? null : v.id)}
            mudar={parte => mudar(v.id, parte)} mover={passo => mover(i, passo)} remover={() => remover(v)} />
        ))}
      </Reorder.Group>

      {lista.length < MAX_VITRINES && (
        <Button type="button" variant="outline" onClick={acrescentar}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Nova vitrine
        </Button>
      )}
      {dialogoDeConfirmacao}
      </Secao>
    </Secoes>
  );
}

interface ItemProps {
  vitrine: Vitrine;
  primeira: boolean;
  ultima: boolean;
  aberta: boolean;
  alternarEditor: () => void;
  mudar: (parte: Partial<Vitrine>) => void;
  mover: (passo: -1 | 1) => void;
  remover: () => void;
}

function ItemVitrine({ vitrine: v, primeira, ultima, aberta, alternarEditor, mudar, mover, remover }: ItemProps) {
  // Arrasta só pela alça: o item inteiro arrastável roubaria o clique dos campos.
  const controles = useDragControls();
  const livre = v.kind === 'custom';
  const idBase = `vitrine-${v.id}`;

  return (
    <Reorder.Item value={v} dragListener={false} dragControls={controles} className="list-none">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Arrastar pra mudar a ordem" title="Arrastar pra mudar a ordem"
            onPointerDown={e => controles.start(e)}
            className="flex-none cursor-grab touch-none text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          <div className="flex flex-none items-center gap-2">
            <Checkbox id={`${idBase}-mostrar`} checked={v.enabled} onCheckedChange={c => mudar({ enabled: c === true })} />
            <UILabel htmlFor={`${idBase}-mostrar`} className="cursor-pointer">Mostrar</UILabel>
          </div>
          <Input aria-label="Título da vitrine" className={`min-w-0 flex-1 ${CLASSE_DO_CAMPO}`} maxLength={80} value={v.title}
            placeholder={TITULO_FABRICA[v.id] && !livre ? TITULO_FABRICA[v.id] : 'Vitrine'}
            onChange={e => mudar({ title: e.target.value })} />
          <div className="flex flex-none items-center gap-1">
            <Button type="button" variant="ghost" size="icon" aria-label="Subir" title="Subir" disabled={primeira}
              onClick={() => mover(-1)}>
              <ChevronUp className="h-4 w-4" aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Descer" title="Descer" disabled={ultima}
              onClick={() => mover(1)}>
              <ChevronDown className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        {livre ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" aria-expanded={aberta} onClick={alternarEditor}>
              <SlidersHorizontal className="mr-1.5 h-4 w-4" aria-hidden /> Editar regra
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={remover}>
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Remover
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{DICA_FABRICA[v.kind]}</p>
        )}

        {livre && aberta && (
          <EditorDeRegra idBase={idBase} regras={v.rules ?? REGRA_VAZIA}
            mudar={parte => mudar({ rules: { ...(v.rules ?? REGRA_VAZIA), ...parte } })} />
        )}
      </div>
    </Reorder.Item>
  );
}

function Escolha<T extends string | null>({ rotulo, valor, opcoes, mudar }:
  { rotulo: string; valor: T; opcoes: [T, string][]; mudar: (v: T) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{rotulo}</p>
      <div role="group" aria-label={rotulo} className="flex flex-wrap gap-2">
        {opcoes.map(([v, r]) => (
          <Button key={r} type="button" size="sm" variant={valor === v ? 'default' : 'outline'} aria-pressed={valor === v}
            onClick={() => mudar(v)}>{r}</Button>
        ))}
      </div>
    </div>
  );
}

const alternar = (lista: string[], item: string, marcado: boolean) =>
  marcado ? [...lista.filter(x => x !== item), item] : lista.filter(x => x !== item);

function EditorDeRegra({ idBase, regras, mudar }: { idBase: string; regras: RegrasVitrine; mudar: (parte: Partial<RegrasVitrine>) => void }) {
  const preco = (v: string) => (v === '' ? null : Number(v));

  return (
    <div className="space-y-5 rounded-md border border-dashed border-border p-4">
      <Escolha rotulo="Finalidade" valor={regras.transaction} mudar={transaction => mudar({ transaction })}
        opcoes={[[null, 'Qualquer'], ['sale', 'Comprar'], ['rent', 'Alugar']]} />
      <Escolha rotulo="Cadastro" valor={regras.listing_kind}
        // Revenda não tem fase: as marcadas sairiam escondidas e zerariam a vitrine.
        mudar={listing_kind => mudar(listing_kind === 'resale' ? { listing_kind, stages: [] } : { listing_kind })}
        opcoes={[[null, 'Qualquer'], ['development', 'Empreendimentos'], ['resale', 'Revenda']]} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tipos de imóvel</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {OPCOES_TIPO.map(([tipo, rotulo]) => (
            <div key={tipo} className="flex items-center gap-2">
              <Checkbox id={`${idBase}-tipo-${tipo}`} checked={regras.property_types.includes(tipo)}
                onCheckedChange={c => mudar({ property_types: alternar(regras.property_types, tipo, c === true) })} />
              <UILabel htmlFor={`${idBase}-tipo-${tipo}`} className="cursor-pointer font-normal">{rotulo}</UILabel>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Nenhum marcado: todos os tipos.</p>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <CampoLista id={`${idBase}-cidades`} rotulo="Cidades" lista={regras.cities} mudar={cities => mudar({ cities })} />
        <CampoLista id={`${idBase}-bairros`} rotulo="Bairros" lista={regras.neighborhoods} mudar={neighborhoods => mudar({ neighborhoods })} />
        <p className="text-sm text-muted-foreground sm:col-span-2">Cidade e bairro como no cadastro dos imóveis; maiúscula e acento não fazem diferença.</p>
        <CampoTexto id={`${idBase}-de`} rotulo="De R$" type="number" min={0} inputMode="numeric"
          valor={String(regras.price_min ?? '')} aoMudar={v => mudar({ price_min: preco(v) })} />
        <CampoTexto id={`${idBase}-ate`} rotulo="Até R$" type="number" min={0} inputMode="numeric"
          valor={String(regras.price_max ?? '')} aoMudar={v => mudar({ price_max: preco(v) })} />
        {regras.price_min != null && regras.price_max != null && regras.price_min > regras.price_max && (
          <p className="text-sm text-amber-600 sm:col-span-2">O valor em De R$ está maior que o de Até R$: nenhum imóvel cabe e a vitrine some do site.</p>
        )}
      </div>

      {regras.listing_kind !== 'resale' && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Fases</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FASES.map(f => (
              <div key={f.valor} className="flex items-center gap-2">
                <Checkbox id={`${idBase}-fase-${f.valor}`} checked={regras.stages.includes(f.valor)}
                  onCheckedChange={c => mudar({ stages: alternar(regras.stages, f.valor, c === true) })} />
                <UILabel htmlFor={`${idBase}-fase-${f.valor}`} className="cursor-pointer font-normal">{f.rotulo}</UILabel>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Fase vale só para empreendimentos.</p>
        </fieldset>
      )}

      <div className="flex items-center gap-2">
        <Checkbox id={`${idBase}-destaque`} checked={regras.featured_only} onCheckedChange={c => mudar({ featured_only: c === true })} />
        <UILabel htmlFor={`${idBase}-destaque`} className="cursor-pointer">Só destaques e exclusivos</UILabel>
      </div>
    </div>
  );
}

const separar = (t: string) => [...new Set(t.split(',').map(s => s.trim()).filter(Boolean))];

// Texto separado por vírgula. O texto digitado fica aqui: refazer o campo a partir
// da lista engoliria a vírgula final e não daria pra digitar o próximo nome.
function CampoLista({ id, rotulo, lista, mudar }: { id: string; rotulo: string; lista: string[]; mudar: (l: string[]) => void }) {
  const [texto, setTexto] = useState(lista.join(', '));
  // Lista trocada por fora (Descartar, home relido do servidor): o campo acompanha.
  const [anterior, setAnterior] = useState(lista);
  if (lista !== anterior) {
    setAnterior(lista);
    if (separar(texto).join('\n') !== lista.join('\n')) setTexto(lista.join(', '));
  }
  return (
    <CampoTexto id={id} rotulo={rotulo} valor={texto} placeholder="Separe por vírgula"
      aoMudar={v => {
        setTexto(v);
        mudar(separar(v));
      }} />
  );
}
