// src/pages/Customer/Settings/Listas/ListaDeOpcoes.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Archive, ArrowDown, ArrowUp, GripVertical, Loader2 } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Input } from '@/components/ui/ds';
import Chave from '@/components/base/Chave';
import EmptyState from '@/components/base/EmptyState';
import IconActionButton from '@/components/base/IconActionButton';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { cn } from '@/lib/utils';
import { listOptionsService, type ListKey, type ListOption } from '@/services/listOptions/listOptionsService';

// ── UMA LISTA DA CASA (E1 do funil, 07/10/2026) ─────────────────────────────
//
// Tudo vale na hora (é lista, não formulário): criar, renomear (ao sair do
// campo ou no Enter; Esc desiste), arquivar com confirmação, desarquivar,
// reordenar (alça de arrastar — mouse, dedo ou teclado — ou as setas ↑↓) e a
// chave da Meta nos motivos de perda. Opção não se exclui: quem usa guarda o id
// e continua mostrando o nome.
//
// Quem não tem `pipelines.update` (o corretor) vê só as ativas, sem editar.

export const TEXTOS_DA_LISTA: Record<ListKey, {
  rotulo: string; frase: string; novo: string; vazio: string; exemplo: string;
}> = {
  loss_reasons: {
    rotulo: 'Motivos de perda',
    frase: 'O que a equipe escolhe ao marcar um lead como Perdido. Separa quem adiou a compra de quem comprou com outro.',
    novo: 'Novo motivo',
    vazio: 'Nenhum motivo de perda ainda',
    exemplo: 'Adiou a compra',
  },
  task_categories: {
    rotulo: 'Categorias de tarefa',
    frase: 'O tipo de cada tarefa do corretor. Aparece na tarefa e no histórico do lead.',
    novo: 'Nova categoria',
    vazio: 'Nenhuma categoria de tarefa ainda',
    exemplo: 'Oferta ativa',
  },
};

const porPosicao = (a: ListOption, b: ListOption) => a.position - b.position;

// O leitor de tela fala português (o dnd-kit vem com as frases em inglês).
const INSTRUCOES_DE_ARRASTAR: ScreenReaderInstructions = {
  draggable: 'Pra mudar a ordem, aperte espaço, use as setas pra cima e pra baixo e aperte espaço de novo pra soltar. Esc cancela.',
};

interface LinhaProps {
  opcao: ListOption;
  indice: number;
  total: number;
  ocupado: boolean;
  podeEditar: boolean;
  comMeta: boolean;
  aoRenomear: (label: string) => Promise<boolean>;
  aoMover: (delta: -1 | 1) => void;
  aoArquivar: () => void;
  aoMeta: (ligada: boolean) => Promise<void>;
}

