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

// Responsável do card (raio-X de 10/10/2026). O corretor via o campo em BRANCO:
// o nome saía da lista de pessoas (GET /users), que o cargo dele não lê. Agora:
// - o nome vem do próprio card (`item.assignee`, que o servidor já manda), com a
//   lista só como complemento pro gestor;
// - quem não troca o responsável (não é gestor: mesma régua do servidor,
//   Visits::Visibility.manager? — administrador, suporte ou
//   `conversations.read_all`) vê só TEXTO, sem lista;
// - a própria pessoa aparece como "Você" (no texto, na lista e no escolhido).
export const VOCE = 'Você';
export const SEM_RESPONSAVEL = 'Sem responsável';

/** O que o campo escreve para o responsável escolhido. */
export function textoDoResponsavel({
  responsavelId,
  meuId,
  users,
  nomeDoResponsavel,
}: {
  responsavelId: string | null;
  meuId?: string | null;
  users: Pick<User, 'id' | 'name'>[];
  nomeDoResponsavel?: string | null;
}): string | undefined {
  if (!responsavelId) return SEM_RESPONSAVEL;
  if (meuId && responsavelId === meuId) return VOCE;
  return users.find(u => String(u.id) === responsavelId)?.name || nomeDoResponsavel || undefined;
}

interface CampoResponsavelProps {
  users: Pick<User, 'id' | 'name'>[];
  responsavelId: string | null;
  onTrocar: (userId: string) => void;
  carregando?: boolean;
  /** Gestor troca pela lista; os demais só leem. Sem a prop, a lista aparece. */
  podeTrocar?: boolean;
  /** Quem está logado: o responsável que é ela mesma vira "Você". */
  meuId?: string | null;
  /** Nome do responsável que veio no card (vale quando a lista não traz a pessoa). */
  nomeDoResponsavel?: string | null;
}

export function CampoResponsavel({
  users,
  responsavelId,
  onTrocar,
  carregando,
  podeTrocar = true,
  meuId = null,
  nomeDoResponsavel = null,
}: CampoResponsavelProps) {
  const texto = textoDoResponsavel({ responsavelId, meuId, users, nomeDoResponsavel });
  const rotulo = (
    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
      Responsável
      {carregando && <Loader2 className="h-3 w-3 animate-spin" />}
    </span>
  );

  if (!podeTrocar) {
    // Só texto: o corretor não troca o responsável. Responsável cujo nome não
    // chegou (raro) aparece como "—", nunca em branco.
    const lido = texto || '—';
    return (
      <div className="grid gap-1 min-w-0">
        {rotulo}
        <p className="flex h-10 min-w-0 items-center text-sm" title={lido}>
          <span className="block truncate">{lido}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-1 min-w-0">
      {rotulo}
      <Select value={responsavelId ?? 'unassigned'} onValueChange={onTrocar} disabled={carregando}>
        <SelectTrigger className="h-10 w-full min-w-0 overflow-hidden text-sm" title={texto}>
          <SelectValue placeholder={SEM_RESPONSAVEL} className="min-w-0">
            {texto ? <span className="block truncate">{texto}</span> : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">{SEM_RESPONSAVEL}</SelectItem>
          {users.map(u => (
            <SelectItem key={u.id} value={String(u.id)}>
              {meuId && String(u.id) === meuId ? VOCE : u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
