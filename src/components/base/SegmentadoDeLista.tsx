import type { LucideIcon } from 'lucide-react';

export interface OpcaoDoSegmentado<T extends string> {
  id: T;
  rotulo: string;
  icone?: LucideIcon;
  /** Ativa em laranja, sem o degradê (Arquivadas: é o significado dela). */
  laranja?: boolean;
}

export interface SegmentadoDeListaProps<T extends string> {
  opcoes: OpcaoDoSegmentado<T>[];
  valor: T;
  aoEscolher: (id: T) => void;
  /** Nome do grupo pra leitor de tela ("Filtrar conversas"). */
  rotulo: string;
  /** As opções dividem a largura toda (Conversas); sem isso, cada uma do tamanho do texto (Contatos). */
  cheio?: boolean;
}

/**
 * Filtro rápido de Conversas e Contatos (peça 6 do GLOSSARIO): recorta a mesma
 * lista, não é aba. Vidro violeta (30/10/2026): grupo de vidro claro, opção ativa
 * com o degradê da marca (globals.css, "Segmentado de lista").
 */
export default function SegmentadoDeLista<T extends string>({ opcoes, valor, aoEscolher, rotulo, cheio = false }: SegmentadoDeListaProps<T>) {
  return (
    <div role="group" aria-label={rotulo} className="segmentado flex items-center gap-1 border">
      {opcoes.map(({ id, rotulo: texto, icone: Icone, laranja }) => {
        const ativa = valor === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={ativa}
            data-laranja={laranja ? '' : undefined}
            onClick={() => aoEscolher(id)}
            className={`segmentado-opcao flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium ${cheio ? 'flex-1 px-2' : 'px-3'} ${
              ativa && laranja ? 'bg-orange-100 text-orange-700 shadow-sm dark:bg-orange-950/40 dark:text-orange-400' : ''
            }`}
          >
            {Icone && <Icone className="h-3 w-3" aria-hidden="true" />}
            {texto}
          </button>
        );
      })}
    </div>
  );
}
