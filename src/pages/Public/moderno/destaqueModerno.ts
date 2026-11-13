import type { DestaqueDosTitulos } from '@/features/siteBuilder/public/aparenciaConfig';

/* Aparência do trecho em destaque (`<TituloComDestaque>` -> `[data-destaque]`)
   no Moderno, num lugar só pras seções dele dividirem (spec 6.1).
   Vão no className do contêiner do título: variantes do Tailwind, sem CSS
   global nem color-mix. A Instrument Serif só carrega com o itálico ligado
   (portalShared, fontHrefs). */

/** Título sobre a cor principal: accent = o trecho na cor de destaque; itálico = serifada na cor do texto do bloco. */
export const DESTAQUE_SOBRE_A_COR =
  '[&_[data-destaque=accent]]:text-[var(--accent)] ' +
  '[&_[data-destaque=italic]]:italic [&_[data-destaque=italic]]:font-normal [&_[data-destaque=italic]]:text-[var(--brand-ink)] ' +
  '[&_[data-destaque=italic]]:[font-family:Instrument_Serif,Georgia,serif]';

/**
 * Título sobre fundo claro (seções do Início): accent = o trecho na cor do
 * título com um sublinhado grosso na cor de destaque (nunca texto na cor de
 * destaque sobre o claro, por contraste); itálico = serifada num tom mais
 * claro da principal (`--m-head-2`). Medidas do protótipo (`.hl`).
 */
export const DESTAQUE_SOBRE_O_CLARO =
  '[&_[data-destaque=accent]]:[background-image:linear-gradient(var(--accent),var(--accent))] ' +
  '[&_[data-destaque=accent]]:bg-no-repeat [&_[data-destaque=accent]]:[background-size:100%_0.12em] ' +
  '[&_[data-destaque=accent]]:[background-position:0_94%] [&_[data-destaque=accent]]:pb-[0.04em] ' +
  '[&_[data-destaque=italic]]:italic [&_[data-destaque=italic]]:font-normal [&_[data-destaque=italic]]:tracking-[-0.005em] ' +
  '[&_[data-destaque=italic]]:text-[var(--m-head-2)] [&_[data-destaque=italic]]:[font-family:Instrument_Serif,Georgia,serif]';

/** Título sobre a foto da capa: accent = o trecho na cor de destaque; itálico = serifada em branco. */
export const DESTAQUE_SOBRE_A_FOTO =
  '[&_[data-destaque=accent]]:text-[var(--accent)] ' +
  '[&_[data-destaque=italic]]:italic [&_[data-destaque=italic]]:font-normal [&_[data-destaque=italic]]:text-white ' +
  '[&_[data-destaque=italic]]:[font-family:Instrument_Serif,Georgia,serif]';

/**
 * Números grandes (Como funciona, faixa de números): sans firme ou, com o
 * destaque em itálico, serifada itálica e um pouco maior (protótipo `.num`).
 */
export function classeDoNumero(modo: DestaqueDosTitulos, tamanhos: { firme: string; italico: string }): string {
  return modo === 'italic'
    ? `[font-family:Instrument_Serif,Georgia,serif] italic font-normal tracking-[-0.01em] ${tamanhos.italico}`
    : `font-[var(--display)] font-semibold tracking-[-0.03em] ${tamanhos.firme}`;
}
