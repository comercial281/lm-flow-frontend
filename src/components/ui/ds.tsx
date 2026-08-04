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
import { forwardRef, type ComponentProps, type ComponentRef } from 'react';
import { DialogContent as BaseDialogContent, DialogDescription } from '@evoapi/design-system';

export * from '@evoapi/design-system';

type DialogContentProps = ComponentProps<typeof BaseDialogContent>;

// `max-w-*` sem `sm:`/`md:`/`lg:`/`!` na frente. O `(^|\s)` evita casar com o
// sufixo de coisas como `sm:max-w-lg`.
const UNPREFIXED_MAX_W = /(^|\s)!?max-w-/;
const UNCAP = 'sm:max-w-none w-[calc(100%-2rem)] sm:w-full';

export const DialogContent = forwardRef<ComponentRef<typeof BaseDialogContent>, DialogContentProps>(
  ({ children, className, ...props }, ref) => {
    const needsUncap = typeof className === 'string' && UNPREFIXED_MAX_W.test(className);
    return (
      <BaseDialogContent
        ref={ref}
        className={needsUncap ? `${UNCAP} ${className}` : className}
        {...props}
      >
        <DialogDescription className="sr-only">Conteúdo do diálogo</DialogDescription>
        {children}
      </BaseDialogContent>
    );
  },
);
DialogContent.displayName = 'DialogContent';
