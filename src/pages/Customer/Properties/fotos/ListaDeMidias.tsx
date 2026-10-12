import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, GripVertical, Music, Trash2 } from 'lucide-react';
import { Button, Checkbox } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import { numero } from '@/lib/formato';
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';
import type { Permissoes } from '@/features/properties/fotos/usePermissoesDasFotos';
import { TEXTO_DO_VIDEO, ehVideo, iaNoVideo, type SituacaoDoVideo } from '@/features/properties/fotos/regrasDasFotos';

interface Props {
  midias: PropertyPhoto[];
  /** Todas as mídias (a aba pode filtrar): o selo da IA é calculado sobre elas. */
  todasAsMidias: PropertyPhoto[];
  pode: Permissoes;
  arrastavel: boolean;
  ocupado: boolean;
  selecionando: boolean;
  selecionadas: Set<string>;
  aoAlternarSelecao: (id: string) => void;
  aoMover: (deId: string, paraId: string) => void;
  aoAlternarVisivel: (id: string) => void;
  aoExcluir: (id: string) => void;
}

const nomeDo = (m: PropertyPhoto) => m.file_name || m.caption || (ehVideo(m) ? 'Vídeo' : 'Áudio');
const tamanhoDo = (m: PropertyPhoto) =>
  m.file_size_bytes ? `${numero(m.file_size_bytes / (1024 * 1024), 1)} MB` : null;

function SeloDaIa({ situacao }: { situacao: SituacaoDoVideo }) {
  const manda = situacao === 'manda';
  const Icone = manda ? CheckCircle2 : AlertTriangle;
  return (
    <p className={cn('flex items-start gap-1.5 text-xs font-medium', manda ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
      <Icone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {TEXTO_DO_VIDEO[situacao]}
    </p>
  );
}

function Item({ m, situacao, props }: { m: PropertyPhoto; situacao?: SituacaoDoVideo; props: Props }) {
  const marcada = props.selecionadas.has(m.id);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: m.id,
    disabled: !props.arrastavel || props.ocupado || props.selecionando,
    attributes: { roleDescription: 'vídeo ou áudio do imóvel' },
  });
  const video = ehVideo(m);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative overflow-hidden rounded-xl border bg-background', (isDragging || marcada) && 'ring-2 ring-primary')}
    >
      <div className={cn('relative aspect-video max-w-full bg-muted', !m.published && 'opacity-40')}>
        {video ? (
          <video src={m.file_url} className="h-full w-full object-cover" muted playsInline preload="metadata" controls />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
            <Music className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <audio src={m.file_url} controls preload="metadata" className="w-full" />
          </div>
        )}
        {!m.published && <span className="absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-semibold text-white">Oculto</span>}
      </div>
      {props.selecionando && (
        <Checkbox
          checked={marcada}
          onCheckedChange={() => props.aoAlternarSelecao(m.id)}
          aria-label={`Selecionar ${nomeDo(m)}`}
          className="absolute left-2 top-2 bg-background"
        />
      )}
      {props.arrastavel && !props.selecionando && (
        <Button
          type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
          variant="secondary" size="icon"
          aria-label={`Arrastar ${nomeDo(m)}`} title="Arraste para mudar a ordem"
          className="absolute right-2 top-2 cursor-grab touch-none active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      )}
      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        <p className="truncate font-medium" title={nomeDo(m)}>{nomeDo(m)}</p>
        {tamanhoDo(m) && <p className="text-xs tabular-nums text-muted-foreground">{tamanhoDo(m)}</p>}
        {situacao && <SeloDaIa situacao={situacao} />}
      </div>
      {!props.selecionando && (props.pode.ocultar || props.pode.excluir) && (
        <div className="flex justify-end gap-0.5 border-t px-1 py-0.5">
          {props.pode.ocultar && (
            <Button
              type="button" variant="ghost" size="icon"
              onClick={() => props.aoAlternarVisivel(m.id)}
              aria-label={m.published ? 'Ocultar' : 'Mostrar'}
              title={m.published ? 'Ocultar do site, dos portais e da IA' : 'Mostrar no site, nos portais e na IA'}
              className="opacity-70 group-hover:opacity-100"
            >
              {m.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          )}
          {props.pode.excluir && (
            <Button
              type="button" variant="ghost" size="icon"
              onClick={() => props.aoExcluir(m.id)}
              aria-label="Excluir" title="Excluir"
              className="opacity-70 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export default function ListaDeMidias(props: Props) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ia = iaNoVideo(props.todasAsMidias);
  const aoSoltar = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) props.aoMover(String(active.id), String(over.id));
  };
  return (
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
      <SortableContext items={props.midias.map(m => m.id)} strategy={rectSortingStrategy}>
        <ul className="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          {props.midias.map(m => <Item key={m.id} m={m} situacao={ia.get(m.id)} props={props} />)}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
