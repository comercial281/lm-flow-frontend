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
//
// JANELA DA CASA (peça 17 do GLOSSARIO, escolha do dono em 10/10/2026). Três
// coisas mudam aqui, uma vez só, e as ~190 janelas do app herdam sem ninguém
// mexer nelas:
//
// 1. TOPO E RODAPÉ FIXOS, SÓ O MEIO ROLA. A caixa limita a altura (90dvh) e
//    rola por dentro; o `DialogHeader` fica preso em cima e o `DialogFooter`
//    preso embaixo (`sticky`), cada um com fundo e linha,
//    ocupando a largura toda da caixa. Pra ocupar a largura toda, os dois
//    "comem" o respiro da caixa com margem negativa — e o respiro muda de janela
//    pra janela (p-6 na padrão; p-5/p-6/p-8 na larga; `p-0` em quem cuida do
//    próprio recheio). Por isso a caixa publica o respiro dela na variável
//    `--janela-p`, e o topo/rodapé usam `-mx-(--janela-p)`. Janela que já tem
//    rolagem própria (`overflow-hidden` + miolo com `overflow-y-auto`, ou
//    `max-h-*` próprio) continua mandando: a classe dela vem depois e o
//    tailwind-merge descarta a nossa.
//    O ponto onde grudam é `-(--janela-p)`, NÃO 0: o navegador mede o `sticky`
//    a partir de DENTRO do respiro da caixa que rola. Com `top-0`/`bottom-0` o
//    topo descia 24px e o rodapé subia 24px, cobrindo 8px do miolo em cada
//    ponta (rótulo do 1º campo e último item cortados, faixa vazia sobrando
//    acima do título e abaixo dos botões). Achado 11/10/2026 na Criar número.
//    O X de fechar mora DENTRO do topo quando há topo (senão rolaria pra fora
//    junto com o conteúdo). Como o topo vem antes do formulário, o X seria o
//    primeiro botão da janela e roubaria o foco de abertura do primeiro campo:
//    `aoAbrirFoco` refaz o que o Radix faz (foca o primeiro campo) pulando o X.
//    O nome do X passou de "Close" pra "Fechar".
//
// 2. NO CELULAR (< 640px) A JANELA SOBE DE BAIXO: presa embaixo, largura
//    inteira, cantos de cima arredondados, até 92dvh, animação subindo, alcinha
//    cinza decorativa no topo, botões do rodapé empilhados com largura inteira
//    (o principal em cima: o `flex-col-reverse` do pacote já faz isso) e o
//    rodapé respeitando a barra de gestos do iPhone (`safe-area-inset-bottom`).
//    O teto de largura inline (`style.maxWidth`, ver acima) ganharia de qualquer
//    classe; no celular ele cai com `max-w-none!` (important ganha de inline).
//
// 3. QUATRO LARGURAS: pequena 448 (`max-w-md`), padrão 512 (sem largura),
//    grande 672 (`max-w-2xl`), larga 1400 (`size="wide"`). A trava
//    `larguraDeJanela` do conferir-padrao reprova qualquer outra.
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ComponentRef,
  type CSSProperties,
} from 'react';
import { XIcon } from 'lucide-react';
import {
  DialogContent as BaseDialogContent,
  DialogHeader as BaseDialogHeader,
  DialogFooter as BaseDialogFooter,
  DialogDescription,
  DialogClose,
  AlertDialogContent as BaseAlertDialogContent,
  SheetContent as BaseSheetContent,
  SheetClose,
} from '@evoapi/design-system';

export * from '@evoapi/design-system';

type DialogContentProps = ComponentProps<typeof BaseDialogContent> & {
  /**
   * `wide` aplica o preset do modal grande (folga em volta + respiro interno +
   * teto de 1400px). É a 4ª largura da casa (editor, prévia, tabela, duas
   * colunas); não passe outro teto por cima.
   */
  size?: 'default' | 'wide';
  /**
   * Confirmação curta (só título, frase e botões): sem topo e rodapé fixos com
   * linha, tudo num bloco só, na largura pequena (`max-w-md`). Só quem pede.
   */
  compacta?: boolean;
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
// A variável `--janela-p` acompanha o respiro, pro topo e o rodapé saberem
// quanto "comer" pra encostar nas bordas.
const WIDE_PADDING = 'p-5 sm:p-6 lg:p-8 [--janela-p:1.25rem] sm:[--janela-p:1.5rem] lg:[--janela-p:2rem]';
// `p-` seguido de dígito ou `[`, para não casar com `px-6`/`py-4`/`pt-6`.
const UNPREFIXED_P = /(^|\s)!?p-(\d+(?:\.\d+)?|\[[^\]\s]+\]|px)(?=\s|$)/;

