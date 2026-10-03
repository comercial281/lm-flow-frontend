// Prévia da marca d'água na tela — mesma geometria do Sites::WatermarkRenderer
// (40% da largura no centro, 22% nos cantos, margem de 3%).
import type { CSSProperties } from 'react';
import type { SiteWatermark } from '@/services/siteBuilder/siteBuilderService';

export function estiloDaMarca(position: SiteWatermark['position'], opacity: number): CSSProperties {
  const o = Math.min(100, Math.max(10, opacity)) / 100;
  const base: CSSProperties = { position: 'absolute', opacity: o, height: 'auto' };
  switch (position) {
    case 'top_left': return { ...base, width: '22%', left: '3%', top: '3%' };
    case 'top_right': return { ...base, width: '22%', right: '3%', top: '3%' };
    case 'bottom_left': return { ...base, width: '22%', left: '3%', bottom: '3%' };
    case 'bottom_right': return { ...base, width: '22%', right: '3%', bottom: '3%' };
    default: return { ...base, width: '40%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }
}
