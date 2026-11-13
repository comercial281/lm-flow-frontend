import { useRef } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import type { SiteHeroImage, SiteHeroImageChoice } from '@/services/siteBuilder/siteBuilderService';
import { MAX_FOTOS_EXTRAS, heroImageWarning } from '@/features/siteBuilder/heroImage';

/** Prévia de uma extra recém-escolhida de imóvel (ainda não salva), guardada pela chave da escolha. */
export interface PreviaDaExtra { url: string; titulo: string }

/** Chave estável da escolha: a mesma foto tem sempre a mesma chave, salva ou não. */
export function chaveDaExtra(c: SiteHeroImageChoice): string {
  return c.mode === 'property' ? `p:${c.property_id}:${c.photo_id ?? ''}` : `u:${c.url ?? ''}`;
}

interface Props {
  extras: SiteHeroImageChoice[];
  /** O que o servidor resolveu hoje (prévia e avisos das já salvas). */
  resolvidas: SiteHeroImage[];
  previas: Record<string, PreviaDaExtra>;
  enviando: boolean;
  aoMudar: (extras: SiteHeroImageChoice[]) => void;
  aoEscolherImovel: () => void;
  aoEnviarArquivo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function Cartao({ id, posicao, extra, url, titulo, aviso, aoRemover }: {
  id: string; posicao: number; extra: SiteHeroImageChoice; url: string | null; titulo: string | null;
  aviso: string | null; aoRemover: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id, attributes: { roleDescription: 'foto do banner' },
  });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('w-44 overflow-hidden rounded-xl border border-border bg-background', isDragging && 'z-10 shadow-lg ring-2 ring-primary')}>
      <div className="relative aspect-video bg-muted">
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex items-center justify-between gap-1 px-1 py-1">
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
          aria-label={`Arrastar a ${posicao}ª foto extra`}
          className="flex h-9 w-9 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {extra.mode === 'property' ? (titulo ?? 'Foto de um imóvel') : 'Foto enviada'}
        </span>
        <Button type="button" variant="ghost" size="icon" onClick={aoRemover}
          aria-label={`Remover a ${posicao}ª foto extra`} title="Remover" className="hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {aviso && <p className="px-2 pb-2 text-xs text-amber-700">{aviso}</p>}
    </li>
  );
}

export default function MaisFotosDoBanner(p: Props) {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Ids únicos mesmo se a mesma foto entrar duas vezes.
  const vistos = new Map<string, number>();
  const ids = p.extras.map(e => {
    const k = chaveDaExtra(e);
    const n = vistos.get(k) ?? 0;
    vistos.set(k, n + 1);
    return n ? `${k}#${n}` : k;
  });
  const aoSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const de = ids.indexOf(String(active.id));
    const para = ids.indexOf(String(over.id));
    if (de >= 0 && para >= 0) p.aoMudar(arrayMove(p.extras, de, para));
  };
  const cheio = p.extras.length >= MAX_FOTOS_EXTRAS;
  const ref = p.inputRef ?? uploadRef;

  return (
    <fieldset className="space-y-2 border-t border-border pt-4">
      <legend className="mb-1 text-sm font-medium">Mais fotos</legend>
      <p className="text-sm text-muted-foreground">Com 2 fotos ou mais, o banner troca de foto a cada 6 segundos.</p>
      {p.extras.length > 0 && (
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <ul className="flex flex-wrap gap-3">
              {p.extras.map((extra, i) => {
                const chave = chaveDaExtra(extra);
                const previa = p.previas[chave];
                const salva = extra.mode === 'property'
                  ? p.resolvidas.find(r => r.mode === 'property' && r.property_id === extra.property_id && (r.photo_id ?? null) === (extra.photo_id ?? null))
                  : undefined;
                const url = extra.mode === 'upload' ? extra.url ?? null : previa?.url ?? salva?.url ?? null;
                const titulo = previa?.titulo ?? salva?.property?.title ?? null;
                const aviso = !previa && salva ? heroImageWarning(salva) : null;
                return (
                  <Cartao key={ids[i]} id={ids[i]} posicao={i + 1} extra={extra} url={url} titulo={titulo} aviso={aviso}
                    aoRemover={() => p.aoMudar(p.extras.filter((_, j) => j !== i))} />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {!cheio && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={p.aoEscolherImovel}>
            <ImageIcon className="mr-1.5 h-4 w-4" /> Foto de um imóvel
          </Button>
          <input ref={ref} type="file" accept="image/*" className="hidden" aria-label="Escolher arquivo: mais fotos do banner"
            onChange={p.aoEnviarArquivo} />
          <Button type="button" variant="outline" onClick={() => ref.current?.click()} disabled={p.enviando}>
            {p.enviando
              ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando...</>
              : <><Upload className="mr-1.5 h-4 w-4" /> Enviar foto</>}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
