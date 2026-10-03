import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import {
  propertyOwnersService,
  type ProprietarioCompleto,
  type StatusDoProprietario,
} from '@/services/propertyOwners/propertyOwnersService';
import { STATUS_DO_PROPRIETARIO, rotuloDoStatus } from '@/features/properties/proprietarios/statusDoProprietario';
import { TONS } from '@/pages/Customer/Properties/lista/SeloSituacao';

/**
 * Status do proprietário que se troca ali mesmo (gestor e corretor liberado).
 * Muda na hora; se o servidor recusar, volta e avisa.
 */
export default function PilulaDeStatus({ id, status, aoMudar }: {
  id: string;
  status: StatusDoProprietario;
  aoMudar?: (atualizado: ProprietarioCompleto) => void;
}) {
  const [atual, setAtual] = useState(status);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setAtual(status); }, [status]);

  const tom = STATUS_DO_PROPRIETARIO.find(s => s.valor === atual)?.tom ?? 'ok';
  const rotulo = rotuloDoStatus(atual);

  const escolher = async (novo: StatusDoProprietario) => {
    if (novo === atual) return;
    const antes = atual;
    setAtual(novo);
    setSalvando(true);
    try {
      aoMudar?.(await propertyOwnersService.mudarStatus(id, novo));
    } catch {
      setAtual(antes);
      toast.error('Não foi possível trocar o status');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Status: ${rotulo}`} disabled={salvando}
          className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-60', TONS[tom])}>
          {rotulo}
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STATUS_DO_PROPRIETARIO.map(s => (
          <DropdownMenuItem key={s.valor} onClick={() => void escolher(s.valor)}
            className={s.valor === atual ? 'font-semibold' : undefined}>
            {s.rotulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
