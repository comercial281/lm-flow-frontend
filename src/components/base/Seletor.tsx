// src/components/base/Seletor.tsx
// Lista de escolha da casa. Recebe o MESMO que um <select> (value, onChange com
// e.target.value, <option>/<optgroup> como filhos), então trocar uma tela é só
// trocar a tag.
//
// No computador desenha a lista do produto (Select do design system); no
// celular, a lista do sistema (a rodinha do iPhone, a lista do Android), que é
// melhor com o polegar. Antes cada tela escolhia: metade abria a lista cinza do
// sistema operacional no computador — a do Windows inclusive. Decisão do dono
// em 02/10/2026; spec em LM FLOW/specs/2026-10-02-seletor-unico-design.md.
//
// `bare`: caixa sem o visual do design system e sem a seta, só a className de
// quem chama (status colorido, filtros com ícone próprio). A lista que abre é a
// do produto do mesmo jeito.
import { useState, type ComponentProps, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import { usePonteiroDeToque } from '@/hooks/usePonteiroDeToque';
import {
  deRadix, eventoDeMudanca, lerItens, paraRadix, valorExibido, type OpcaoDoSeletor,
} from './seletorOpcoes';

export type SeletorProps = SelectHTMLAttributes<HTMLSelectElement> & { bare?: boolean };

// A caixa do nativo, com a cara dos Inputs (era o NativeSelect de 04/08).
const CAIXA_NATIVA =
  'h-9 w-full appearance-none truncate rounded-md border border-input bg-background px-3 text-sm ' +
  'shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring ' +
  'focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

// Tira o visual do design system no modo `bare`. A seta é o último svg.
const SEM_CAIXA =
  'h-auto gap-1 border-0 bg-transparent p-0 shadow-none dark:bg-transparent ' +
  'dark:hover:bg-transparent [&>svg:last-child]:hidden';

export function Seletor({
  bare = false, children, className, value, defaultValue, onChange,
  disabled, name, required, id, title, style, ...resto
}: SeletorProps) {
  const toque = usePonteiroDeToque();
  // Sem `value`, guarda a escolha aqui (o nativo faria o mesmo sozinho).
  const [interno, setInterno] = useState(defaultValue);

  if (toque) {
    const props = { ...resto, value, defaultValue, onChange, disabled, name, required, id, title, style };
    if (bare) return <select {...props} className={className}>{children}</select>;
    return (
      <div className={cn('relative inline-flex max-w-full', /\bw-full\b/.test(className ?? '') && 'w-full')}>
        <select {...props} className={cn(CAIXA_NATIVA, className, 'pr-8')}>{children}</select>
        {/* pointer-events-none: o clique atravessa e abre o select. */}
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50"
        />
      </div>
    );
  }

  const itens = lerItens(children);
  const atual = value !== undefined ? value : interno;
  const mudar = (radix: string) => {
    const novo = deRadix(radix);
    if (value === undefined) setInterno(novo);
    onChange?.(eventoDeMudanca(novo, name));
  };
  const item = (o: OpcaoDoSeletor, i: number) => (
    <SelectItem key={`${o.valor}-${i}`} value={paraRadix(o.valor)} disabled={o.desligada} style={o.estilo}>
      {o.rotulo}
    </SelectItem>
  );

  return (
    <Select
      value={valorExibido(atual, itens)}
      onValueChange={mudar}
      disabled={disabled}
      name={name}
      required={required}
    >
      <SelectTrigger
        {...(resto as ComponentProps<typeof SelectTrigger>)}
        id={id}
        title={title}
        style={style}
        // Vence o data-size="default" do design system, que prende a altura
        // em h-9 por cima de qualquer classe da tela.
        data-size="livre"
        className={cn('h-9', bare && SEM_CAIXA, className)}
      >
        <SelectValue />
      </SelectTrigger>
      {/* Acima de qualquer janela da casa (modais em z-[200], mapa em z-[1000]). */}
      <SelectContent className="z-[1200]">
        {itens.map((it, i) =>
          it.tipo === 'opcao' ? (
            item(it, i)
          ) : (
            <SelectGroup key={`grupo-${i}`}>
              <SelectLabel>{it.rotulo}</SelectLabel>
              {it.opcoes.map(item)}
            </SelectGroup>
          ),
        )}
      </SelectContent>
    </Select>
  );
}
