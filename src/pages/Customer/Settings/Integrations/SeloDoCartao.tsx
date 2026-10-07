import type { LucideIcon } from 'lucide-react';

// Logo (ou ícone) do cartão de Integrações num quadrado. Decorativo: o nome do
// cartão está sempre escrito ao lado.
export default function SeloDoCartao({ logo, icone: Icone, tamanho }: {
  logo?: string;
  icone?: LucideIcon;
  tamanho: 'grande' | 'pequeno';
}) {
  const caixa = tamanho === 'grande' ? 'h-11 w-11 rounded-xl' : 'h-7 w-7 rounded-md';
  const miolo = tamanho === 'grande' ? 'h-6 w-6' : 'h-4 w-4';
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center bg-primary/10 text-primary ${caixa}`}>
      {logo ? <img src={logo} alt="" className={`${miolo} object-contain`} /> : Icone ? <Icone className={miolo} /> : null}
    </span>
  );
}
