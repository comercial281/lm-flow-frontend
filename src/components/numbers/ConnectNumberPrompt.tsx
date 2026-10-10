import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import numbersService from '@/services/numbers/numbersService';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useAuthStore } from '@/store/authStore';
import { plural } from '@/lib/formato';
import type { OwnedNumber } from '@/features/numbers/types';

/** "Depois" vale só para a sessão do navegador: volta na próxima até conectar. */
export const DISMISS_KEY = 'lmflow:connect-number-dismissed';

function dismissedInSession(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Quem ganhou um número e ainda não leu o QR code vê este convite ao entrar.
 * Leitura de fundo, uma vez por montagem; falha é silenciosa e nada trava o
 * layout. Só abre depois do tour de boas-vindas, para não empilhar janelas.
 */
export default function ConnectNumberPrompt() {
  const navigate = useNavigate();
  const isSupport = useIsSuperAdmin();
  const userId = useAuthStore(s => s.currentUser?.id);
  const welcomeDone = useAuthStore(s => !!s.tours['onboarding:welcome']);
  const [pending, setPending] = useState<OwnedNumber[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId || isSupport || dismissedInSession()) return;
    let alive = true;
    numbersService
      .myNumbers()
      .then(res => {
        if (!alive) return;
        // O número principal vem primeiro: é o que a pessoa mais precisa conectar.
        const list = res.numbers
          .filter(n => n.never_connected === true && n.connection !== 'connected')
          .sort((a, b) => Number(b.principal) - Number(a.principal));
        setPending(list);
        setOpen(list.length > 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, isSupport]);

  if (!welcomeDone || isSupport || pending.length === 0 || !open) return null;

  const first = pending[0];
  const extra = pending.length - 1;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sem armazenamento: só fecha agora */
    }
    setOpen(false);
  };
  const later = dismiss;

  const connect = () => {
    // Quem foi conectar não precisa do convite de novo ao voltar nesta sessão.
    dismiss();
    navigate(`/channels/${first.inbox_id}/settings?tab=configuration&connect=1`);
  };

  return (
    <Dialog open onOpenChange={o => !o && later()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left space-y-2">
          <DialogTitle>Conecte seu número</DialogTitle>
          <DialogDescription>
            O número {first.name} está esperando você ler o QR code com o seu celular.
            {extra > 0 && ` Você tem mais ${plural(extra, 'número', 'números')} para conectar.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={later}>Depois</Button>
          <Button onClick={connect}>Conectar agora</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
