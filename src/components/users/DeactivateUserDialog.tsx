import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, UserX } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { NativeSelect } from '@/components/ui/native-select';
import { usersService } from '@/services/users';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { DeactivationPreview, DeactivationReason, User } from '@/types/users';
import {
  blockingReason,
  buildDeactivatePayload,
  canOfferDisconnect,
  transferCandidates,
} from '@/features/users/deactivation/deactivationRules';

interface Props {
  open: boolean;
  user: User | null;
  /** A equipe, para escolher quem fica com os leads. */
  users: User[];
  onClose: () => void;
  onDone: () => void;
}

const REASON_LABELS: Record<DeactivationReason, string> = {
  ferias: 'Férias',
  afastamento: 'Afastamento',
  saiu: 'Saiu da empresa',
};

/**
 * A janela de *Desativar corretor* — e ela mostra o ESTRAGO antes de confirmar.
 *
 * Isso não é enfeite: "desativar" não é uma chave, é um conjunto de portas
 * (roletas, acesso aos canais, ofertas em aberto, a carteira, o número dele), e
 * a que ficar de fora falha em silêncio. Listar o que a pessoa carrega é o que
 * impede a meia-desativação — a mesma doutrina da janela que paralisa o cliente
 * antes de apagá-lo.
 */
export default function DeactivateUserDialog({ open, user, users, onClose, onDone }: Props) {
  const [preview, setPreview] = useState<DeactivationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState<DeactivationReason>('saiu');
  const [transferToId, setTransferToId] = useState('');
  const [disconnectNumber, setDisconnectNumber] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    setPreview(null);
    setReason('saiu');
    setTransferToId('');
    setDisconnectNumber(false);
    setLoading(true);

    usersService
      .getDeactivationPreview(user.id)
      .then(setPreview)
      // Leitura de fundo NÃO grita: sem a prévia a janela ainda desativa, só não
      // mostra o que a pessoa carrega. Um toast vermelho aqui pintaria erro por
      // cima de uma janela que funciona.
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [open, user]);

  const candidates = useMemo(() => transferCandidates(users, user), [users, user]);
  const choice = { reason, transferToId: transferToId || null, disconnectNumber };
  const blocked = blockingReason(choice, preview);
  const offersDisconnect = canOfferDisconnect(preview);

  const confirm = async () => {
    if (!user || blocked) return;

    setSaving(true);
    try {
      await usersService.deactivate(user.id, buildDeactivatePayload(choice, preview));
      toast.success(
        transferToId
          ? `${user.name} foi desativado. Os leads dele estão sendo passados.`
          : `${user.name} foi desativado.`,
      );
      onDone();
    } catch (error) {
      // Clique explícito: o motivo do servidor aparece, nos DOIS formatos de
      // erro da API. Lendo só um, a recusa por cargo vira frase genérica e manda
      // procurar o problema no lugar errado.
      toast.error(apiErrorMessage(error, 'Não consegui desativar agora.'));
    } finally {
      setSaving(false);
    }
  };

  const linha = (rotulo: string, valor: number | null | undefined) =>
    valor === null || valor === undefined ? null : (
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{rotulo}</span>
        <span className="font-semibold">{valor}</span>
      </div>
    );

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            Desativar {user?.name}
          </DialogTitle>
          <DialogDescription>
            Ele perde o acesso na hora, sai de todas as roletas e para de receber aviso. O perfil
            continua, e o histórico dele nos cards e nos relatórios não muda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Vendo o que ele carrega...
            </div>
          ) : (
            preview && (
              <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3">
                {linha('Leads na carteira', preview.leads)}
                {linha('Conversas abertas', preview.open_conversations)}
                {linha('Ofertas esperando resposta dele', preview.pending_offers)}
                {preview.roletas.length > 0 && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Roletas</span>
                    <span className="text-right font-medium">{preview.roletas.join(', ')}</span>
                  </div>
                )}
                {offersDisconnect && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">WhatsApp exclusivo dele</span>
                    <span className="text-right font-medium">
                      {preview.exclusive_number?.name || preview.exclusive_number?.phone || 'sim'}
                    </span>
                  </div>
                )}
              </div>
            )
          )}

          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Motivo</span>
            <NativeSelect value={reason} onChange={e => setReason(e.target.value as DeactivationReason)}>
              {(Object.keys(REASON_LABELS) as DeactivationReason[]).map(key => (
                <option key={key} value={key}>
                  {REASON_LABELS[key]}
                </option>
              ))}
            </NativeSelect>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Os leads dele vão para</span>
            <NativeSelect value={transferToId} onChange={e => setTransferToId(e.target.value)}>
              <option value="">Deixar como estão (continuam com ele)</option>
              {candidates.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
            {transferToId && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                O atendimento passa a sair pelo número de quem recebe. O lead que responder na
                conversa antiga abre uma conversa nova no número anterior.
              </p>
            )}
          </label>

          {/* Só para número EXCLUSIVO. Num compartilhado, desconectar derrubaria
              o WhatsApp da imobiliária inteira — a opção nem se desenha. */}
          {offersDisconnect && (
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={disconnectNumber}
                onChange={e => setDisconnectNumber(e.target.checked)}
              />
              <span>
                Desconectar o WhatsApp dele
                <span className="block text-muted-foreground">
                  O número para de receber mensagem no CRM. Para voltar, alguém precisa ler o QR
                  code no aparelho.
                </span>
              </span>
            </label>
          )}

          {blocked && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{blocked}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={saving || Boolean(blocked)}>
            {saving ? 'Desativando...' : 'Desativar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
