// Wrapper do @evoapi/design-system: reexporta TUDO igual, mas troca o
// DialogContent por uma versão que injeta uma <DialogDescription> escondida
// (sr-only) quando o diálogo não tem uma. Isso mata o warning do Radix
// ("Missing Description or aria-describedby for {DialogContent}") em TODAS as
// telas sem precisar editar 147 arquivos nem mudar o visual.
//
// Se o diálogo já tem a sua própria DialogDescription, ela é montada depois e
// "vence" o aria-describedby (a injetada vira só um nó escondido inofensivo).
//
// O wrapper também destrava a LARGURA. O DialogContent do design system nasce
// com `sm:max-w-lg` na classe base, e o `cn()` (tailwind-merge) só resolve
// conflito entre classes do MESMO modificador: `max-w-2xl` e `sm:max-w-lg` são
// grupos diferentes, então as duas sobrevivem — e a variante `sm:` vem depois no
// CSS gerado, logo ela vence em QUALQUER tela >= 640px. Resultado: uns 40
// modais espalhados pelo app pediam 2xl/3xl/4xl/6xl e apareciam todos com 512px,
// virando uma coluna estreita e altíssima no monitor. Quem escreveu
// `sm:max-w-...` (pipelines, AgentWizardModal) escapou por acidente.
//
// CORREÇÃO 2026-08-19 (1ª tentativa): injetar `sm:max-w-none` pra derrubar o
// `sm:max-w-lg` da base. Só que `sm:max-w-none` não mira só no `sm:max-w-lg`
// — ele derruba QUALQUER regra de `max-width` ativa na mesma tela, incluindo
// o próprio `max-w-2xl` sem prefixo que o chamador pediu (as duas batem na
// mesma propriedade, dentro do mesmo breakpoint, e a regra com `sm:` sempre
// vem depois no CSS gerado — não tem como cancelar só uma das duas).
// Resultado: em qualquer tela >= 640px (ou seja, praticamente todo desktop),
// o modal perdia TODO teto de largura e esticava full-bleed.
//
// CORREÇÃO 2026-08-19 (2ª tentativa): espelhar o teto pedido em vez de
// cancelar pra "none" — `sm:!max-w-2xl` (mesmo valor, `!important`) montado
// via template string. Também não funcionou: o Tailwind só gera CSS pra
// classe que aparece LITERAL no código-fonte (ele varre texto, não executa
// JS) — `` `sm:!max-w-${valor}` `` nunca aparece inteira em lugar nenhum, só
// os pedaços separados, então a regra nunca é gerada e a classe fica morta
// no HTML. (O `sm:!max-w-2xl` chegou a "funcionar" num teste, mas só porque
// OUTRO arquivo do app já usava esse literal exato por coincidência — não é
// coisa que dá pra confiar pros outros valores.)
//
// CORREÇÃO 2026-08-19 (final): parar de brigar com classe Tailwind pra isso.
// O teto vai de `style` inline — `style` sempre ganha de classe (a única
// coisa que bate `style` é `!important`, e nada aqui usa isso), então não
// importa se o Tailwind gerou `sm:max-w-lg`, `max-w-[calc(100%-2rem)]` ou
// qualquer coisa: nosso `maxWidth` inline vence em QUALQUER tela, sem
// depender de breakpoint, ordem de CSS ou o scanner do Tailwind ter visto a
// classe. Só injetamos quando o chamador de fato pediu uma largura sem
// prefixo — senão os diálogos que não pedem nada perderiam o teto padrão e
// virariam faixas de ponta a ponta.
//
// Junto vai a folga do CELULAR. A base segura a margem lateral com
// `max-w-[calc(100%-2rem)]`, mas esse é o MESMO grupo do `max-w-2xl` do
// chamador — o tailwind-merge descarta a base e o modal colaria nas duas
// bordas da tela. Recuperamos a folga pelo grupo `w-*`, que nenhum desses
// modais disputa: uma `w-[calc(100%-2.5rem)]` PLANA (sem `sm:`) resolve os
// dois tamanhos de tela sozinha, porque quem trava o teto agora é o
// `maxWidth` inline, não mais uma classe por breakpoint — em tela pequena a
// largura calculada é menor que o teto (a margem manda), em tela grande é
// maior (o teto manda). Quem define o próprio `w-` (MacroFormModal,
// AgentWizardModal) continua vencendo, porque vem depois na string.
//
// Por fim, `size="wide"` é o preset do MODAL GRANDE (cadastrar imóvel, funil de
// follow-up, ficha do contato, importar imóveis, site builder...). Antes cada
// tela escrevia a própria largura em PORCENTAGEM da janela (94vw, 95vw, 96vw), e
// porcentagem não deixa folga: 96% de 1440px são 20px de cada lado, e quanto
// maior o monitor, mais colado o modal fica na borda. O preset troca isso por
// uma folga FIXA (20px no celular, 48px do tablet pra cima) mais um teto de
// 1400px, então a folga só cresce — nunca some. Junto vai o respiro de dentro
// (a base traz `p-6`, que é pouco para uma janela de 1400px de largura).
import { forwardRef, type ComponentProps, type ComponentRef } from 'react';
import {
  DialogContent as BaseDialogContent,
  DialogDescription,
  AlertDialogContent as BaseAlertDialogContent,
} from '@evoapi/design-system';

