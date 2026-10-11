import React from 'react';
import { Button } from '@/components/ui/ds';
import Faixa from '@/components/base/Faixa';
import type { TomDoAviso } from '@/components/base/Aviso';

interface BannerProps {
  /**
   * Main banner message text
   */
  bannerMessage: string;

  /**
   * Optional external link
   */
  hrefLink?: string;

  /**
   * Link text to display
   */
  hrefLinkText?: string;

  /**
   * Optional action button
   */
  hasActionButton?: boolean;

  /**
   * Action button label
   */
  actionButtonLabel?: string;

  /**
   * Action button click handler
   */
  onPrimaryAction?: () => void;

  /**
   * Color scheme of the banner
   * @default 'alert'
   */
  colorScheme?: 'primary' | 'secondary' | 'alert' | 'warning';
}

const Banner: React.FC<BannerProps> = ({
  bannerMessage,
  hrefLink,
  hrefLinkText,
  hasActionButton = false,
  actionButtonLabel,
  onPrimaryAction,
  colorScheme = 'alert',
}) => {
  // Faixa da casa (GLOSSARIO → As peças da casa, 12): o esquema de cor vira tom.
  const tomDoEsquema: Record<NonNullable<BannerProps['colorScheme']>, TomDoAviso> = {
    primary: 'info',
    secondary: 'neutro',
    alert: 'erro',
    warning: 'atencao',
  };

  return (
    <Faixa
      tom={tomDoEsquema[colorScheme]}
      acao={
        hasActionButton && actionButtonLabel ? (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onPrimaryAction}>
            {actionButtonLabel}
          </Button>
        ) : undefined
      }
    >
      <span className="banner-message">
        {bannerMessage}
        {hrefLink && hrefLinkText && (
          <>
            {' '}
            <a
              href={hrefLink}
              rel="noopener noreferrer nofollow"
              target="_blank"
              className="underline hover:opacity-80 transition-opacity"
            >
              {hrefLinkText}
            </a>
          </>
        )}
      </span>
    </Faixa>
  );
};

export default Banner;
