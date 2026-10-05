// Vídeo e tour virtual da página do imóvel. Só vira iframe o endereço de um
// domínio conhecido (YouTube, Vimeo, Matterport), sempre remontado aqui a
// partir do id; qualquer outro http(s) vira um botão-link. O resto (vazio,
// `javascript:`, `data:`…) não aparece.

export type MidiaDoImovel = { tipo: 'embed'; src: string } | { tipo: 'link'; href: string } | null;

function urlHttp(raw: unknown): URL | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

const host = (u: URL) => u.hostname.toLowerCase().replace(/^(www|m)\./, '');
const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
const ID_VIMEO = /^\d+$/;
const ID_MATTERPORT = /^[A-Za-z0-9]+$/;

function idDoYoutube(u: URL): string | null {
  const h = host(u);
  const partes = u.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (h === 'youtu.be') id = partes[0] ?? null;
  else if (h === 'youtube.com') {
    if (partes[0] === 'watch') id = u.searchParams.get('v');
    else if (partes[0] === 'shorts' || partes[0] === 'embed') id = partes[1] ?? null;
  }
  return id && ID_YOUTUBE.test(id) ? id : null;
}

const HASH_VIMEO = /^[a-f0-9]+$/i;

// Vídeo não listado do Vimeo só toca com o hash: `vimeo.com/<id>?h=<hash>` ou o
// link de compartilhar `vimeo.com/<id>/<hash>`. O hash só passa se for hexa.
function srcDoVimeo(u: URL): string | null {
  if (host(u) !== 'vimeo.com') return null;
  const partes = u.pathname.split('/').filter(Boolean);
  if (!ID_VIMEO.test(partes[0] ?? '')) return null;
  let hash: string | null = null;
  if (partes.length === 2) {
    if (!HASH_VIMEO.test(partes[1])) return null;
    hash = partes[1];
  } else if (partes.length === 1) {
    const h = u.searchParams.get('h');
    hash = h && HASH_VIMEO.test(h) ? h : null;
  } else {
    return null;
  }
  const base = `https://player.vimeo.com/video/${partes[0]}`;
  return hash ? `${base}?h=${hash}` : base;
}

export function embedDoVideo(url: unknown): MidiaDoImovel {
  const u = urlHttp(url);
  if (!u) return null;
  const yt = idDoYoutube(u);
  if (yt) return { tipo: 'embed', src: `https://www.youtube-nocookie.com/embed/${yt}` };
  const vimeo = srcDoVimeo(u);
  if (vimeo) return { tipo: 'embed', src: vimeo };
  return { tipo: 'link', href: u.href };
}

export function embedDoTour(url: unknown): MidiaDoImovel {
  const u = urlHttp(url);
  if (!u) return null;
  const m = u.searchParams.get('m');
  const ehMatterport = u.hostname.toLowerCase() === 'my.matterport.com' && u.pathname.replace(/\/$/, '') === '/show';
  if (ehMatterport && m && ID_MATTERPORT.test(m)) {
    return { tipo: 'embed', src: `https://my.matterport.com/show/?m=${m}&play=1` };
  }
  return { tipo: 'link', href: u.href };
}
