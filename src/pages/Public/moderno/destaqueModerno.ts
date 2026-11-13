/* Aparência do trecho em destaque (`<TituloComDestaque>` -> `[data-destaque]`)
   no Moderno, num lugar só pras seções dele dividirem (spec 6.1).
   Vão no className do contêiner do título: variantes do Tailwind, sem CSS
   global nem color-mix. A Instrument Serif só carrega com o itálico ligado
   (portalShared, fontHrefs). */

/** Título sobre a cor principal: accent = o trecho na cor de destaque; itálico = serifada branca. */
export const DESTAQUE_SOBRE_A_COR =
  '[&_[data-destaque=accent]]:text-[var(--accent)] ' +
  '[&_[data-destaque=italic]]:italic [&_[data-destaque=italic]]:font-normal [&_[data-destaque=italic]]:text-white ' +
  '[&_[data-destaque=italic]]:[font-family:Instrument_Serif,Georgia,serif]';
