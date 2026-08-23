// Overlay de conteúdo bloqueado — cadeado + mensagem + CTA (whatsapp/link/texto).

import { Lock } from 'lucide-react';
import type { LockCtaType } from '@/hooks/useKnowledge';
import { buildLockCtaHref } from './_lib';

interface LockInfo {
  titulo: string;
  lock_cta_type: LockCtaType;
  lock_cta_label: string | null;
  lock_cta_value: string | null;
  lock_message: string | null;
}

// Botão/CTA do bloqueio — reutilizado no card e na tela cheia.
export function LockCta({ lock, className }: { lock: LockInfo; className?: string }) {
  if (lock.lock_cta_type === 'none') return null;
  const label = lock.lock_cta_label?.trim() || (lock.lock_cta_type === 'whatsapp' ? 'Liberar acesso' : 'Saiba mais');
  const href = buildLockCtaHref(lock.lock_cta_type, lock.lock_cta_value, lock.titulo);

  if (lock.lock_cta_type === 'text' || !href) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 text-white ${className ?? ''}`}>
        <Lock size={12} /> {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition ${className ?? ''}`}
    >
      <Lock size={12} /> {label}
    </a>
  );
}

// Tela cheia de bloqueio (mostrada no lugar do player quando o módulo é restrito).
export default function LockOverlay({ lock }: { lock: LockInfo }) {
  return (
    <div className="h-full min-h-[300px] flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
          <Lock size={30} className="text-primary" />
        </div>
        <h2 className="text-lg font-bold mb-2">Conteúdo bloqueado</h2>
        <p className="text-sm text-muted-foreground mb-5">
          {lock.lock_message?.trim() ||
            `O acesso a "${lock.titulo}" ainda não está liberado pra você. Fale com a gente pra desbloquear.`}
        </p>
        <LockCta lock={lock} />
      </div>
    </div>
  );
}
