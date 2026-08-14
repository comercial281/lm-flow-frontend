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
// A correção é injetar `sm:max-w-none` ANTES da className de quem chama: aí o
// tailwind-merge derruba o `sm:max-w-lg` da base e o `max-w-*` sem prefixo passa
// a valer em todas as larguras. Só injetamos quando o chamador de fato pediu uma
// largura sem prefixo — senão os diálogos que não pedem nada perderiam o teto
// padrão e virariam faixas de ponta a ponta.
//
// Junto vai a folga do CELULAR. A base segura a margem lateral com
// `max-w-[calc(100%-2rem)]`, mas esse é o MESMO grupo do `max-w-2xl` do
// chamador — o tailwind-merge descarta a base e o modal cola nas duas bordas da
// tela. Como a largura mobile aqui é `w-full`, dá pra recuperar a folga pelo
// grupo `w-*` (`w-[calc(100%-2rem)]`, liberado de volta em `sm:`), que nenhum
// desses modais disputa. Quem define o próprio `w-` (MacroFormModal,
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
import { DialogContent as BaseDialogContent, DialogDescription } from '@evoapi/design-system';

export * from '@evoapi/design-system';

type DialogContentProps = ComponentProps<typeof BaseDialogContent> & {
  /**
   * `wide` aplica o preset do modal grande (folga em volta + respiro interno +
   * teto de 1400px). Quem precisar de outro teto passa `sm:max-w-*` na
   * className, que vence porque vem depois na string.
   */
  size?: 'default' | 'wide';
};

// `max-w-*` sem `sm:`/`md:`/`lg:`/`!` na frente. O `(^|\s)` evita casar com o
// sufixo de coisas como `sm:max-w-lg`.
const UNPREFIXED_MAX_W = /(^|\s)!?max-w-/;
const UNCAP = 'sm:max-w-none w-[calc(100%-2.5rem)] sm:w-full';

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
  ({ children, className, size = 'default', ...props }, ref) => {
    // O preset entra ANTES da className de quem chama: serve de padrão e nunca
    // atropela a tela que tem necessidade própria (`p-0`, outro teto, `h-*`).
    const injected = size === 'wide'
      ? (typeof className === 'string' && UNPREFIXED_P.test(className)
          ? WIDE
          : `${WIDE} ${WIDE_PADDING}`)
      : typeof className === 'string' && UNPREFIXED_MAX_W.test(className)
        ? UNCAP
        : '';
    return (
      <BaseDialogContent
        ref={ref}
        className={injected ? `${injected} ${className ?? ''}` : className}
        {...props}
      >
        <DialogDescription className="sr-only">Conteúdo do diálogo</DialogDescription>
        {children}
      </BaseDialogContent>
    );
  },
);
DialogContent.displayName = 'DialogContent';
