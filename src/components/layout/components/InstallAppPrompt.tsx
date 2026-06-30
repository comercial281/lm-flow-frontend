import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/ds';

// Banner "Instalar na tela inicial" (PWA).
// - Android/Chrome: captura beforeinstallprompt e instala com 1 toque.
// - iOS Safari: não dispara beforeinstallprompt → mostra instrução manual
//   (Compartilhar → Adicionar à Tela de Início). No iPhone é PRÉ-REQUISITO
//   pra notificação push funcionar (iOS só permite web push em PWA instalado).
// Some quando já está instalado (standalone) ou após dispensar (14 dias).

const DISMISS_KEY = 'lmflow_install_dismissed_at';
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function recentlyDismissed(): boolean {
  const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return ts > 0 && Date.now() - ts < DISMISS_MS;
}

export default function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    // iOS Safari: sem beforeinstallprompt — oferece a instrução manual.
    if (isIos()) setShow(true);

    const onInstalled = () => {
      setShow(false);
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!show) return null;

  const ios = isIos();

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      if (choice.outcome === 'accepted') setShow(false);
    } else if (ios) {
      setIosHelp(v => !v);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 md:inset-x-auto md:right-4 md:w-96">
      <div className="rounded-xl border border-primary/50 bg-card shadow-2xl ring-1 ring-primary/15 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Instalar o LM Flow</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ios
                ? 'Adicione à tela inicial pra abrir como app e receber notificações de lead novo.'
                : 'Tenha o CRM na tela inicial e receba alertas de lead novo na hora.'}
            </p>
            {iosHelp && (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                No Safari: toque em <Share className="inline h-3.5 w-3.5 align-text-bottom" />{' '}
                <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Abra o LM Flow
                pelo ícone novo pra ligar o Modo Plantão.
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={install} className="cursor-pointer">
                {ios ? 'Como instalar' : 'Instalar app'}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} className="cursor-pointer">
                Agora não
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
