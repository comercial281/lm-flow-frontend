import { MessageCircle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/ds';
import type { AutoAccessDetail, TeamAccessInbox } from '@/types/teamAccess';

/* Os números de uma pessoa, com a ORIGEM de cada acesso separada.
 *
 * Componente compartilhado de propósito entre a tela de Equipe e a aba de
 * atendentes de dentro do número: eram duas telas contando a mesma história de
 * dois jeitos, e é assim que elas voltam a divergir.
 *
 * A separação é a correção principal. Antes tudo virava uma caixinha marcada
 * igual, e o gestor lia "liberei três números pra ela" quando tinha liberado um
 * — os outros dois o sistema liberou sozinho para ela conseguir abrir o próprio
 * lead. Pior: desmarcar os automáticos é recusado de propósito lá atrás (senão
 * ela perde acesso ao lead que é dela), e a recusa era muda: a caixinha voltava
 * marcada sozinha no recarregamento.
 *
 * Agora a caixinha só existe para o que o gestor de fato controla, e o resto
 * aparece como selo, com o motivo escrito. */

export function autoAccessLabel(detail?: AutoAccessDetail): string {
  if (!detail) return 'liberado pelo sistema';
  if (detail.reason === 'leads') {
    return detail.leads === 1 ? 'é responsável por 1 lead daqui' : `é responsável por ${detail.leads} leads daqui`;
  }
  if (detail.reason === 'roleta') return 'recebe leads deste número pela roleta';
  return 'tem lead que não entrou por número nenhum';
}

interface InboxAccessListProps {
  inboxes: TeamAccessInbox[];
  /** números que um humano liberou — os únicos com caixinha */
  grantedIds: string[];
  /** números liberados pelo sistema, com o motivo */
  autoAccess: Record<string, AutoAccessDetail>;
  /** Administrador alcança tudo sem vínculo nenhum */
  seesAll?: boolean;
  disabled?: boolean;
  onToggle: (inboxId: string, on: boolean) => void;
}

export default function InboxAccessList({
  inboxes,
  grantedIds,
  autoAccess,
  seesAll = false,
  disabled = false,
  onToggle,
}: InboxAccessListProps) {
  if (seesAll) {
    return (
      <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        Administrador vê <strong>todas as instâncias</strong> automaticamente — não há o que liberar aqui.
      </p>
    );
  }

  if (inboxes.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma instância conectada ainda.</p>;
  }

  const granted = new Set(grantedIds.map(String));
  // Só o que o sistema liberou E o gestor ainda não assumiu: um número já
  // liberado na mão não precisa se explicar duas vezes na mesma tela.
  const autoOnly = inboxes.filter(ib => autoAccess[String(ib.id)] && !granted.has(String(ib.id)));

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Instâncias que você liberou
        </p>
        <div className="space-y-1.5">
          {inboxes.map(ib => {
            const id = String(ib.id);
            const on = granted.has(id);
            return (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/30"
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={disabled}
                  onChange={e => onToggle(id, e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="flex-1 text-sm">{ib.name}</span>
                <span className="text-xs text-muted-foreground">{ib.channel_type?.split('::')[1] ?? ''}</span>
              </label>
            );
          })}
        </div>
        <p className="pt-1.5 text-xs text-muted-foreground">
          Marcado = atende essa instância e entra na fila para receber leads novos dela.
        </p>
      </div>

      {autoOnly.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Acesso automático
          </p>
          <div className="space-y-1.5">
            {autoOnly.map(ib => (
              <div key={ib.id} className="flex items-center gap-2 text-sm">
                <MessageCircle className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                <span className="flex-1 truncate">{ib.name}</span>
                <Badge variant="outline" className="whitespace-nowrap text-[11px] font-normal text-muted-foreground">
                  {autoAccessLabel(autoAccess[String(ib.id)])}
                </Badge>
              </div>
            ))}
          </div>
          <p className="pt-2 text-xs text-muted-foreground">
            O sistema liberou sozinho para a pessoa conseguir abrir os leads que já são dela. Dentro dessas
            instâncias ela <strong>só vê os leads dela</strong> e <strong>não recebe leads novos</strong>. Para
            tirar o acesso, é preciso passar os leads para outra pessoa — ou marque a instância acima para ela
            passar a atendê-la de verdade.
          </p>
        </div>
      )}
    </div>
  );
}
