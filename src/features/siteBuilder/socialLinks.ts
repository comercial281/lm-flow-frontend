// Redes sociais do Meu site: aceita @usuário, usuário ou link, grava link.
export type RedeSocial = 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'tiktok';

export const REDES: { id: RedeSocial; rotulo: string; exemplo: string }[] = [
  { id: 'instagram', rotulo: 'Instagram', exemplo: '@suaimobiliaria' },
  { id: 'facebook', rotulo: 'Facebook', exemplo: 'facebook.com/suaimobiliaria' },
  { id: 'youtube', rotulo: 'YouTube', exemplo: '@suaimobiliaria' },
  { id: 'linkedin', rotulo: 'LinkedIn', exemplo: 'linkedin.com/company/suaimobiliaria' },
  { id: 'tiktok', rotulo: 'TikTok', exemplo: '@suaimobiliaria' },
];

const BASE: Record<RedeSocial, (u: string) => string> = {
  instagram: u => `https://instagram.com/${u}`,
  facebook: u => `https://facebook.com/${u}`,
  youtube: u => `https://www.youtube.com/@${u}`,
  linkedin: u => `https://linkedin.com/in/${u}`,
  tiktok: u => `https://www.tiktok.com/@${u}`,
};

export function linkDaRede(rede: RedeSocial, entrada: string): string | null {
  const v = entrada.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/\.[a-z]{2,}\//i.test(v) || /^[\w-]+\.(com|com\.br|be)\b/i.test(v)) return `https://${v}`;
  return BASE[rede](v.replace(/^@/, ''));
}
