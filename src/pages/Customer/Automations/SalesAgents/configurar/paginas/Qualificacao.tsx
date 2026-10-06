// Conversa · Qualificação (onda 3). UMA lista de perguntas (as de situação do
// roteiro entraram nela pela rotina da onda 2), na ordem em que ela pergunta,
// "Obrigatória" por linha, arrastar pra reordenar (com Subir/Descer pra quem usa
// teclado), adicionar embaixo. Grava `qualification_questions` + as obrigatórias
// em `transfer_config.required_questions` (subchave).
//
// ⚠️ Não deixa desmarcar a última obrigatória: vazio no servidor = TODAS.
import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Input } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { perguntasDoAgente, perguntasParaPatch, type Pergunta } from '@/features/salesAgents/perguntas';
import { cn } from '@/lib/utils';
import { useTextoNaHora } from '../TextoNaHora';
import { Aviso } from '../Aviso';
import type { PropsDaPagina } from '../paginas';

const ULTIMA = 'Pelo menos uma pergunta precisa ser obrigatória. Sem nenhuma marcada, todas valem.';

function Linha({ id, indice, total, pergunta, aoTexto, aoObrigatoria, aoMover, aoExcluir }: {
  id: string; indice: number; total: number; pergunta: Pergunta;
  aoTexto: (t: string) => void; aoObrigatoria: () => void; aoMover: (d: -1 | 1) => void; aoExcluir: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const { valor, mudar, aoSair } = useTextoNaHora(pergunta.texto, (t) => (t.trim() ? aoTexto(t.trim()) : undefined));
  // Linha esvaziada volta pro texto salvo: nunca fica em branco calada.
  const sair = () => { if (!valor.trim()) mudar(pergunta.texto); aoSair(); };
  const n = indice + 1;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
      <button type="button" className="cursor-grab text-muted-foreground" aria-label={`Arrastar pergunta ${n}`} {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold" aria-hidden>{n}</span>
      <Input aria-label={`Pergunta ${n}`} value={valor} onChange={(e) => mudar(e.target.value)} onBlur={sair}
        className="h-10 min-w-[12rem] flex-1 text-base md:text-base" />
      <button type="button" aria-pressed={pergunta.obrigatoria} aria-label={`Pergunta ${n} é obrigatória`} onClick={aoObrigatoria}
        className={cn('min-h-9 rounded-full border-[1.5px] px-3 text-sm font-medium',
          pergunta.obrigatoria ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground')}>
        Obrigatória
      </button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Subir pergunta ${n}`} disabled={indice === 0} onClick={() => aoMover(-1)}>
        <ArrowUp className="h-4 w-4" aria-hidden />
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Descer pergunta ${n}`} disabled={indice === total - 1} onClick={() => aoMover(1)}>
        <ArrowDown className="h-4 w-4" aria-hidden />
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Excluir pergunta ${n}`} onClick={aoExcluir}>
        <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
      </Button>
    </li>
  );
}

type Item = Pergunta & { id: string };

export default function Qualificacao({ agent, gravar, irPara }: PropsDaPagina) {
  // ⚠️ A lista mais recente mora num ref, atualizado de forma síncrona a cada
  // escrita: o blur do texto grava e o clique seguinte (Obrigatória, Subir, ...)
  // roda antes do agente voltar do servidor; com a lista da render ele desfaria a
  // edição. Os ids são estáveis por linha (não dependem do texto nem da posição),
  // pra edição em andamento não remontar a linha.
  const contador = useRef(0);
  const novoId = () => `q${contador.current++}`;
  const lidas = perguntasDoAgente(agent);
  const chave = JSON.stringify(lidas);
  const itensRef = useRef<Item[]>(lidas.map((p) => ({ ...p, id: novoId() })));
  const lidaRef = useRef(chave);
  const [, redesenhar] = useState(0);
  // Só reconstrói quando o que o SERVIDOR devolve muda (outro lugar gravou, ou o eco
  // da escrita). Comparar com a lista local faria uma render antes do eco desfazer a edição.
  if (lidaRef.current !== chave) {
    lidaRef.current = chave;
    const local = JSON.stringify(itensRef.current.map(({ texto, obrigatoria }) => ({ texto, obrigatoria })));
    if (local !== chave) itensRef.current = lidas.map((p, i) => ({ ...p, id: itensRef.current[i]?.id ?? novoId() }));
  }
  const itens = itensRef.current;
  const perguntas: Pergunta[] = itens;

  const [aviso, setAviso] = useState<string | null>(null);
  const [nova, setNova] = useState('');
  const sensores = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = itens.map((p) => p.id);
  const marcadas = perguntas.filter((p) => p.obrigatoria).length;
  const ehUltima = (i: number) => perguntas[i].obrigatoria && marcadas === 1 && perguntas.length > 1;

  const salvar = (lista: Item[]) => {
    itensRef.current = lista;
    redesenhar((n) => n + 1);
    return gravar(perguntasParaPatch(lista, agent), ['transfer_config.required_questions']);
  };
  // Sempre pela lista mais recente e pelo id da linha, não pela posição da render.
  const trocar = (id: string, p: Partial<Pergunta>) => salvar(itensRef.current.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const mover = (i: number, d: -1 | 1) => salvar(arrayMove(itensRef.current, i, i + d));
  const marcar = (i: number) => {
    if (ehUltima(i)) { setAviso(ULTIMA); return; }
    setAviso(null);
    void trocar(itens[i].id, { obrigatoria: !itens[i].obrigatoria });
  };
  const excluir = (i: number) => {
    if (ehUltima(i)) { setAviso(ULTIMA); return; }
    setAviso(null);
    void salvar(itensRef.current.filter((_, j) => j !== i));
  };
  const adicionar = () => {
    const t = nova.trim();
    if (!t) return;
    setNova('');
    void salvar([...itensRef.current, { id: novoId(), texto: t, obrigatoria: false }]);
  };
  const soltar = (e: DragEndEvent) => {
    const de = ids.indexOf(String(e.active.id));
    const para = e.over ? ids.indexOf(String(e.over.id)) : -1;
    if (de >= 0 && para >= 0 && de !== para) void salvar(arrayMove(itensRef.current, de, para));
  };

  return (
    <Secoes>
      <Secao titulo="Perguntas" descricao="O que ela precisa descobrir, uma por vez, nesta ordem. As obrigatórias seguram o repasse até serem respondidas. Arraste pra reordenar.">
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {itens.map((p, i) => (
                <Linha key={ids[i]} id={ids[i]} indice={i} total={perguntas.length} pergunta={p}
                  aoTexto={(t) => void trocar(p.id, { texto: t })} aoObrigatoria={() => marcar(i)} aoMover={(d) => void mover(i, d)} aoExcluir={() => excluir(i)} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
        {aviso && <p className="text-sm text-amber-700 dark:text-amber-400">{aviso}</p>}
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Nova pergunta" placeholder="Nova pergunta…" value={nova} onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }} className="h-11 min-w-[12rem] flex-1 text-base md:text-base" />
          <Button type="button" variant="outline" className="h-11" disabled={!nova.trim()} onClick={adicionar}>Adicionar</Button>
        </div>
        {agent.transfer_config?.mode !== 'checklist' && (
          <Aviso tom="neutro">
            <p>As obrigatórias só seguram o lead com o critério "Perguntas obrigatórias respondidas".</p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => irPara('criterio')}>Abrir Critério</Button>
          </Aviso>
        )}
      </Secao>
    </Secoes>
  );
}