export * from '@evoapi/design-system';

type DialogContentProps = ComponentProps<typeof BaseDialogContent> & {
  /**
   * `wide` aplica o preset do modal grande (folga em volta + respiro interno +
   * teto de 1400px). Quem precisar de outro teto passa `sm:max-w-*` na
   * className, que vence porque vem depois na string.
   */
  size?: 'default' | 'wide';
};

// `max-w-*` sem `sm:`/`md:`/`lg:`/`!` na frente, capturando o valor (lg, 2xl,
// [600px]...). O `(^|\s)` evita casar com o sufixo de coisas como `sm:max-w-lg`.
const UNPREFIXED_MAX_W = /(^|\s)!?max-w-(\S+)/;

// Escala padrão de container do Tailwind (bate com os tokens `--container-*`
// definidos no @theme de globals.css). Cobre os nomes usados nos ~40 modais
// do app; quem usa `max-w-[valor]` (colchete) não passa por aqui — o valor
// já vem pronto pra virar CSS.
const CONTAINER_REM: Record<string, number> = {
  '3xs': 16, '2xs': 18, xs: 20, sm: 24, md: 28, lg: 32, xl: 36,
  '2xl': 42, '3xl': 48, '4xl': 56, '5xl': 64, '6xl': 72, '7xl': 80,
};

// Resolve um token de `max-w-*` pra um valor CSS de `maxWidth`. `null` quando
// não reconhece o token (aí não injeta nada e o Tailwind segue mandando).
function resolveMaxWidth(token: string): string | null {
  const bracket = token.match(/^\[(.+)\]$/);
  if (bracket) return bracket[1].replace(/_/g, ' ');
  if (token === 'none') return 'none';
  if (token === 'full') return '100%';
  if (token in CONTAINER_REM) return `${CONTAINER_REM[token]}rem`;
  return null;
}

// O teto pedido vira `style.maxWidth` em vez de classe Tailwind — ver o
// porquê no comentário grande acima (`style` inline ganha de qualquer classe
// não-important, em qualquer tela, sem depender do scanner do Tailwind ter
// visto a classe). A margem lateral no celular segue por classe normal
// (`w-[calc(100%-2.5rem)]`), que já é uma string ESTÁTICA — essa o Tailwind
// enxerga e gera de boa.
function uncapAt640(className: string): { extraClassName: string; maxWidth: string | null } {
  const match = className.match(UNPREFIXED_MAX_W);
  if (!match) return { extraClassName: '', maxWidth: null };
  return { extraClassName: 'w-[calc(100%-2.5rem)]', maxWidth: resolveMaxWidth(match[2]) };
}

