import type { CSSProperties } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import logoDark from '../assets/LM_Flow.svg';
import logoLight from '../assets/LM_Flow_light.svg';

interface AppLogoProps {
  className?: string;
  alt?: string;
  style?: CSSProperties;
  forceTheme?: 'dark' | 'light';
}

export function AppLogo({ className, alt = 'LM Flow', style, forceTheme }: AppLogoProps) {
  const { theme } = useDarkMode();
  const effectiveTheme = forceTheme ?? theme;
  const src = effectiveTheme === 'dark' ? logoDark : logoLight;

  return <img src={src} alt={alt} className={className} style={style} />;
}
