import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { usersService } from '@/services/users';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { DeactivationPreview } from '@/types/users';
import { eraseVerdict, type DeactivatablePerson } from '@/features/users/deactivation/deactivationRules';

interface Props {
  open: boolean;
  user: DeactivatablePerson | null;
  onClose: () => void;
  onDone: () => void;
}

/**
 * A janela de *Excluir cadastro* — a que apaga DE VERDADE.
 *
 * Ela existe para UM caso: o cadastro criado errado, que nunca atendeu ninguém
 * (e-mail digitado errado no convite, pessoa que nunca entrou). Para todo o
 * resto o caminho é *Desativar*, e esta janela diz isso em vez de apagar.
 *
 * Quem decide se pode é o SERVIDOR, na prévia: ele conta leads, conversas,
 * mensagens, ofertas da roleta, cards, tarefas, visitas. A tela nunca oferece
 * o botão de apagar sem esse veredito — a versão antiga do endpoint apagava
 * gente com histórico e respondia "sucesso".
 */
export default function EraseUserDialog({ open, user, onClose, onDone }: Props) {
  const [preview, setPreview] = useState<DeactivationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    setPreview(null);
    setLoading(true);
    usersService
      .getDeactivationPreview(user.id)
      .then(setPreview)
      // Sem prévia o veredito é "não": a janela explica em vez de apagar no escuro.
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [open, user]);

  const verdict = eraseVerdict(preview);

  const confirm = async () => {
    if (!user || !verdict.allowed) return;

    setSaving(true);
    try {
      await usersService.deleteUser(user.id);
      toast.success(`O cadastro de ${user.name} foi apagado.`);
      onDone();
    } catch (error) {
      // Clique explícito: o motivo do servidor aparece, nos dois formatos de erro.
      toast.error(apiErrorMessage(error, 'Não consegui apagar agora.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Excluir o cadastro de {user?.name}
          </DialogTitle>
          <DialogDescription>
            Apaga o cadastro de verdade, sem volta. Só é possível para quem nunca foi usado no CRM:
            quem já atendeu algum lead deve ser desativado, para o histórico continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Conferindo se ele já foi usado...
            </div>
          ) : verdict.allowed ? (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              Ninguém encontrou lead, conversa, mensagem ou oferta no nome dele. Pode apagar: o e-mail
              fica livre para um cadastro novo.
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{verdict.reason}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {verdict.allowed ? 'Cancelar' : 'Fechar'}
          </Button>
          {verdict.allowed && (
            <Button variant="destructive" onClick={confirm} disabled={saving || loading}>
              {saving ? 'Apagando...' : 'Apagar cadastro'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