// ATENÇÃO à mistura de prefixos: o teto do preset é `sm:max-w-[1400px]`, NUNCA
// `sm:max-w-none` + um teto sem prefixo. Os dois sobreviveriam ao tailwind-merge
// (grupos diferentes) e a regra com `sm:` vence em qualquer tela >= 640px,
// soltando a largura. O `sm:max-w-*` daqui é o que derruba o `sm:max-w-lg` da base.
const WIDE = [
  // folga entre o modal e a borda da tela: 20px no celular, 48px daí pra cima
  'w-[calc(100%-2.5rem)] sm:w-[calc(100%-6rem)]',
  'max-w-[calc(100%-2.5rem)] sm:max-w-[1400px]',
  // `dvh`, não `vh`: no celular o `vh` ignora a barra do navegador e joga o
  // rodapé do modal (onde ficam Salvar/Cancelar) para fora da área visível.
  'max-h-[92dvh]',
  'rounded-xl',
].join(' ');

// O respiro de dentro vai SEPARADO porque `p-0` não desliga `sm:p-6`: para o
// tailwind-merge são grupos diferentes (modificadores diferentes), então os dois
// sobrevivem e a variante `sm:` vence em qualquer tela >= 640px. Um modal que
// pede `p-0` para cuidar do próprio recheio (ficha do contato, testar agente)
// acabaria com padding duplicado no computador. Por isso: se quem chama declara
// o próprio `p-*` sem prefixo, o preset não injeta padding nenhum.
const WIDE_PADDING = 'p-5 sm:p-6 lg:p-8';
// `p-` seguido de dígito ou `[`, para não casar com `px-6`/`py-4`/`pt-6`.
const UNPREFIXED_P = /(^|\s)!?p-(\d|\[)/;

export const DialogContent = forwardRef<ComponentRef<typeof BaseDialogContent>, DialogContentProps>(
  ({ children, className, style, size = 'default', ...props }, ref) => {
    // O preset entra ANTES da className de quem chama: serve de padrão e nunca
    // atropela a tela que tem necessidade própria (`p-0`, outro teto, `h-*`).
    let injected = '';
    let maxWidth: string | null = null;
    if (size === 'wide') {
      injected = typeof className === 'string' && UNPREFIXED_P.test(className)
        ? WIDE
        : `${WIDE} ${WIDE_PADDING}`;
    } else if (typeof className === 'string') {
      const uncap = uncapAt640(className);
      injected = uncap.extraClassName;
      maxWidth = uncap.maxWidth;
    }
    return (
      <BaseDialogContent
        ref={ref}
        className={injected ? `${injected} ${className ?? ''}` : className}
        style={maxWidth ? { maxWidth, ...style } : style}
        {...props}
      >
        <DialogDescription className="sr-only">Conteúdo do diálogo</DialogDescription>
        {children}
      </BaseDialogContent>
    );
  },
);
DialogContent.displayName = 'DialogContent';

// Mesmo teto (`max-w-md` etc), mesmo bug: o AlertDialog do design system tem
// o MESMO `sm:max-w-lg` de base que o Dialog. Reusa o mesmo mecanismo — sem
// `size="wide"` aqui porque nenhum confirm-dialog do app pede modal grande.
type AlertDialogContentProps = ComponentProps<typeof BaseAlertDialogContent>;

export const AlertDialogContent = forwardRef<ComponentRef<typeof BaseAlertDialogContent>, AlertDialogContentProps>(
  ({ className, style, ...props }, ref) => {
    const { extraClassName, maxWidth } = typeof className === 'string'
      ? uncapAt640(className)
      : { extraClassName: '', maxWidth: null };
    return (
      <BaseAlertDialogContent
        ref={ref}
        className={extraClassName ? `${extraClassName} ${className ?? ''}` : className}
        style={maxWidth ? { maxWidth, ...style } : style}
        {...props}
      />
    );
  },
);
AlertDialogContent.displayName = 'AlertDialogContent';
