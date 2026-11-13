import { DESTAQUE_SOBRE_O_CLARO } from './destaqueModerno';

/* Medidas que as seções do Início do Moderno dividem (protótipo `section.block`,
   `.wrap`, `.gutter`, `h2`, `.eyebrow`). Só variáveis do site e literais
   neutros: nada de color-mix nem opacidade sobre variável (Chrome < 111). */

/** Seção: 16px de lado (como o topo e a capa) e o respiro de cima do protótipo. */
export const BLOCO = 'px-4 pt-[clamp(64px,9vw,112px)]';
/** Miolo: até 1120px, alinhado ao cartão da capa e ao topo. */
export const MIOLO = 'mx-auto max-w-[1120px]';
/** Título de seção sobre o fundo claro, com o destaque do claro (tamanho do `h2` do protótipo, ou outro). */
export function tituloDeSecao(tamanho = 'text-[clamp(30px,4.2vw,50px)]'): string {
  return `font-[var(--display)] ${tamanho} font-semibold leading-[1.06] tracking-[-0.03em] text-[var(--m-head)] [text-wrap:balance] ${DESTAQUE_SOBRE_O_CLARO}`;
}
/** Linha pequena acima do título. */
export const SOBRETITULO = 'mb-3.5 text-[13px] font-semibold text-[var(--m-head)]';
/** Botão na cor principal (texto pelo contraste: `--brand-ink`). */
export const BOTAO_PRINCIPAL =
  'inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 py-3 text-[14px] font-semibold ' +
  'text-[var(--brand-ink)] transition-transform hover:-translate-y-px';
