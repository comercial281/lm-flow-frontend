// Helpers da Área de Membros (Academia).

import type { LockCtaType } from '@/hooks/useKnowledge';

// Monta o link do CTA do módulo/curso bloqueado.
// whatsapp -> wa.me com mensagem pronta · link -> URL direta · resto -> null.
export function buildLockCtaHref(
  ctaType: LockCtaType,
  ctaValue: string | null | undefined,
  titulo: string,
): string | null {
  const value = (ctaValue ?? '').trim();
  if (ctaType === 'whatsapp') {
    const digits = value.replace(/\D/g, '');
    if (!digits) return null;
    const msg = encodeURIComponent(`Olá! Quero liberar o acesso a "${titulo}" na área de membros.`);
    return `https://wa.me/${digits}?text=${msg}`;
  }
  if (ctaType === 'link') {
    if (!value) return null;
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// ID sentinela do "curso" virtual que agrupa módulos sem curso.
export const GERAL_COURSE_ID = '__geral__';
