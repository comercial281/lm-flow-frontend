// Extração determinística das cores da logo (canvas, client-side).
// Usada pelo Site Builder: sobe a logo → preenche cor primária/destaque sozinho.
// Sem IA: quantiza os pixels por matiz e pega as cores dominantes saturadas,
// ignorando fundo (transparente / quase-branco / quase-preto).

interface Rgb { r: number; g: number; b: number }

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function toHex(rgb: Rgb): string {
  const c = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${c(rgb.r)}${c(rgb.g)}${c(rgb.b)}`.toUpperCase();
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Extrai { primary, accent } (hex) de um arquivo de imagem local.
 * - primary: cor dominante mais saturada da logo.
 * - accent: segunda cor de matiz distinto; sem segunda cor → variação da primária.
 * Retorna null quando a logo não tem cor utilizável (ex.: 100% preto e branco).
 */
export async function extractLogoColors(file: File): Promise<{ primary: string; accent: string } | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('imagem inválida'));
      el.src = url;
    });

    const SIZE = 64;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

    // Buckets de 15° de matiz; peso = saturação (cores vivas dominam sobre cinzas).
    const BUCKETS = 24;
    const weight = new Array<number>(BUCKETS).fill(0);
    const sumR = new Array<number>(BUCKETS).fill(0);
    const sumG = new Array<number>(BUCKETS).fill(0);
    const sumB = new Array<number>(BUCKETS).fill(0);
    const count = new Array<number>(BUCKETS).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue; // transparente = fundo
      const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
      const { h, s, l } = rgbToHsl(rgb);
      if (l > 0.93 || l < 0.07) continue; // quase branco/preto = fundo ou traço
      if (s < 0.15) continue;             // cinza não vira cor de marca
      const bucket = Math.min(BUCKETS - 1, Math.floor((h / 360) * BUCKETS));
      weight[bucket] += s;
      sumR[bucket] += rgb.r;
      sumG[bucket] += rgb.g;
      sumB[bucket] += rgb.b;
      count[bucket] += 1;
    }

    const ranked = weight
      .map((w, idx) => ({ w, idx }))
      .filter(x => x.w > 0)
      .sort((a, b) => b.w - a.w);
    if (ranked.length === 0) return null;

    const avg = (idx: number): Rgb => ({
      r: sumR[idx] / count[idx],
      g: sumG[idx] / count[idx],
      b: sumB[idx] / count[idx],
    });

    const primaryIdx = ranked[0].idx;
    const primaryRgb = avg(primaryIdx);
    const primaryHue = rgbToHsl(primaryRgb).h;

    // Accent: próximo bucket relevante com matiz a 40°+ de distância e peso >= 10% do primário.
    const accentEntry = ranked.slice(1).find(x =>
      hueDistance((x.idx + 0.5) * (360 / BUCKETS), primaryHue) >= 40 && x.w >= ranked[0].w * 0.1
    );

    let accentRgb: Rgb;
    if (accentEntry) {
      accentRgb = avg(accentEntry.idx);
    } else {
      // Sem segunda cor na logo: accent = primária clareada (mantém a família).
      accentRgb = {
        r: primaryRgb.r + (255 - primaryRgb.r) * 0.25,
        g: primaryRgb.g + (255 - primaryRgb.g) * 0.25,
        b: primaryRgb.b + (255 - primaryRgb.b) * 0.25,
      };
    }

    return { primary: toHex(primaryRgb), accent: toHex(accentRgb) };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
