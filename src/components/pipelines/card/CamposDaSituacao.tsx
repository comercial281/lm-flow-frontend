import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/ds';
import type { PipelineStage } from '@/types/analytics';
import type { User } from '@/types/users';

// Etapa e Responsável da janela do card (E0 do funil, 07/10/2026).
//
// O gatilho do Select do design system é `flex whitespace-nowrap` e o valor
// dele é `flex` sem `min-w-0`: nome comprido passava da caixa. Aqui o gatilho
// fica preso à coluna (`min-w-0 overflow-hidden`), o texto corta com
// reticências (`truncate`) e o nome inteiro vai no `title` do gatilho.

interface CampoEtapaProps {
  stages: PipelineStage[];
  etapaId: string | null;
  onMover: (stageId: string) => void;
  disabled?: boolean;
}

export function CampoEtapa({ stages, etapaId, onMover, disabled }: CampoEtapaProps) {
  const atual = stages.find(s => String(s.id) === etapaId);
  return (
    <div className="grid gap-1 min-w-0">
      <span className="text-xs font-medium text-muted-foreground">Etapa</span>
      <Select value={etapaId ?? undefined} onValueChange={onMover} disabled={disabled}>
        <SelectTrigger className="h-10 w-full min-w-0 overflow-hidden text-sm" title={atual?.name}>
          <SelectValue placeholder="Escolha a etapa" className="min-w-0">
            {atual && (
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: atual.color }} />
                <span className="truncate">{atual.name}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {stages.map(stage => (
            <SelectItem key={stage.id} value={stage.id.toString()}>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                {stage.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface CampoResponsavelProps {
  users: Pick<User, 'id' | 'name'>[];
  responsavelId: string | null;
  onTrocar: (userId: string) => void;
  carregando?: boolean;
}

export function CampoResponsavel({ users, responsavelId, onTrocar, carregando }: CampoResponsavelProps) {
  const nome = responsavelId ? users.find(u => String(u.id) === responsavelId)?.name : undefined;
  // Responsável que a lista de pessoas ainda não trouxe: o Select mostra o nome
  // sozinho (comportamento de antes), sem o corte nem o title.
  const texto = responsavelId ? nome : 'Sem responsável';
  return (
    <div className="grid gap-1 min-w-0">
      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        Responsável
        {carregando && <Loader2 className="h-3 w-3 animate-spin" />}
      </span>
      <Select value={responsavelId ?? 'unassigned'} onValueChange={onTrocar} disabled={carregando}>
        <SelectTrigger className="h-10 w-full min-w-0 overflow-hidden text-sm" title={texto}>
          <SelectValue placeholder="Sem responsável" className="min-w-0">
            {texto ? <span className="block truncate">{texto}</span> : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Sem responsável</SelectItem>
          {users.map(u => (
            <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
