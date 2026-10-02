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
// Dentro de um <form>, no computador, quem responde ao navegador (FormData,
// `required`) é um <select> escondido que espelha a escolha com o valor REAL. O
// select escondido do próprio Radix carregaria o valor interno da opção vazia e
// nunca barraria o `required`.
//
// `bare`: caixa sem o visual do design system e sem a seta, só a className de
// quem chama (status colorido, filtros com ícone próprio). A lista que abre é a
// do produto do mesmo jeito.
//
// `escuro`: a lista aberta sai no tema escuro mesmo com o app no claro. Para
// tela pintada de escuro à mão, que não segue o tema (primeiro acesso, janelas
// roxas do painel raiz): lá a lista clara destoava. No celular não muda nada.
import { useState, type ComponentProps, type CSSProperties, type SelectHTMLAttributes } from 'react';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import { usePonteiroDeToque } from '@/hooks/usePonteiroDeToque';
import {
  deRadix, eventoDeMudanca, lerItens, paraRadix, valorExibido, type OpcaoDoSeletor,
} from './seletorOpcoes';

export type SeletorProps = SelectHTMLAttributes<HTMLSelectElement> & { bare?: boolean; escuro?: boolean };

// A caixa do nativo, com a cara dos Inputs (era o NativeSelect de 04/08).
const CAIXA_NATIVA =
  'h-9 appearance-none truncate rounded-md border border-input bg-background px-3 text-sm ' +
  'shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring ' +
  'focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

// Seta do select nativo: chevron-down do lucide, desenhado como fundo.
const SETA_NATIVA: CSSProperties = {
  backgroundImage:
    'url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%2371717a%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27m6%209%206%206%206-6%27/%3E%3C/svg%3E")',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '1rem 1rem',
  backgroundPosition: 'right 0.625rem center',
};

// Tira o visual do design system no modo `bare`. A seta é o último svg.
const SEM_CAIXA =
  'h-auto gap-1 border-0 bg-transparent p-0 shadow-none dark:bg-transparent [&>svg:last-child]:hidden';

// No escuro o design system pinta o fundo no hover (`dark:hover:bg-input/50`).
// Sem caixa, o hover tem que manter o fundo de quem chama (o status colorido do
// interesse): repete o último fundo da className como `dark:hover:`. O
// tailwind-merge derruba o hover do design system, que é do mesmo grupo. Se o
// Tailwind não gerar a classe repetida (ela não aparece escrita no código), o
// hover não muda nada; se gerar, pinta a mesma cor. Dá no mesmo.
// Só fundo de cor: `bg-[url()]`, `bg-none` e `bg-gradient` não entram aqui.
function hoverSemMudanca(className = ''): string {
  const classes = className.split(/\s+/);
  const ultima = (prefixo: string) =>
    classes.filter(c => c.startsWith(prefixo) && !/^(dark:)?bg-(\[url|none|gradient|linear|radial|conic)/.test(c)).pop();
  const escuro = ultima('dark:bg-')?.slice('dark:'.length);
  return `dark:hover:${escuro ?? ultima('bg-') ?? 'bg-transparent'}`;
}

export function Seletor({
  bare = false, escuro = false, children, className, value, defaultValue, onChange,
  disabled, name, required, id, title, style, ...resto
}: SeletorProps) {
  const toque = usePonteiroDeToque();
  // Sem `value`, guarda a escolha aqui (o nativo faria o mesmo sozinho).
  const [interno, setInterno] = useState(defaultValue);

  if (toque) {
    const props = { ...resto, value, defaultValue, onChange, disabled, name, required, id, title };
    if (bare) return <select {...props} style={style} className={className}>{children}</select>;
    // Um <select> só, sem invólucro: as classes de layout da tela (flex-1,
    // w-48, col-span-*, m*-...) valem nele como valem no botão do computador.
    // A seta vai como imagem de fundo, em style: o twMerge trata bg-[url()] e
    // bg-background como o mesmo grupo e derrubaria um dos dois. E vai DEPOIS do
    // style da tela: o atalho `background` (janelas roxas do painel raiz) apaga a
    // imagem de fundo, e a lista ficava sem seta no celular.
    return (
      <select
        {...props}
        style={{ ...style, ...SETA_NATIVA }}
        className={cn(CAIXA_NATIVA, className, 'pr-8')}
      >
        {children}
      </select>
    );
  }

  const itens = lerItens(children);
  const atual = value !== undefined ? value : interno;
  const exibido = valorExibido(atual, itens);
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
    <>
      {/* Sem name/required aqui: quem fala com o <form> é o espelho abaixo. */}
      <Select value={exibido} onValueChange={mudar} disabled={disabled}>
        <SelectTrigger
          {...(resto as ComponentProps<typeof SelectTrigger>)}
          id={id}
          title={title}
          style={style}
          // Vence o data-size="default" do design system, que prende a altura
          // em h-9 por cima de qualquer classe da tela.
          data-size="livre"
          className={cn('h-9', bare && SEM_CAIXA, className, bare && hoverSemMudanca(className))}
        >
          <SelectValue />
        </SelectTrigger>
        {/* Acima de qualquer janela da casa (modais em z-[200], mapa em z-[1000]).
            `dark` na própria lista liga as cores do tema escuro só nela. */}
        <SelectContent className={cn('z-[1200]', escuro && 'dark')}>
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
      {(name !== undefined || required) && (
        <select
          aria-hidden
          tabIndex={-1}
          className="sr-only"
          name={name}
          required={required}
          disabled={disabled}
          value={deRadix(exibido)}
          onChange={() => {}}
        >
          {itens.flatMap(it => (it.tipo === 'opcao' ? [it] : it.opcoes)).map((o, i) => (
            <option key={`${o.valor}-${i}`} value={o.valor} disabled={o.desligada} />
          ))}
        </select>
      )}
    </>
  );
}
