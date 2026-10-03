import type { Secao, SecaoId } from '@/features/properties/cadastro/secoesDoCadastro';

// Índice das seções. No computador é uma coluna que acompanha a rolagem; no
// celular vira uma faixa de atalhos no topo, que rola na horizontal.
export default function IndiceDoCadastro({ secoes, ativa, aoEscolher }: {
  secoes: Secao[];
  ativa: SecaoId | null;
  aoEscolher: (id: SecaoId) => void;
}) {
  return (
    <nav
      aria-label="Seções do cadastro"
      className="sticky top-0 z-10 -mx-4 overflow-x-auto border-b bg-background px-4 py-2 sm:-mx-6 sm:px-6 lg:top-4 lg:mx-0 lg:self-start lg:overflow-visible lg:border-b-0 lg:bg-transparent lg:p-0"
    >
      <ul className="flex gap-1 lg:flex-col">
        {secoes.map(s => {
          const marcada = s.id === ativa;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#secao-${s.id}`}
                aria-current={marcada ? 'true' : undefined}
                onClick={e => { e.preventDefault(); aoEscolher(s.id); }}
                className={`block whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${marcada ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                {s.titulo}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
