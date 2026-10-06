// Conversa · Qualificação (onda 3). UMA lista de perguntas (as de situação do
// roteiro entraram nela pela rotina da onda 2), na ordem em que ela pergunta,
// "Obrigatória" por linha, arrastar pra reordenar (com Subir/Descer pra quem usa
// teclado), adicionar embaixo. Grava `qualification_questions` + as obrigatórias
// em `transfer_config.required_questions` (subchave).
//
// ⚠️ Não deixa desmarcar a última obrigatória: vazio no servidor = TODAS.
import { useState } from 'react';
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
  const n = indice + 1;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
      <button type="button" className="cursor-grab text-muted-foreground" aria-label={`Arrastar pergunta ${n}`} {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold" aria-hidden>{n}</span>
      <Input aria-label={`Pergunta ${n}`} value={valor} onChange={(e) => mudar(e.target.value)} onBlur={aoSair}
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

export default function Qualificacao({ agent, gravar, irPara }: PropsDaPagina) {
  const perguntas = perguntasDoAgente(agent);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nova, setNova] = useState('');
  const sensores = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = perguntas.map((p, i) => `${i}:${p.texto}`);
  const marcadas = perguntas.filter((p) => p.obrigatoria).length;
  const ehUltima = (i: number) => perguntas[i].obrigatoria && marcadas === 1 && perguntas.length > 1;

  const salvar = (lista: Pergunta[]) => gravar(perguntasParaPatch(lista, agent), ['transfer_config.required_questions']);
  const trocar = (i: number, p: Partial<Pergunta>) => salvar(perguntas.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const mover = (i: number, d: -1 | 1) => salvar(arrayMove(perguntas, i, i + d));
  const marcar = (i: number) => {
    if (ehUltima(i)) { setAviso(ULTIMA); return; }
    setAviso(null);
    void trocar(i, { obrigatoria: !perguntas[i].obrigatoria });
  };
  const excluir = (i: number) => {
    if (ehUltima(i)) { setAviso(ULTIMA); return; }
    setAviso(null);
    void salvar(perguntas.filter((_, j) => j !== i));
  };
  const adicionar = () => {
    const t = nova.trim();
    if (!t) return;
    setNova('');
    void salvar([...perguntas, { texto: t, obrigatoria: false }]);
  };
  const soltar = (e: DragEndEvent) => {
    const de = ids.indexOf(String(e.active.id));
    const para = e.over ? ids.indexOf(String(e.over.id)) : -1;
    if (de >= 0 && para >= 0 && de !== para) void salvar(arrayMove(perguntas, de, para));
  };

  return (
    <Secoes>
      <Secao titulo="Perguntas" descricao="O que ela precisa descobrir, uma por vez, nesta ordem. As obrigatórias seguram o repasse até serem respondidas. Arraste pra reordenar.">
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={soltar}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {perguntas.map((p, i) => (
                <Linha key={ids[i]} id={ids[i]} indice={i} total={perguntas.length} pergunta={p}
                  aoTexto={(t) => void trocar(i, { texto: t })} aoObrigatoria={() => marcar(i)} aoMover={(d) => void mover(i, d)} aoExcluir={() => excluir(i)} />
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
