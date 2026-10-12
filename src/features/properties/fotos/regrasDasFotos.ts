// Regras da página de fotos e vídeos do imóvel (12/10/2026). Puras, com spec.
// A ordem gravada é "todas as fotos, depois vídeos e áudios" (decisão do dono):
// só vale quando alguém mexe; imóvel antigo fica como está até lá.
import { arrayMove } from '@dnd-kit/sortable';
import {
  ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  type PropertyPhoto,
} from '@/services/propertyPhotos/propertyPhotosService';
import { ABA_NA_URL, type ListingKind } from '@/features/properties/listingKind';
import { ehVideoOuAudio } from './ordemDasFotos';

export { ehVideoOuAudio, idDaCapa, moverParaCapa, posicoes } from './ordemDasFotos';

export interface Separadas {
  imagens: PropertyPhoto[];
  midias: PropertyPhoto[];
}

export function separar(fotos: PropertyPhoto[]): Separadas {
  return {
    imagens: fotos.filter(p => !ehVideoOuAudio(p)),
    midias: fotos.filter(p => ehVideoOuAudio(p)),
  };
}

export const juntar = (imagens: PropertyPhoto[], midias: PropertyPhoto[]): PropertyPhoto[] => [...imagens, ...midias];

export function moverNoGrupo(grupo: PropertyPhoto[], deId: string, paraId: string): PropertyPhoto[] | null {
  if (deId === paraId) return null;
  const de = grupo.findIndex(p => p.id === deId);
  const para = grupo.findIndex(p => p.id === paraId);
  if (de < 0 || para < 0) return null;
  return arrayMove(grupo, de, para);
}

export type AbaDasFotos = 'tudo' | 'fotos' | 'midias' | 'ocultas';

export function daAba(sep: Separadas, aba: AbaDasFotos): Separadas {
  if (aba === 'fotos') return { imagens: sep.imagens, midias: [] };
  if (aba === 'midias') return { imagens: [], midias: sep.midias };
  if (aba === 'ocultas') return { imagens: sep.imagens.filter(p => !p.published), midias: sep.midias.filter(p => !p.published) };
  return sep;
}

export function contagens(fotos: PropertyPhoto[]): Record<AbaDasFotos, number> {
  const { imagens, midias } = separar(fotos);
  return { tudo: fotos.length, fotos: imagens.length, midias: midias.length, ocultas: fotos.filter(p => !p.published).length };
}

// ── O vídeo que a IA manda ───────────────────────────────────────────────────
// Espelho de SalesAgents::PropertyPhotoPack#video (lm-flow): o 1º vídeo
// publicado, MP4, com tamanho conhecido de até 16 MB. Mudou lá, muda aqui.
export const LIMITE_DO_VIDEO_DA_IA = 16 * 1024 * 1024;

export type SituacaoDoVideo = 'manda' | 'soUmVideo' | 'formato' | 'grande' | 'semTamanho';

export const TEXTO_DO_VIDEO: Record<SituacaoDoVideo, string> = {
  manda: 'Este é o vídeo que a IA manda',
  soUmVideo: 'A IA manda um vídeo só: o primeiro da lista que cabe no WhatsApp',
  formato: 'A IA não manda: o WhatsApp só toca MP4. No site aparece normal.',
  grande: 'A IA não manda: passa de 16 MB. No site aparece normal.',
  semTamanho: 'A IA não manda: não sabemos o tamanho deste vídeo.',
};

export const ehVideo = (p: PropertyPhoto): boolean =>
  (p.content_type ?? '').startsWith('video/') || p.photo_type === 'video';

function ehMp4(p: PropertyPhoto): boolean {
  const tipo = (p.content_type ?? '').trim().toLowerCase();
  if (tipo) return tipo === 'video/mp4';
  return [p.file_name, p.file_url].some(n => (n ?? '').toLowerCase().split('?')[0].endsWith('.mp4'));
}

export function iaNoVideo(midias: PropertyPhoto[]): Map<string, SituacaoDoVideo> {
  const mapa = new Map<string, SituacaoDoVideo>();
  let escolhido = false;
  for (const m of midias) {
    if (!ehVideo(m) || !m.published) continue;
    const tamanho = m.file_size_bytes ?? 0;
    if (!ehMp4(m)) mapa.set(m.id, 'formato');
    else if (tamanho <= 0) mapa.set(m.id, 'semTamanho');
    else if (tamanho > LIMITE_DO_VIDEO_DA_IA) mapa.set(m.id, 'grande');
    else if (!escolhido) { escolhido = true; mapa.set(m.id, 'manda'); }
    else mapa.set(m.id, 'soUmVideo');
  }
  return mapa;
}

// ── Arquivos ─────────────────────────────────────────────────────────────────
export function validarArquivos(files: File[]): { ok: File[]; recusados: string[] } {
  const ok: File[] = [];
  const recusados: string[] = [];
  for (const f of files) {
    if (!ACCEPTED_MIME_TYPES.includes(f.type)) recusados.push(`${f.name}: tipo de arquivo não aceito`);
    else if (f.size > MAX_UPLOAD_BYTES) recusados.push(`${f.name}: maior que ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`);
    else ok.push(f);
  }
  return { ok, recusados };
}

// ── Endereço ─────────────────────────────────────────────────────────────────
export const linkDasFotos = (id: string, de?: 'cadastro'): string =>
  `/properties/${id}/fotos${de ? `?de=${de}` : ''}`;

export function destinoDaVolta({ id, de, kind, temHistorico }: {
  id: string; de: string | null; kind: ListingKind; temHistorico: boolean;
}): { para: string | -1; rotulo: string } {
  if (de === 'cadastro') return { para: `/properties/${id}/editar`, rotulo: 'Voltar ao cadastro' };
  // Veio da lista: voltar pelo histórico guarda a aba e os filtros do endereço.
  if (temHistorico) return { para: -1, rotulo: 'Imóveis' };
  return { para: `/properties?aba=${ABA_NA_URL[kind]}`, rotulo: 'Imóveis' };
}

// ── Capa ─────────────────────────────────────────────────────────────────────
// A capa não se oculta (decisão de 12/10): o site cairia na próxima foto sem
// ninguém ver. Mostrar de volta sempre pode.
export const podeOcultar = (foto: PropertyPhoto, capaId: string | null): boolean =>
  !foto.published || foto.id !== capaId;

export function separarCapaDoLote(ids: string[], capaId: string | null): { ids: string[]; pulouCapa: boolean } {
  const sem = ids.filter(id => id !== capaId);
  return { ids: sem, pulouCapa: sem.length !== ids.length };
}