// Respiro que quem chama declarou (`p-0`, `p-4`, `p-[18px]`) em valor CSS, pra
// virar `--janela-p` inline. `null` quando a tela não declarou nenhum.
function respiroPedido(className: string): string | null {
  const m = className.match(UNPREFIXED_P);
  if (!m) return null;
  const v = m[2];
  if (v === 'px') return '1px';
  if (v.startsWith('[')) return v.slice(1, -1).replace(/_/g, ' ');
  return `${Number(v) * 0.25}rem`;
}

// Altura limitada + rolagem por dentro (o topo e o rodapé grudam nas bordas
// dessa rolagem). Quem pede `max-h-*` ou `overflow-*` próprio vence.
const ROLAGEM = 'max-h-[90dvh] overflow-y-auto';
// Respiro padrão da caixa do pacote (`p-6`), publicado pro topo e o rodapé.
const RESPIRO_PADRAO = '[--janela-p:1.5rem]';

// No celular (< 640px) a janela sobe de baixo. Tudo com `max-sm:`, então do
// `sm` pra cima nada muda. `max-w-none!` derruba o teto inline (`style`), que
// num aparelho entre 448 e 640px deixaria a janela estreita e colada à esquerda.
// A animação `janela-sobe` mora no globals.css (o pacote base usa as classes do
// tw-animate, que este app não carrega: a janela do computador aparece seca).
const CELULAR = [
  'max-sm:top-auto max-sm:bottom-0 max-sm:left-0',
  'max-sm:translate-x-0 max-sm:translate-y-0',
  'max-sm:w-full max-sm:max-w-none!',
  'max-sm:max-h-[92dvh]',
  'max-sm:rounded-t-2xl max-sm:rounded-b-none',
  'max-sm:border-x-0 max-sm:border-b-0',
  // sem rodapé fixo, o fim da janela não pode ficar embaixo da barra de gestos
  'max-sm:pb-[max(var(--janela-p),env(safe-area-inset-bottom))]',
  'max-sm:data-[state=open]:motion-safe:animate-janela-sobe',
].join(' ');

// Alcinha cinza no topo da janela do celular. Só enfeite (o arrastar pra
// fechar não existe): `aria-hidden` e sem clique.
function Alca() {
  return (
    <div
      aria-hidden="true"
      data-janela-alca=""
      className="pointer-events-none absolute top-2 left-1/2 z-20 h-1.5 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/30 sm:hidden"
    />
  );
}

// O X de fechar da casa (mesmo desenho do X do pacote, com nome em português).
// `data-janela-fechar` marca o X pra `aoAbrirFoco` pular ele.
const CLASSE_DO_X =
  'ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 z-20 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none';
function BotaoFechar() {
  return (
    <DialogClose data-janela-fechar="" className={CLASSE_DO_X}>
      <XIcon className="size-4" aria-hidden="true" />
      <span className="sr-only">Fechar</span>
    </DialogClose>
  );
}

