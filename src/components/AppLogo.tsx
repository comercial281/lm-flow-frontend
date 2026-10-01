import type { CSSProperties } from 'react';
import { useId } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';

interface AppLogoProps {
  className?: string;
  alt?: string;
  style?: CSSProperties;
  forceTheme?: 'dark' | 'light';
}

// Traços do logo "LM Flow" (símbolo + texto em curvas, sem depender de fonte).
// Fonte de verdade: public/brand/lmflow-logo.svg — mudou lá, muda aqui.
const SYMBOL_INK =
  'M48 48L48 142A14 14 0 0 0 62 156L140 156A10 10 0 0 1 150 166L150 194A10 10 0 0 1 140 204L46 204A46 46 0 0 1 0 158L0 90A42 42 0 0 1 42 48Z';
const SYMBOL_ACCENT =
  'M172 156L172 62A14 14 0 0 0 158 48L80 48A10 10 0 0 1 70 38L70 10A10 10 0 0 1 80 0L174 0A46 46 0 0 1 220 46L220 114A42 42 0 0 1 178 156Z';
const WORD_LM =
  'M281 184V38.1H307.3V159.9H372.5V184ZM388 184V38.1H416.5L460.6 103.3L504.6 38.1H533.1V184H506.8V79.5L460.6 147.6L414.3 79.7V184Z';
const WORD_FLOW =
  'M588 184V38.1H680.1V62.2H614.3V100.2H669.8V124.3H614.3V184ZM693 184V38.1H718.4V184ZM783.2 186.5Q767.3 186.5 755.1 179.5Q742.9 172.5 735.9 160.2Q729 147.9 729 131.9Q729 115.8 735.8 103.5Q742.6 91.2 754.9 84.3Q767.1 77.3 782.7 77.3Q798.6 77.3 810.8 84.3Q823 91.2 829.9 103.5Q836.7 115.8 836.7 131.9Q836.7 147.9 829.9 160.2Q823.1 172.5 810.9 179.5Q798.8 186.5 783.2 186.5ZM783.2 163.1Q791.3 163.1 797.5 159.1Q803.7 155.1 807.2 148.1Q810.8 141.1 810.8 131.9Q810.8 122.7 807.2 115.7Q803.7 108.7 797.3 104.7Q791 100.7 782.8 100.7Q774.6 100.7 768.3 104.7Q762 108.7 758.5 115.7Q754.9 122.7 754.9 131.9Q754.9 141.1 758.5 148.1Q762.1 155.1 768.5 159.1Q774.9 163.1 783.2 163.1ZM875.4 184 840 79.8H865.8L888.5 149.7L911.5 79.8H936.5L959.1 148.6L982 79.8H1007.8L972.3 184H947.2L924 111.4L900.6 184Z';

/**
 * Logo "LM Flow": símbolo (dois "L" encaixados) + texto. O "LM" e a metade
 * escura do símbolo seguem o tema (azul-marinho no claro, branco no escuro);
 * o roxo é fixo. Fundo transparente. Escala pela altura (className h-8/h-10/...).
 * Tela com fundo escuro FIXO (login, cadastro, convite) passa forceTheme="dark",
 * senão quem usa o tema claro vê o "LM" azul-marinho sumir no fundo.
 */
export function AppLogo({ className, alt = 'LM Flow', style, forceTheme }: AppLogoProps) {
  const { theme } = useDarkMode();
  const effectiveTheme = forceTheme ?? theme;
  const ink = effectiveTheme === 'dark' ? '#FFFFFF' : '#1B153D';
  const uid = useId().replace(/:/g, '');
  const symbolGrad = `lmf-s-${uid}`;
  const wordGrad = `lmf-w-${uid}`;

  return (
    <svg
      viewBox="0 0 1009 206"
      className={className}
      style={style}
      role="img"
      aria-label={alt}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={symbolGrad} cx="205" cy="18" r="175" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D088F7" />
          <stop offset=".4" stopColor="#A563F2" />
          <stop offset=".68" stopColor="#874DEE" />
          <stop offset=".85" stopColor="#5D2FD9" />
          <stop offset="1" stopColor="#5226D4" />
        </radialGradient>
        <linearGradient id={wordGrad} x1="588" y1="34" x2="770" y2="250" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#CF80F2" />
          <stop offset=".55" stopColor="#8A4BEC" />
          <stop offset="1" stopColor="#5528D8" />
        </linearGradient>
      </defs>
      <path fill={ink} d={SYMBOL_INK} />
      <path fill={`url(#${symbolGrad})`} d={SYMBOL_ACCENT} />
      <path fill={ink} d={WORD_LM} />
      <path fill={`url(#${wordGrad})`} d={WORD_FLOW} />
    </svg>
  );
}
