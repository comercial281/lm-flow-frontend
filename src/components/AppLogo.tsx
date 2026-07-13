import type { CSSProperties } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';

interface AppLogoProps {
  className?: string;
  alt?: string;
  style?: CSSProperties;
  forceTheme?: 'dark' | 'light';
}

/**
 * Wordmark "LM FLOW" em SVG (sem o balão): LM na cor do tema, FLOW no gradiente
 * violeta da marca. Fundo transparente — nunca destoa do sistema. Escala pela
 * altura (className h-8/h-10/...) igual à imagem antiga via viewBox.
 */
export function AppLogo({ className, alt = 'LM Flow', style, forceTheme }: AppLogoProps) {
  const { theme } = useDarkMode();
  const effectiveTheme = forceTheme ?? theme;
  const lmColor = effectiveTheme === 'dark' ? '#FFFFFF' : '#191233';
  const font = "'Poppins','Inter',system-ui,-apple-system,'Segoe UI',sans-serif";

  return (
    <svg
      viewBox="0 0 140 34"
      className={className}
      style={style}
      role="img"
      aria-label={alt}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="lmf-wordmark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="55%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      <text x="0" y="26" fontFamily={font} fontSize="28" fontWeight="700" letterSpacing="0.3" fill={lmColor}>LM</text>
      <text x="51" y="26" fontFamily={font} fontSize="28" fontWeight="700" letterSpacing="0.3" fill="url(#lmf-wordmark-grad)">FLOW</text>
    </svg>
  );
}
