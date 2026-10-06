import type { MouseEvent } from 'react';
import { LogIn } from 'lucide-react';

// Entrar no cliente: o mesmo botão do login (degradê com o brilho passando,
// .lmf-btn-shimmer em styles/globals.css). Usado no cartão e no topo da página.
export default function BotaoEntrar({ aoClicar, desabilitado, entrando }: {
  aoClicar: (e: MouseEvent<HTMLButtonElement>) => void; desabilitado?: boolean; entrando?: boolean;
}) {
  return (
    <button type="button" disabled={desabilitado || entrando} onClick={aoClicar}
      className="lmf-btn-shimmer inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
      <LogIn className="h-4 w-4" /> {entrando ? 'Entrando…' : 'Entrar'}
    </button>
  );
}