function LinhaDaOpcao({ opcao, indice, total, ocupado, podeEditar, comMeta, aoRenomear, aoMover, aoArquivar, aoMeta }: LinhaProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: opcao.id, disabled: ocupado || !podeEditar, attributes: { roleDescription: 'opção da lista' } });
  const [texto, setTexto] = useState(opcao.label);
  // Esc desiste: o blur que vem logo depois não pode gravar o texto digitado.
  const desistiu = useRef(false);

  useEffect(() => { setTexto(opcao.label); }, [opcao.label]);

  const sair = async () => {
    if (desistiu.current) {
      desistiu.current = false;
      return;
    }
    const limpo = texto.trim();
    if (!limpo || limpo === opcao.label) {
      setTexto(opcao.label);
      return;
    }
    if (!(await aoRenomear(limpo))) setTexto(opcao.label);
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:flex-nowrap',
        isDragging && 'relative z-10 shadow-lg',
      )}
    >
      {podeEditar && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar ${opcao.label}`}
          title={`Arrastar ${opcao.label}`}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {podeEditar ? (
        <Input
          aria-label={`Renomear ${opcao.label}`}
          value={texto}
          maxLength={80}
          disabled={ocupado}
          onChange={e => setTexto(e.target.value)}
          onBlur={() => void sair()}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              desistiu.current = true;
              setTexto(opcao.label);
              e.currentTarget.blur();
            }
          }}
          className="h-10 min-w-[10rem] flex-1 text-base md:text-base"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm">{opcao.label}</span>
      )}
      {comMeta && (
        <Chave
          rotulo={`Avisar a Meta como lead ruim quando o motivo for ${opcao.label}`}
          semRotuloVisivel
          ligada={opcao.meta_exclusion}
          aoMudar={aoMeta}
          desabilitada={!podeEditar}
          className="mx-1"
        />
      )}
      {podeEditar && (
        <div className="flex shrink-0 items-center gap-1">
          <IconActionButton label={`Subir ${opcao.label}`} variant="ghost" disabled={ocupado || indice === 0} onClick={() => aoMover(-1)} icon={<ArrowUp className="h-4 w-4" />} />
          <IconActionButton label={`Descer ${opcao.label}`} variant="ghost" disabled={ocupado || indice === total - 1} onClick={() => aoMover(1)} icon={<ArrowDown className="h-4 w-4" />} />
          <IconActionButton label={`Arquivar ${opcao.label}`} variant="ghost" disabled={ocupado} onClick={aoArquivar} icon={<Archive className="h-4 w-4" />} />
        </div>
      )}
    </li>
  );
}

interface Props {
  listKey: ListKey;
  podeEditar: boolean;
}

export default function ListaDeOpcoes({ listKey, podeEditar }: Props) {
  const textos = TEXTOS_DA_LISTA[listKey];
  const comMeta = listKey === 'loss_reasons';
  const [estado, setEstado] = useState<'carregando' | 'erro' | 'pronto'>('carregando');
  const [opcoes, setOpcoes] = useState<ListOption[]>([]);
  const [ocupado, setOcupado] = useState(false);
  // Trava síncrona: o `ocupado` do estado só chega no próximo render.
  const ocupadoRef = useRef(false);
  const [nova, setNova] = useState('');
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const carregar = useCallback(async () => {
    setEstado('carregando');
    try {
      setOpcoes(await listOptionsService.list(listKey, { includeInactive: podeEditar }));
      setEstado('pronto');
    } catch {
      setEstado('erro');
    }
  }, [listKey, podeEditar]);

  useEffect(() => { void carregar(); }, [carregar]);

  const ativas = opcoes.filter(o => o.active).sort(porPosicao);
  const arquivadas = opcoes.filter(o => !o.active).sort(porPosicao);

  const trocarUma = (salva: ListOption) => setOpcoes(atual => atual.map(o => (o.id === salva.id ? salva : o)));

  /** Uma escrita por vez. Erro: avisa com a frase do servidor (ou a de reserva) e devolve null. */
  const escrever = async <T,>(acao: () => Promise<T>, erro: string): Promise<T | null> => {
    if (ocupadoRef.current) return null;
    ocupadoRef.current = true;
    setOcupado(true);
    try {
      return await acao();
    } catch (e) {
      toast.error(apiErrorMessage(e, erro));
      return null;
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  };

  const adicionar = async () => {
    const label = nova.trim();
    if (!label) return;
    const criada = await escrever(() => listOptionsService.create(listKey, { label }), 'Não deu pra criar a opção. Tente de novo.');
    if (!criada) return;
    setNova('');
    setOpcoes(atual => [...atual, criada]);
    toast.success('Opção criada');
  };

  const renomear = async (opcao: ListOption, label: string) => {
    const salva = await escrever(() => listOptionsService.update(opcao.id, { label }), 'Não deu pra renomear. Tente de novo.');
    if (!salva) return false;
    trocarUma(salva);
    return true;
  };

  const arquivar = async (opcao: ListOption) => {
    const ok = await confirmar({
      titulo: 'Arquivar opção',
      descricao: `"${opcao.label}" sai das listas de escolha. O que já foi registrado com ela continua mostrando o nome.`,
      rotuloDaAcao: 'Arquivar',
    });
    if (!ok) return;
    const salva = await escrever(() => listOptionsService.update(opcao.id, { active: false }), 'Não deu pra arquivar. Tente de novo.');
    if (!salva) return;
    trocarUma(salva);
    toast.success(`"${opcao.label}" arquivada`);
  };

  const desarquivar = async (opcao: ListOption) => {
    const salva = await escrever(() => listOptionsService.update(opcao.id, { active: true }), 'Não deu pra desarquivar. Tente de novo.');
    if (!salva) return;
    trocarUma(salva);
    toast.success(`"${opcao.label}" voltou pra lista`);
  };

  /** Grava a ordem nova das ativas. Erro: volta como estava. */
  const gravarOrdem = async (lista: ListOption[]) => {
    const antes = opcoes;
    setOpcoes([...lista.map((o, i) => ({ ...o, position: i })), ...arquivadas]);
    const salvas = await escrever(
      () => listOptionsService.reorder(listKey, lista.map(o => o.id)),
      'Não deu pra mudar a ordem. Tente de novo.',
    );
    setOpcoes(salvas ?? antes);
  };

  const mover = (indice: number, delta: -1 | 1) => void gravarOrdem(arrayMove(ativas, indice, indice + delta));

  const aoSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const de = ativas.findIndex(o => o.id === active.id);
    const para = ativas.findIndex(o => o.id === over.id);
    if (de < 0 || para < 0) return;
    void gravarOrdem(arrayMove(ativas, de, para));
  };

  // A Chave cuida do erro (volta e avisa) e do duplo clique.
  const mudarMeta = async (opcao: ListOption, ligada: boolean) => {
    trocarUma(await listOptionsService.update(opcao.id, { meta_exclusion: ligada }));
  };

  if (estado === 'carregando') {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Carregando…
      </p>
    );
  }
  if (estado === 'erro') return <EmptyState tipo="erro" aoTentarDeNovo={() => void carregar()} />;

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">
        {textos.frase}
        {!podeEditar && ' Só o gestor muda esta lista.'}
      </p>
      {comMeta && podeEditar && (
        <p className="text-sm text-muted-foreground">
          Com &quot;Avisar a Meta como lead ruim&quot; ligado, marcar Perdido por esse motivo conta pra Meta que o lead não servia.
          Deixe desligado nos motivos em que o lead era bom, como &quot;Comprou com concorrente&quot;.
        </p>
      )}

      {ativas.length === 0 ? (
        <EmptyState
          title={textos.vazio}
          description={podeEditar ? 'Crie a primeira opção logo abaixo.' : 'O gestor ainda não criou nenhuma opção.'}
          exemplo={textos.exemplo}
        />
      ) : (
        <DndContext
          sensors={sensores}
          collisionDetection={closestCenter}
          onDragEnd={aoSoltar}
          accessibility={{ screenReaderInstructions: INSTRUCOES_DE_ARRASTAR }}
        >
          <SortableContext items={ativas.map(o => o.id)} strategy={verticalListSortingStrategy}>
            <ol aria-label={textos.rotulo} className="space-y-2">
              {ativas.map((o, i) => (
                <LinhaDaOpcao
                  key={o.id}
                  opcao={o}
                  indice={i}
                  total={ativas.length}
                  ocupado={ocupado}
                  podeEditar={podeEditar}
                  comMeta={comMeta}
                  aoRenomear={label => renomear(o, label)}
                  aoMover={d => mover(i, d)}
                  aoArquivar={() => void arquivar(o)}
                  aoMeta={ligada => mudarMeta(o, ligada)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {podeEditar && (
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label={textos.novo}
            placeholder={`${textos.novo}…`}
            value={nova}
            maxLength={80}
            onChange={e => setNova(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void adicionar();
              }
            }}
            className="h-11 min-w-[12rem] flex-1 text-base md:text-base"
          />
          <Button type="button" variant="outline" className="h-11" disabled={!nova.trim() || ocupado} onClick={() => void adicionar()}>
            Adicionar
          </Button>
        </div>
      )}

      {podeEditar && arquivadas.length > 0 && (
        <section aria-label="Arquivadas" className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Arquivadas</h2>
          <ul className="space-y-2">
            {arquivadas.map(o => (
              <li key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2">
                <span className="min-w-0 truncate text-sm text-muted-foreground">{o.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={ocupado}
                  aria-label={`Desarquivar ${o.label}`}
                  onClick={() => void desarquivar(o)}
                >
                  Desarquivar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialogoDeConfirmacao}
    </div>
  );
}
