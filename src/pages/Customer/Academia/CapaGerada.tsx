// Capa montada com o nome quando o curso/módulo não tem imagem (antes era um
// chapéu genérico). A cor sai do id, então o mesmo curso tem sempre a mesma.

import { cn } from '@/lib/utils';

const FUNDOS = [
  'from-primary via-primary/80 to-violet-950',
  'from-sky-600 via-primary/80 to-primary',
  'from-amber-500 via-primary/70 to-primary',
];

export default function CapaGerada({ titulo, semente, className }: { titulo: string; semente: string; className?: string }) {
  const i = [...semente].reduce((s, c) => s + c.charCodeAt(0), 0) % FUNDOS.length;
  return (
    // O nome sai de um pseudo-elemento (data-titulo): é só enfeite da capa e não
    // duplica o título do cartão pra leitor de tela nem pra busca por texto.
    <div aria-hidden="true" data-titulo={titulo}
      className={cn('flex h-full w-full items-end bg-gradient-to-br p-4 after:line-clamp-2 after:max-w-[16ch] after:text-lg after:font-extrabold after:leading-tight after:text-white after:drop-shadow after:content-[attr(data-titulo)]', FUNDOS[i], className)} />
  );
}