// Foco de abertura sem o X. O Radix foca o primeiro elemento tabulável da
// janela; com o X no topo, esse elemento passaria a ser o X (e no computador
// quem abre "Novo lead" quer digitar o nome direto). Mesma régua do Radix
// (FocusScope): tabIndex >= 0, sem desabilitado, sem `input hidden`, sem link,
// visível. Nada focável além do X → foca o X; nem ele → a própria caixa.
function escondido(el: HTMLElement, caixa: HTMLElement): boolean {
  if (getComputedStyle(el).visibility === 'hidden') return true;
  for (let no: HTMLElement | null = el; no && no !== caixa; no = no.parentElement) {
    if (no.hidden || getComputedStyle(no).display === 'none') return true;
  }
  return false;
}
function focarPrimeiroCampo(caixa: HTMLElement) {
  const candidatos: HTMLElement[] = [];
  const andador = document.createTreeWalker(caixa, NodeFilter.SHOW_ELEMENT, {
    acceptNode: no => {
      const el = no as HTMLElement & { disabled?: boolean; type?: string };
      if (el.closest('[data-janela-fechar]')) return NodeFilter.FILTER_SKIP;
      if (el.disabled || (el.tagName === 'INPUT' && el.type === 'hidden')) return NodeFilter.FILTER_SKIP;
      return el.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  while (andador.nextNode()) candidatos.push(andador.currentNode as HTMLElement);
  for (const el of candidatos) {
    if (el.tagName === 'A' || escondido(el, caixa)) continue;
    el.focus({ preventScroll: true });
    if (document.activeElement === el) {
      if (el instanceof HTMLInputElement) el.select();
      return;
    }
  }
  const x = caixa.querySelector<HTMLElement>('[data-janela-fechar]');
  (x ?? caixa).focus({ preventScroll: true });
}

// O DialogContent avisa o topo (se pode pôr o X) e o rodapé (que estão numa
// janela da casa). Fora dele (`ctx` nulo), DialogHeader/DialogFooter são os do
// pacote, sem nada fixo.
type Janela = { fechar: boolean; topo: string | null; registrar: (id: string) => () => void };
const JanelaContexto = createContext<Janela | null>(null);
// Janela compacta: o topo não é fixo, mas o X mora no canto; o título desvia dele.
const CompactaContexto = createContext(false);

export const DialogContent = forwardRef<ComponentRef<typeof BaseDialogContent>, DialogContentProps>(
  ({ children, className, style, size = 'default', compacta = false, showCloseButton = true, onOpenAutoFocus, ...props }, ref) => {
    const clsPedida = typeof className === 'string' ? className : '';
    // A compacta traz a largura pequena (448px), a menos que a tela peça outra.
    const cls = compacta && !/(^|\s)max-w-/.test(clsPedida) ? `max-w-md ${clsPedida}` : clsPedida;
    const respiro = respiroPedido(cls);
    // O preset entra ANTES da className de quem chama: serve de padrão e nunca
    // atropela a tela que tem necessidade própria (`p-0`, outro teto, `h-*`).
    let injected = `${ROLAGEM} ${CELULAR}`;
    let maxWidth: string | null = null;
    if (size === 'wide') {
      injected += respiro ? ` ${WIDE}` : ` ${WIDE} ${WIDE_PADDING}`;
    } else {
      const uncap = uncapAt640(cls);
      if (uncap.extraClassName) injected += ` ${uncap.extraClassName}`;
      maxWidth = uncap.maxWidth;
      if (!respiro) injected += ` ${RESPIRO_PADRAO}`;
    }
    const estilo: CSSProperties = { ...(maxWidth ? { maxWidth } : {}), ...(respiro ? { '--janela-p': respiro } : {}), ...style } as CSSProperties;

    // Quem é o topo da janela (o primeiro DialogHeader montado): é nele que o X
    // mora. Sem topo, o X fica solto no canto, como antes.
    const [topos, setTopos] = useState<string[]>([]);
    const registrar = useCallback((id: string) => {
      setTopos(t => [...t, id]);
      return () => setTopos(t => t.filter(x => x !== id));
    }, []);
    const topo = topos[0] ?? null;
    const janela = useMemo(() => ({ fechar: showCloseButton, topo, registrar }), [showCloseButton, topo, registrar]);

    const aoAbrirFoco = (e: Event) => {
      onOpenAutoFocus?.(e);
      if (e.defaultPrevented) return;
      e.preventDefault();
      focarPrimeiroCampo(e.target as HTMLElement);
    };

    return (
      <BaseDialogContent
        ref={ref}
        className={`${injected} ${cls}`}
        style={Object.keys(estilo).length ? estilo : undefined}
        showCloseButton={false}
        onOpenAutoFocus={aoAbrirFoco}
        {...props}
      >
        <DialogDescription className="sr-only">Conteúdo do diálogo</DialogDescription>
        <CompactaContexto.Provider value={compacta}>
          <JanelaContexto.Provider value={compacta ? null : janela}>{children}</JanelaContexto.Provider>
        </CompactaContexto.Provider>
        {showCloseButton && (compacta || !topo) && <BotaoFechar />}
        <Alca />
      </BaseDialogContent>
    );
  },
);
DialogContent.displayName = 'DialogContent';

// Topo fixo: largura toda da caixa (come o respiro dela), fundo e linha embaixo.
// `pr-12` vem DEPOIS da classe de quem chama, pra o título nunca passar por
// baixo do X (um `px-6` da tela derrubaria o recuo).
// O recuo do texto acompanha o da caixa (24px na padrão, até 32px na larga) e
// nunca fica abaixo de 24px (janela `p-0` que usa o topo da casa).
const RECUO = 'px-[max(var(--janela-p),1.5rem)]';
// text-left! porque o text-center do pacote vence o sm:text-left dele (o CSS do
// app só gera o text-center, e vem depois). Título e frase do topo à esquerda.
const TOPO = `sticky -top-(--janela-p) z-10 -mx-(--janela-p) -mt-(--janela-p) border-b bg-background ${RECUO} py-4 text-left!`;

export function DialogHeader({ className, children, ...props }: ComponentProps<typeof BaseDialogHeader>) {
  const janela = useContext(JanelaContexto);
  const compacta = useContext(CompactaContexto);
  const id = useId();
  const registrar = janela?.registrar;
  useLayoutEffect(() => registrar?.(id), [registrar, id]);
  if (!janela) {
    return (
      <BaseDialogHeader className={`text-left! ${compacta ? 'pr-8 ' : ''}${className ?? ''}`} {...props}>
        {children}
      </BaseDialogHeader>
    );
  }
  const comX = janela.fechar && janela.topo === id;
  return (
    <BaseDialogHeader className={`${TOPO} ${className ?? ''}${comX ? ' pr-12' : ''}`} {...props}>
      {children}
      {comX && <BotaoFechar />}
    </BaseDialogHeader>
  );
}

// Rodapé fixo: largura toda, fundo e linha em cima. No celular os botões ficam
// empilhados com largura inteira (o `flex-col-reverse` do pacote estica os
// filhos e põe o último, a ação principal, em cima) e o rodapé desce até o fim
// da tela, com a barra de gestos do iPhone por dentro.
const RODAPE = [
  `sticky -bottom-(--janela-p) z-10 -mx-(--janela-p) -mb-(--janela-p) border-t bg-background ${RECUO} py-4`,
  // no celular o respiro de baixo da caixa é o maior entre ele e a barra de gestos
  'max-sm:-bottom-[max(var(--janela-p),env(safe-area-inset-bottom))]',
  'max-sm:-mb-[max(var(--janela-p),env(safe-area-inset-bottom))]',
  'max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))]',
].join(' ');

export function DialogFooter({ className, ...props }: ComponentProps<typeof BaseDialogFooter>) {
  const janela = useContext(JanelaContexto);
  return <BaseDialogFooter className={janela ? `${RODAPE} ${className ?? ''}` : className} {...props} />;
}

// Mesmo teto (`max-w-md` etc), mesmo bug: o AlertDialog do design system tem
// o MESMO `sm:max-w-lg` de base que o Dialog. Reusa o mesmo mecanismo — sem
// `size="wide"` aqui porque nenhum confirm-dialog do app pede modal grande.
// Ganha também a rolagem e o jeito do celular (sobe de baixo, com alcinha). O
// topo e o rodapé dela não ficam fixos: confirmação é curta.
type AlertDialogContentProps = ComponentProps<typeof BaseAlertDialogContent>;

export const AlertDialogContent = forwardRef<ComponentRef<typeof BaseAlertDialogContent>, AlertDialogContentProps>(
  ({ className, style, children, ...props }, ref) => {
    const { extraClassName, maxWidth } = typeof className === 'string'
      ? uncapAt640(className)
      : { extraClassName: '', maxWidth: null };
    const injected = `${ROLAGEM} ${CELULAR} ${RESPIRO_PADRAO}${extraClassName ? ` ${extraClassName}` : ''}`;
    return (
      <BaseAlertDialogContent
        ref={ref}
        className={`${injected} ${className ?? ''}`}
        style={maxWidth ? { maxWidth, ...style } : style}
        {...props}
      >
        {children}
        <Alca />
      </BaseAlertDialogContent>
    );
  },
);
AlertDialogContent.displayName = 'AlertDialogContent';

// O painel lateral (Sheet) do design system traz o botão de fechar com o nome
// "Close", em inglês, para o leitor de tela — e o botão é montado lá dentro,
// sem prop para trocar. Aqui o painel ganha o nosso botão "Fechar" (mesmo
// visual, mesma posição) e o do pacote some por CSS: ele é SEMPRE o último
// filho do painel (vem depois do conteúdo), daí o `[&>button:last-child]`. O
// nosso fica antes dele, então não casa com o seletor.
type SheetContentProps = ComponentProps<typeof BaseSheetContent>;

export const SheetContent = forwardRef<ComponentRef<typeof BaseSheetContent>, SheetContentProps>(
  ({ className, children, ...props }, ref) => (
    <BaseSheetContent ref={ref} className={`[&>button:last-child]:hidden ${className ?? ''}`} {...props}>
      {children}
      <SheetClose className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
        <XIcon className="size-4" aria-hidden="true" />
        <span className="sr-only">Fechar</span>
      </SheetClose>
    </BaseSheetContent>
  ),
);
SheetContent.displayName = 'SheetContent';

// ── Botão (peça 14 do GLOSSARIO, escolha do dono em 10/10/2026) ─────────────
// Bloco separado do Dialog de propósito: quem mexer na janela não esbarra aqui.
//
// O degradê roxo com sombra é do botão PRINCIPAL. A regra antiga do globals.css
// pintava qualquer `<button>` com `bg-primary` (filtro selecionado, pílula,
// alternador) e não alcançava o principal com `asChild` (vira `<a>`). O Button
// do pacote não marca a variante no HTML, então este embrulho marca:
// `data-slot="button"` e `data-variant` (sem variante = `default`). O CSS mira
// `[data-slot='button'][data-variant='default'].bg-primary`: quem trocou o fundo
// pela className (o tailwind-merge tira o `bg-primary`) também não ganha degradê.
// Botão de ligar/selecionar (`aria-pressed`) fica sem degradê mesmo em `default`.
//
// Use sempre `Button` daqui (`@/components/ui/ds`), nunca de
// `@evoapi/design-system/button`: o de lá não tem a marca e sai sem degradê.
import { Button as BaseButton } from '@evoapi/design-system';

// Tipado como o do pacote (`typeof BaseButton`): quem chama continua com a mesma
// inferência de antes (o `e` do onClick, por exemplo).
const ButtonDaCasa = forwardRef<HTMLButtonElement, ComponentProps<typeof BaseButton>>(({ variant, ...props }, ref) => (
  <BaseButton ref={ref} data-slot="button" data-variant={variant ?? 'default'} variant={variant} {...props} />
));
ButtonDaCasa.displayName = 'Button';
export const Button: typeof BaseButton = ButtonDaCasa;

// ── Esqueleto (Skeleton) cinza ───────────────────────────────────────────────
// O Skeleton do pacote nasce `bg-accent` (lavanda). A peça 13 do GLOSSARIO
// (escolha do dono em 10/10/2026) é o esqueleto CINZA: `bg-muted animate-pulse`,
// parado pra quem pediu menos movimento. A classe de quem chama vem depois e
// continua mandando (altura, largura, canto). Pra lista, cartão ou texto
// inteiro, prefira o `Carregando` de `@/components/base`, que já tem a forma.
import { Skeleton as SkeletonDoPacote } from '@evoapi/design-system';

export function Skeleton({ className, ...props }: ComponentProps<typeof SkeletonDoPacote>) {
  return <SkeletonDoPacote className={`bg-muted motion-reduce:animate-none ${className ?? ''}`} {...props} />;
}

// ── Caixinha (Checkbox) ──────────────────────────────────────────────────────
// Peça 24 do GLOSSARIO (escolha do dono em 21/10/2026): toda caixinha de marcar
// é esta, nunca `<input type="checkbox">` cru (que sai azul do Chrome, com o
// formato de cada navegador). O do pacote só pinta o roxo no "marcado"; aqui o
// "parcial" (`checked="indeterminate"`, quando só parte da lista está marcada)
// também fica roxo, com um traço no lugar do ✓.
import { Checkbox as CheckboxDoPacote } from '@evoapi/design-system';

const PARCIAL =
  'grid cursor-pointer place-content-center data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary ' +
  'data-[state=indeterminate]:text-primary-foreground [&[data-state=indeterminate]_svg]:hidden ' +
  "data-[state=indeterminate]:before:block data-[state=indeterminate]:before:h-0.5 data-[state=indeterminate]:before:w-2 data-[state=indeterminate]:before:rounded-full data-[state=indeterminate]:before:bg-current data-[state=indeterminate]:before:content-['']";

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxDoPacote>) {
  return <CheckboxDoPacote className={`${PARCIAL} ${className ?? ''}`} {...props} />;
}
