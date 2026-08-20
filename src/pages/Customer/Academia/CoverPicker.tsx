// Seletor de capa (thumbnail) — upload de imagem pro bucket ou colar URL.

import { useRef } from 'react';
import { PlayCircle, ImagePlus, Loader2, X } from 'lucide-react';
import { useUploadModuleCover } from '@/hooks/useKnowledge';

interface Props {
  value: string;
  onChange: (url: string) => void;
}

export default function CoverPicker({ value, onChange }: Props) {
  const upload = useUploadModuleCover();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Selecione um arquivo de imagem.');
      return;
    }
    try {
      const url = await upload.mutateAsync({ file });
      onChange(url);
    } catch {
      /* toast do hook */
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-1.5">Capa (thumbnail)</p>
      <div className="flex items-start gap-3">
        <div className="relative w-32 shrink-0 aspect-video rounded-lg border border-border overflow-hidden bg-gradient-to-br from-primary/20 via-purple-500/10 to-muted flex items-center justify-center">
          {value ? (
            <>
              <img src={value} alt="Capa" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute top-1 right-1 p-1 bg-black/55 text-white hover:text-red-400 rounded-md backdrop-blur"
                title="Remover capa"
              >
                <X size={12} />
              </button>
            </>
          ) : (
            <PlayCircle size={24} className="text-primary/60" strokeWidth={1.5} />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <input ref={inputRef} type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="hidden" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary/40 disabled:opacity-50"
          >
            {upload.isPending ? (
              <><Loader2 size={12} className="animate-spin" /> Enviando...</>
            ) : (
              <><ImagePlus size={12} /> Enviar imagem</>
            )}
          </button>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ou cole uma URL"
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
