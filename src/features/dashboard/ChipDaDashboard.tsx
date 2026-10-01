// src/features/dashboard/ChipDaDashboard.tsx
import { X } from 'lucide-react';

/**
 * "Da Dashboard: Sem fotos ×". Mostra que a lista abriu filtrada por um clique
 * na Dashboard, e tira o filtro. Sem ele, quem chega pelo link vê 3 imóveis e
 * acha que sumiram os outros 412.
 */
export function ChipDaDashboard({ rotulo, onTirar }: { rotulo: string; onTirar: () => void }) {
  if (!rotulo) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      Da Dashboard: {rotulo}
      <button
        type="button"
        onClick={onTirar}
        aria-label="Tirar o filtro da Dashboard"
        className="rounded-full p-0.5 hover:bg-primary/15"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}
