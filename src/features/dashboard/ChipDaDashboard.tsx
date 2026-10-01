// src/features/dashboard/ChipDaDashboard.tsx
import { X } from 'lucide-react';
import IconActionButton from '@/components/base/IconActionButton';

/**
 * "Da Dashboard: Sem fotos ×". Mostra que a lista abriu filtrada por um clique
 * na Dashboard, e tira o filtro. Sem ele, quem chega pelo link vê 3 imóveis e
 * acha que sumiram os outros 412.
 */
export function ChipDaDashboard({ rotulo, onTirar }: { rotulo: string; onTirar: () => void }) {
  if (!rotulo) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-0.5 text-xs font-medium text-primary">
      Da Dashboard: {rotulo}
      {/* O botão da casa já traz o nome no tooltip, o aria-label e o anel de foco;
          size-6 dá 24px de área de clique dentro do chip. */}
      <IconActionButton
        label="Tirar o filtro da Dashboard"
        variant="ghost"
        onClick={onTirar}
        className="size-6 rounded-full text-primary hover:bg-primary/15 hover:text-primary"
        icon={<X className="h-3.5 w-3.5" aria-hidden />}
      />
    </span>
  );
}
