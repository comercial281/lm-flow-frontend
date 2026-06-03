// Helpers do Tutorial — parser de video, slug, formatadores.
// Portado de lm-hub-conhecimento/src/pages/conhecimento/_internal/lib.ts.

export function parseVideoUrl(url: string): { provider: 'youtube' | 'vimeo'; id: string } | null {
  if (!url) return null;
  const trimmed = url.trim();
  const yt = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
  if (yt) return { provider: 'youtube', id: yt[1] };
  const vimeo = trimmed.match(/vimeo\.com\/(?:video\/|channels\/[\w-]+\/)?(\d+)/);
  if (vimeo) return { provider: 'vimeo', id: vimeo[1] };
  return null;
}

export function formatDuration(min: number | null | undefined): string {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
