// No quadro, o card do endereço que não abriu: sem acesso (outro dono, apagado,
// outro funil) ou falha (com "Tentar de novo"). Substitui o "Este lead não está
// nesta aba." do E0, que valia só até o GET de um card existir (spec §7). O X
// (quando o quadro passa `aoFechar`) tira o ?card=, como o aviso da E0 fazia.
import { X } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import IconActionButton from '@/components/base/IconActionButton';
import { cn } from '@/lib/utils';
import { avisoDoCardForaDoQuadro, type CardForaDoQuadro } from './useCardForaDoQuadro';

export default function AvisoDoCardForaDoQuadro({ estado, aoFechar, className }: {
  estado: CardForaDoQuadro;
  aoFechar?: () => void;
  className?: string;
}) {
  const texto = avisoDoCardForaDoQuadro(estado);
  if (!texto) return null;
  return (
    <div
      role="status"
      className={cn('flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm', className)}
    >
      <span className="flex-1">{texto}</span>
      {estado.estado === 'erro' && (
        <Button type="button" variant="outline" size="sm" onClick={estado.tentarDeNovo}>
          Tentar de novo
        </Button>
      )}
      {aoFechar && (
        <IconActionButton label="Fechar aviso" variant="ghost" onClick={aoFechar} icon={<X className="h-4 w-4" />} />
      )}
    </div>
  );
}
