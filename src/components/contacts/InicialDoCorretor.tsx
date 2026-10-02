import { useState } from 'react';
import { cn } from '@/lib/utils';

// Fotinho de quem atende, ou a inicial quando não há foto. Usada na coluna
// Atendimento da lista e no Responsável do cadastro, pra pessoa se reconhecer
// do mesmo jeito nos dois.
export function inicialDe(nome?: string | null): string {
  return (nome ?? '').trim().charAt(0).toUpperCase() || '?';
}

interface Props {
  nome?: string | null;
  fotoUrl?: string | null;
  className?: string;
}

export default function InicialDoCorretor({ nome, fotoUrl, className }: Props) {
  // Foto quebrada (link vencido) cai pra inicial em vez de ícone de imagem partida.
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const base = 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full';

  if (fotoUrl && !fotoFalhou) {
    return (
      <img
        src={fotoUrl}
        alt=""
        aria-hidden="true"
        onError={() => setFotoFalhou(true)}
        className={cn(base, 'object-cover', className)}
      />
    );
  }
  return (
    <span aria-hidden="true" className={cn(base, 'bg-primary/10 text-[10px] font-semibold text-primary', className)}>
      {inicialDe(nome)}
    </span>
  );
}
