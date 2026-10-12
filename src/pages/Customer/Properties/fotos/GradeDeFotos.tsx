import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type Announcements, type DragEndEvent, type ScreenReaderInstructions,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Crown, Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import type { PropertyPhoto } from '@/services/propertyPhotos/propertyPhotosService';
import type { Permissoes } from '@/features/properties/fotos/usePermissoesDasFotos';
import { podeOcultar } from '@/features/properties/fotos/regrasDasFotos';

// O leitor de tela fala português (o dnd-kit vem com as frases em inglês).
const INSTRUCOES: ScreenReaderInstructions = {
  draggable: 'Pra mudar a ordem, aperte espaço, use as setas e aperte espaço de novo pra soltar. Esc cancela. A primeira foto é a capa.',
};

function anuncios(todas: PropertyPhoto[]): Announcements {
  const pos = (id: unknown) => `${Math.max(0, todas.findIndex(p => p.id === id)) + 1}ª`;
  return {
    onDragStart: ({ active }) => `Foto pega, na posição ${pos(active.id)}.`,
    onDragOver: ({ over }) => (over ? `Sobre a posição ${pos(over.id)}.` : 'Fora da lista.'),
    onDragEnd: ({ over }) => (over ? `Foto solta na posição ${pos(over.id)}.` : 'Foto solta. A ordem não mudou.'),
    onDragCancel: ({ active }) => `Cancelado. A foto voltou pra posição ${pos(active.id)}.`,
  };
}

interface Props {
  fotos: PropertyPhoto[];
  /** A lista inteira, pra numerar e anunciar a posição real. */
  todas: PropertyPhoto[];
  capaId: string | null;
  pode: Permissoes;
  arrastavel: boolean;
  ocupado: boolean;
  selecionando: boolean;
  selecionadas: Set<string>;
  aoAlternarSelecao: (id: string) => void;
  aoAbrir: (id: string) => void;
  aoMover: (deId: string, paraId: string) => void;
  aoUsarComoCapa: (id: string) => void;
  aoAlternarVisivel: (id: string) => void;
  aoExcluir: (id: string) => void;
}

function Cartao({ foto, posicao, ehCapa, props }: { foto: PropertyPhoto; posicao: number; ehCapa: boolean; props: Props }) {
  const { pode, selecionando, selecionadas } = props;
  const marcada = selecionadas.has(foto.id);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: foto.id,
    disabled: !props.arrastavel || props.ocupado || selecionando,
    attributes: { roleDescription: 'foto do imóvel' },
  });
  const ocultavel = podeOcultar(foto, ehCapa ? foto.id : null);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-background',
        isDragging && 'z-10 shadow-lg ring-2 ring-primary',
        marcada && 'ring-2 ring-primary',
      )}
    >
      <button
        type="button"
        onClick={() => (selecionando ? props.aoAlternarSelecao(foto.id) : props.aoAbrir(foto.id))}
        aria-label={selecionando ? `Selecionar a ${posicao}ª foto` : `Abrir a ${posicao}ª foto`}
        aria-pressed={selecionando ? marcada : undefined}
        className="relative block aspect-[4/3] w-full max-w-full cursor-zoom-in bg-muted"
      >
        <img
          src={foto.thumbnail_url || foto.file_url}
          alt={foto.alt_text ?? foto.caption ?? ''}
          className={cn('h-full w-full object-cover', !foto.published && 'opacity-40 grayscale')}
          loading="lazy"
        />
        <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 text-xs font-bold tabular-nums text-white">
          {posicao}
        </span>
        <span className="absolute bottom-2 left-2 flex gap-1">
          {ehCapa && (
            <span className="flex items-center gap-1 rounded bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-amber-950">
              <Crown className="h-3 w-3" aria-hidden="true" />Capa
            </span>
          )}
          {!foto.published && <span className="rounded bg-black/75 px-1.5 py-0.5 text-xs font-semibold text-white">Oculta</span>}
        </span>
      </button>

      {selecionando && (
        // Só marca visual: quem seleciona é o botão da foto (aria-pressed), senão
        // o leitor de tela ouviria dois controles com o mesmo nome.
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border-2 border-white',
            marcada ? 'bg-primary text-primary-foreground' : 'bg-black/35',
          )}
        >
          {marcada && <Check className="h-3.5 w-3.5" />}
        </span>
      )}

      {props.arrastavel && !selecionando && (
        <Button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          variant="secondary"
          size="icon"
          aria-label={`Arrastar a ${posicao}ª foto`}
          title="Arraste para mudar a ordem"
          className="absolute right-2 top-2 cursor-grab touch-none active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      )}

      {!selecionando && (
        <div className="flex justify-end gap-0.5 border-t px-1 py-0.5">
          {pode.capa && foto.published && (
            <Button
              type="button" variant="ghost" size="icon"
              onClick={() => props.aoUsarComoCapa(foto.id)}
              disabled={ehCapa}
              aria-label="Usar como capa"
              title={ehCapa ? 'Já é a capa' : 'Usar como capa (vai para o 1º lugar)'}
              className="opacity-70 group-hover:opacity-100"
            >
              <Crown className="h-4 w-4" />
            </Button>
          )}
          {pode.ocultar && (
            <Button
              type="button" variant="ghost" size="icon"
              onClick={() => props.aoAlternarVisivel(foto.id)}
              disabled={!ocultavel}
              aria-label={foto.published ? 'Ocultar' : 'Mostrar'}
              title={!ocultavel ? 'Escolha outra capa antes de ocultar esta.' : foto.published ? 'Ocultar do site, dos portais e da IA' : 'Mostrar no site, nos portais e na IA'}
              className="opacity-70 group-hover:opacity-100"
            >
              {foto.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          )}
          {pode.excluir && (
            <Button
              type="button" variant="ghost" size="icon"
              onClick={() => props.aoExcluir(foto.id)}
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

export default function GradeDeFotos(props: Props) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const aoSoltar = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) props.aoMover(String(active.id), String(over.id));
  };
  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      onDragEnd={aoSoltar}
      accessibility={{ screenReaderInstructions: INSTRUCOES, announcements: anuncios(props.todas) }}
    >
      <SortableContext items={props.fotos.map(p => p.id)} strategy={rectSortingStrategy}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]">
          {props.fotos.map(foto => (
            <Cartao
              key={foto.id}
              foto={foto}
              posicao={props.todas.findIndex(p => p.id === foto.id) + 1}
              ehCapa={foto.id === props.capaId}
              props={props}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
